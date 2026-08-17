/**
 * EditLinkDialog：编辑已有 payment link（PUT 整体替换）。
 * 打开时从 record.raw 或 getLink 拉取当前配置初始化 LineItemForm，提交后 PUT 并回写本地记录。
 */
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { LineItemForm } from '@/components/LineItemForm'
import { useCredentialsStore } from '@/store/credentials'
import { usePaymentLinksStore, type PaymentLinkRecord } from '@/store/payment-links'
import { useProductsStore } from '@/store/products'
import {
  ApiError,
  type LineItem,
  type Reusable,
  type PaymentResource,
} from '@/lib/api/types'

interface Props {
  record: PaymentLinkRecord | null
  onClose: () => void
}

/** raw 是否看起来是带 line_items 的 PaymentResource */
function rawLineItem(raw: unknown): LineItem | null {
  if (raw && typeof raw === 'object' && 'line_items' in raw) {
    const items = (raw as PaymentResource).line_items
    if (Array.isArray(items) && items.length > 0) return items[0]
  }
  return null
}

export function EditLinkDialog({ record, onClose }: Props) {
  const { client } = useCredentialsStore()
  const productName = useProductsStore((s) => (record ? s.byId(record.productId)?.name : undefined))
  const [reusable, setReusable] = useState<Reusable>('MULTIPLE')
  const [item, setItem] = useState<LineItem | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 打开时初始化表单：优先 raw，其次 getLink，兜底用 record 最小信息
  useEffect(() => {
    if (!record) {
      setItem(null)
      return
    }
    let cancelled = false
    setError(null)
    setReusable((record.reusable as Reusable) ?? 'MULTIPLE')

    const fallback: LineItem = {
      name: record.name ?? productName ?? 'Item',
      unit_amount: { currency_code: record.currency, value: record.amount },
    }

    const fromRaw = rawLineItem(record.raw)
    if (fromRaw) {
      setItem(fromRaw)
      return
    }

    // raw 不含 line_items：尝试从服务端拉取当前配置
    setSeeding(true)
    setItem(fallback)
    client
      .getLink(record.resourceId)
      .then((res) => {
        if (cancelled) return
        const li = rawLineItem(res)
        if (li) setItem(li)
        if (typeof res.reusable === 'string') setReusable(res.reusable as Reusable)
      })
      .catch(() => {
        /* 拉取失败：保留 fallback */
      })
      .finally(() => {
        if (!cancelled) setSeeding(false)
      })

    return () => {
      cancelled = true
    }
  }, [record?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!record || !item) return
    setLoading(true)
    setError(null)
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}#/return?link=${record.id}&status=paid`
      console.log('[EditLinkDialog] updating link', { resourceId: record.resourceId, reusable, item })
      await client.updateLink(record.resourceId, {
        reusable,
        return_url: returnUrl,
        line_items: [item],
      })
      // PUT 返回 204/null，尽力再拉一次以同步资源状态
      const fresh = await client.getLink(record.resourceId).catch(() => null)
      usePaymentLinksStore.getState().update(record.id, {
        amount: item.unit_amount.value,
        name: item.name,
        reusable,
        resourceStatus: fresh?.status ?? record.resourceStatus,
        raw: fresh ?? record.raw,
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
      open={!!record}
      onOpenChange={(o) => !o && onClose()}
      title={`Edit link · ${record?.name ?? productName ?? ''}`}
      size="xl"
    >
      {record && item && (
        <div className="space-y-4">
          {seeding && (
            <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
              Loading current configuration…
            </p>
          )}

          <div className="max-w-xs">
            <Label htmlFor="edit-reusable">Reusable</Label>
            <Select
              id="edit-reusable"
              value={reusable}
              onChange={(e) => setReusable(e.target.value as Reusable)}
            >
              <option value="MULTIPLE">MULTIPLE — reusable link</option>
              <option value="SINGLE">SINGLE — one-time link</option>
            </Select>
          </div>

          <LineItemForm value={item} onChange={setItem} currency={record.currency} />

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" loading={loading} onClick={submit}>
            Save changes
          </Button>
        </div>
      )}
    </Dialog>
  )
}
