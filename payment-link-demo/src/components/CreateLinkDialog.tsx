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
import { usePaymentLinksStore } from '@/store/payment-links'
import type { Product } from '@/store/products'
import { extractPayUrl, ApiError, type LineItem, type Reusable } from '@/lib/api/types'

interface Props {
  product: Product | null
  onClose: () => void
}

/** crypto.randomUUID 在非安全上下文（LAN 明文 HTTP）会抛错，降级到时间戳+随机数 */
function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/**
 * 构造回流地址：买家在 PayPal 托管页支付成功后，重定向回站内 /return 页。
 * 用 HashRouter，形如 http://host/base/#/return?link=<id>&status=paid。
 * recordId 提前生成并写进 URL，回流时据此定位本地记录并标记 paid。
 * PLB 仅支持 return_url，不发送 cancel_url。
 */
function buildReturnUrl(recordId: string) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/return?link=${recordId}&status=paid`
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
  const addLink = usePaymentLinksStore((s) => s.add)
  const [reusable, setReusable] = useState<Reusable>('MULTIPLE')
  const [item, setItem] = useState<LineItem>(() =>
    product ? itemFromProduct(product) : { name: '', unit_amount: { currency_code: 'USD', value: '' } },
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // product 切换时重置表单
  useEffect(() => {
    if (product) {
      setItem(itemFromProduct(product))
      setReusable('MULTIPLE')
      setError(null)
    }
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!product) return
    setLoading(true)
    setError(null)
    try {
      // 先生成本地记录 id，写进 return_url，付款成功回流时据此标记 paid
      const recordId = makeId()
      console.log('[CreateLinkDialog] creating link', { recordId, reusable, item })
      const res = await client.createLink(
        { reusable, return_url: buildReturnUrl(recordId), line_items: [item] },
        recordId,
      )
      const payUrl = extractPayUrl(res)
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
          <div className="max-w-xs">
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

          <LineItemForm value={item} onChange={setItem} currency={product.currency} />

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
