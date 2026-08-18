/**
 * CreateLinkDialog：创建 payment link 的全量表单弹窗。
 * 用 LineItemForm 采集单个 line item 的所有字段，配合 reusable 选择上送创建。
 */
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LineItemForm } from '@/components/LineItemForm'
import { useCredentialsStore } from '@/store/credentials'
import { useFeatureFlagsStore } from '@/store/feature-flags'
import { usePaymentLinksStore } from '@/store/payment-links'
import type { Product } from '@/store/products'
import { extractPayUrl, extractQrCodeUrl, ApiError, type LineItem, type Reusable, type IntegrationMode } from '@/lib/api/types'
import { buildReturnUrl, isReturnUrlOmitted } from '@/lib/return-url'
import {
  defaultProductFormImage,
  resolveImageAssets,
  toApiImages,
  type FormImage,
} from '@/lib/images'

interface Props {
  product: Product | null
  onClose: () => void
}

/** crypto.randomUUID 在非安全上下文（LAN 明文 HTTP）会抛错，降级到时间戳+随机数 */
function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/** 从产品初始化一个 line item */
function itemFromProduct(product: Product): LineItem {
  return {
    name: product.name,
    description: product.description,
    product_id: product.id,
    unit_amount: { currency_code: product.currency, value: product.price },
  }
}

