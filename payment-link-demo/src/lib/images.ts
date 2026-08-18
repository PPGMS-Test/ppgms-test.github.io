/**
 * 商品图片：PLB 两步上传模型的前端胶水层。
 *
 * PLB 的图片和网页不同，是**解耦的两步**：
 *   1) POST /payment-resources/images 上传二进制 → 拿回 asset_id
 *   2) 创建/更新 link 时在 line_items[].images[] 里用 asset_id 引用
 *
 * 约束（文档）：每个 line item 最多 5 张图，有且仅有 1 张 is_primary=true。
 *
 * 表单里一张图片的状态比上送结构丰富（还没上传时只有本地 File + 预览 URL），
 * 用 FormImage 建模；真正上送前经 resolveImageAssets(上传补齐 asset_id) + toApiImages(裁成最小结构)。
 */
import type { Product } from '@/store/products'
import type { PayPalClient } from '@/lib/api/client'
import type { LineItem, LineItemImage } from '@/lib/api/types'

/** 每个 line item 最多 5 张图片（文档约束） */
export const MAX_IMAGES_PER_ITEM = 5
/** 文件选择器接受的类型（文档：PNG / JPEG / BMP） */
export const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/bmp'

/** 表单内一张图片的完整 UI 状态；只有 asset_id/is_primary 会最终上送 API */
export interface FormImage {
  /** 本地稳定 key（React list key） */
  key: string
  /** <img> 预览用；已有资源载入的图片可能没有预览 */
  previewUrl?: string
  /** 尚未上传时存在，上传时作为 multipart 文件发出 */
  file?: File
  /** 上传成功 / 从已有资源载入后存在 */
  asset_id?: string
  /** 资产状态：ACTIVE / IN_REVIEW / …（上传后回填） */
  status?: string
  /** 是否为主图 */
  is_primary: boolean
}

/** 非安全上下文(crypto 不可用)时退化到时间戳+随机数 */
function makeKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `img-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/** 由用户选择的 File 列表构造 FormImage（生成对象 URL 预览）；startPrimary 时首张设主 */
export function filesToFormImages(files: File[], startPrimary: boolean): FormImage[] {
  return files.map((file, i) => ({
    key: makeKey(),
    previewUrl: URL.createObjectURL(file),
    file,
    is_primary: startPrimary && i === 0,
  }))
}

/** 从已有 line item 的 images[] 载入 FormImage（只有 asset_id/is_primary，无本地预览） */
export function seedImagesFromLineItem(item: LineItem | null | undefined): FormImage[] {
  const imgs = item?.images ?? []
  return imgs.map((im) => ({
    key: makeKey(),
    asset_id: im.asset_id,
    is_primary: !!im.is_primary,
  }))
}

// ── 默认商品图（canvas 生成合法 PNG，避免打包二进制/联网取图） ────────────────

const PALETTE = ['#1e3a8a', '#b45309', '#0f766e', '#7c3aed', '#be123c', '#0369a1']

/** 由产品 id 派生一个稳定的品牌底色 */
function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/**
 * 为产品生成一张默认商品图：600×600 PNG（渐变底 + 首字母 + 产品名）。
 * 返回可上传的 File 与用于预览的 dataURL。
 */
export async function generateDefaultProductImage(
  product: Product,
): Promise<{ file: File; dataUrl: string }> {
  const size = 600
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, colorFor(product.id))
  g.addColorStop(1, '#0b1020')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const initial = (product.name.trim()[0] ?? '?').toUpperCase()
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.font = 'bold 300px system-ui, -apple-system, sans-serif'
  ctx.fillText(initial, size / 2, size / 2 - 30)

  ctx.font = '600 40px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(product.name, size / 2, size - 90)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas.toBlob returned null')
  const file = new File([blob], `${product.id}-default.png`, { type: 'image/png' })
  return { file, dataUrl }
}

/** 生成产品默认图并包装成一张主图 FormImage（供创建弹窗初始化） */
export async function defaultProductFormImage(product: Product): Promise<FormImage> {
  const { file, dataUrl } = await generateDefaultProductImage(product)
  return { key: makeKey(), previewUrl: dataUrl, file, is_primary: true }
}

// ── 上送前处理 ────────────────────────────────────────────────────────────────

/**
 * 上传所有尚未有 asset_id 的图片（第一步），保序把返回的 asset_id/status 回填；
 * 已上传（有 asset_id）的原样保留。无待上传项时不发请求。
 */
export async function resolveImageAssets(
  client: Pick<PayPalClient, 'uploadImages'>,
  images: FormImage[],
): Promise<FormImage[]> {
  const pending = images.filter((i) => !i.asset_id && i.file)
  if (pending.length === 0) return images

  const res = await client.uploadImages(pending.map((i) => i.file as File))
  const uploaded = res.images ?? []
  let u = 0
  return images.map((img) => {
    if (img.asset_id || !img.file) return img
    const a = uploaded[u++]
    return a ? { ...img, asset_id: a.asset_id, status: a.status } : img
  })
}

/**
 * 裁成上送 line_items[].images 的最小结构；丢弃没有 asset_id 的项。
 * 保证有且仅有 1 张主图：没有标主图时把第一张设为主。
 */
export function toApiImages(images: FormImage[]): LineItemImage[] | undefined {
  const withId = images.filter((i) => i.asset_id)
  if (withId.length === 0) return undefined
  const hasPrimary = withId.some((i) => i.is_primary)
  return withId.map((i, idx) => ({
    asset_id: i.asset_id as string,
    is_primary: hasPrimary ? i.is_primary : idx === 0,
  }))
}
