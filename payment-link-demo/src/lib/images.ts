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
import { isImageUploadSuccess, type LineItem, type LineItemImage } from '@/lib/api/types'

/** 每个 line item 最多 5 张图片（文档约束） */
export const MAX_IMAGES_PER_ITEM = 5
/** 单次上传请求最多 15 张（内部 spec：>15 → 400 MAX_BATCH_SIZE_EXCEEDED） */
export const MAX_IMAGES_PER_BATCH = 15
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

// ── 默认商品图（用 public 下的商品图，光栅化成可上传的 PNG） ──────────────────

/** 把一张图片 URL 画到指定尺寸的 PNG canvas 上（SVG 也可，浏览器解码后光栅化）。 */
async function rasterizeToPng(
  url: string,
  size = 600,
): Promise<{ file: File; dataUrl: string }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error(`failed to load image: ${url}`))
    el.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // 白底（PNG 透明区在买家端展示更干净），图片按 contain 居中不变形
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  const iw = image.naturalWidth || size
  const ih = image.naturalHeight || size
  const scale = Math.min(size / iw, size / ih)
  const dw = iw * scale
  const dh = ih * scale
  ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh)

  const dataUrl = canvas.toDataURL('image/png')
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas.toBlob returned null')
  return { file: new File([blob], 'default.png', { type: 'image/png' }), dataUrl }
}

/**
 * 为产品生成一张默认商品图：取 product.image（public 下的 SVG）光栅化成 600×600 PNG。
 * 返回可上传的 File 与用于预览的 dataURL。
 */
export async function generateDefaultProductImage(
  product: Product,
): Promise<{ file: File; dataUrl: string }> {
  const { file, dataUrl } = await rasterizeToPng(product.image)
  // 用产品 id 命名，便于日志/调试区分
  return { file: new File([file], `${product.id}-default.png`, { type: 'image/png' }), dataUrl }
}

/** 生成产品默认图并包装成一张主图 FormImage（供创建弹窗初始化） */
export async function defaultProductFormImage(product: Product): Promise<FormImage> {
  const { file, dataUrl } = await generateDefaultProductImage(product)
  return { key: makeKey(), previewUrl: dataUrl, file, is_primary: true }
}

// ── 上送前处理 ────────────────────────────────────────────────────────────────

/**
 * 上传所有尚未有 asset_id 的图片（第一步），按 207 的 input_index/顺序把成功项的
 * asset_id/status 回填；失败项(name/message/input_index)记录到 console，对应 FormImage 原样保留(无 asset_id)。
 * 已上传（有 asset_id）的原样保留。无待上传项时不发请求。
 */
export async function resolveImageAssets(
  client: Pick<PayPalClient, 'uploadImages'>,
  images: FormImage[],
): Promise<FormImage[]> {
  const pending = images.filter((i) => !i.asset_id && i.file)
  if (pending.length === 0) return images

  const res = await client.uploadImages(pending.map((i) => i.file as File))
  const results = res.images ?? []

  // 把 207 结果按位置映射回 pending：优先用 input_index，否则按数组顺序
  let seq = 0
  const byPendingIndex = new Map<number, FormImage>()
  for (const r of results) {
    const idx = typeof (r as { input_index?: number }).input_index === 'number'
      ? (r as { input_index: number }).input_index
      : seq
    seq++
    const target = pending[idx]
    if (!target) continue
    if (isImageUploadSuccess(r)) {
      byPendingIndex.set(idx, { ...target, asset_id: r.asset_id, status: r.status })
    } else {
      console.warn('[images] upload failed for one image', r)
    }
  }

  let p = 0
  return images.map((img) => {
    if (img.asset_id || !img.file) return img
    const resolved = byPendingIndex.get(p)
    p++
    return resolved ?? img
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