export function CreateLinkDialog({ product, onClose }: Props) {
  const { client } = useCredentialsStore()
  const imagesEnabled = useFeatureFlagsStore((s) => s.imagesEnabled)
  const addLink = usePaymentLinksStore((s) => s.add)
  const [reusable, setReusable] = useState<Reusable>('MULTIPLE')
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>('LINK')
  const [item, setItem] = useState<LineItem>(() =>
    product ? itemFromProduct(product) : { name: '', unit_amount: { currency_code: 'USD', value: '' } },
  )
  const [images, setImages] = useState<FormImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgNotice, setImgNotice] = useState<string | null>(null)

  // product 切换时重置表单；启用图片功能时异步生成一张默认商品图作主图
  useEffect(() => {
    if (!product) return
    setItem(itemFromProduct(product))
    setReusable('MULTIPLE')
    setIntegrationMode('LINK')
    setError(null)
    setImgNotice(null)
    setImages([])
    if (!imagesEnabled) return
    let cancelled = false
    defaultProductFormImage(product)
      .then((img) => {
        if (!cancelled) setImages([img])
      })
      .catch((e) => console.warn('[CreateLinkDialog] default image generation failed', e))
    return () => {
      cancelled = true
    }
  }, [product?.id, imagesEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!product) return
    setLoading(true)
    setError(null)
    try {
      // 先生成本地记录 id，写进 return_url，付款成功回流时据此标记 paid。
      // localhost 且未配 PUBLIC_BASE_URL 时 buildReturnUrl 返回 null → 省略 return_url(仍能创建)。
      const recordId = makeId()
      const returnUrl = buildReturnUrl(recordId) ?? undefined
      // 两步上传（best-effort，仅当全局开关启用）：先把未上传的图片上传拿 asset_id，再随 line item 引用。
      // 图片接口若在当前环境未部署/失败，只记录并跳过图片，不阻断建 link。
      let apiImages: LineItem['images']
      if (imagesEnabled && images.length > 0) {
        try {
          const resolvedImages = await resolveImageAssets(client, images)
          setImages(resolvedImages)
          apiImages = toApiImages(resolvedImages)
        } catch (e) {
          console.warn('[CreateLinkDialog] image upload failed, creating link without images', e)
          setImgNotice(
            '图片上传失败（该接口可能未在当前环境部署，见全局开关说明），已跳过图片继续创建。',
          )
        }
      }
      const lineItem: LineItem = { ...item, images: apiImages }
      const baseInput = { reusable, return_url: returnUrl, line_items: [lineItem] }
      console.log('[CreateLinkDialog] creating link', { recordId, reusable, integrationMode, returnUrl, item: lineItem })
      // integration_mode 为 QR_CODE 时 best-effort：公开 sandbox 目前只接受 LINK(实测 QR_CODE → 400
      // INVALID_PARAMETER_VALUE)。若被拒则自动回退为 LINK 重建(400 未建资源，复用同一幂等键安全)，
      // 建成后仍可用 Links 里的「QR」按钮由前端本地生成可扫码 QR。
      let res
      let effectiveMode = integrationMode
      try {
        res = await client.createLink({ integration_mode: integrationMode, ...baseInput }, recordId)
      } catch (e) {
        if (integrationMode !== 'LINK' && e instanceof ApiError && (e.status === 400 || e.status === 422)) {
          console.warn(`[CreateLinkDialog] integration_mode ${integrationMode} rejected (HTTP ${e.status}), falling back to LINK`, e)
          setImgNotice(
            `integration_mode "${integrationMode}" 未被当前环境接受（HTTP ${e.status}），已回退为 LINK 创建。可在 Links 里点「QR」按钮由前端本地生成可扫码 QR。`,
          )
          effectiveMode = 'LINK'
          res = await client.createLink({ integration_mode: 'LINK', ...baseInput }, recordId)
        } else {
          throw e
        }
      }
      const payUrl = extractPayUrl(res)
      const qrCodeUrl = extractQrCodeUrl(res) ?? undefined
      if (!payUrl) throw new Error('Link created but no pay URL was returned.')
      addLink({
        id: recordId,
        productId: product.id,
        resourceId: res.id,
        payUrl,
        status: 'live',
        resourceStatus: res.status,
        name: item.name,
        reusable,
        integrationMode: effectiveMode,
        qrCodeUrl,
        amount: item.unit_amount.value,
        currency: product.currency,
        createdAt: Date.now(),
        raw: res,
      })
      onClose()
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.message} (HTTP ${e.status}${e.debugId ? ` · debug_id ${e.debugId}` : ''})`
          : (e as Error).message
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={!!product}
      onOpenChange={(o) => !o && onClose()}
      title={`Create link · ${product?.name ?? ''}`}
      size="xl"
    >
      {product && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="create-reusable">Reusable</Label>
              <Select
                id="create-reusable"
                value={reusable}
                onChange={(e) => setReusable(e.target.value as Reusable)}
              >
                <option value="MULTIPLE">MULTIPLE — reusable link</option>
                <option value="SINGLE">SINGLE — one-time link</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-mode">Integration mode</Label>
              <Select
                id="create-mode"
                value={integrationMode}
                onChange={(e) => setIntegrationMode(e.target.value as IntegrationMode)}
              >
                <option value="LINK">LINK — shareable URL</option>
                <option value="QR_CODE">QR_CODE — QR for offline</option>
              </Select>
            </div>
          </div>
          {integrationMode === 'QR_CODE' && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
              以 <span className="font-mono">integration_mode: "QR_CODE"</span> 创建。注意：公开 sandbox 目前只接受 LINK
              （实测 QR_CODE → 400），本 demo 会在被拒时<b>自动回退为 LINK</b>。无论如何，建成后都可在 Links 里点
              「QR」按钮由前端本地把支付 URL 生成可扫码 QR（线下门店/展会/打印物料适用）。
            </p>
          )}

          <LineItemForm
            value={item}
            onChange={setItem}
            currency={product.currency}
            images={images}
            onImagesChange={setImages}
          />

          {isReturnUrlOmitted() && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
              本地 localhost 不能作 PayPal return_url（会被拒），已省略 return_url —— 创建正常，但支付成功不会自动回流站内。
              需要回流请在 <span className="font-mono">src/config/app.config.ts</span> 配置 <span className="font-mono">PUBLIC_BASE_URL</span>（公网 https / 隧道地址）。
            </p>
          )}

          {imgNotice && (
            <p className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
              {imgNotice}
            </p>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" loading={loading} onClick={submit}>
            Create link
          </Button>
        </div>
      )}
    </Dialog>
  )
}
