import { useState } from 'react'
import { LinkTicket } from '@/components/LinkTicket'
import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2, Pencil, Eye } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { usePaymentLinksStore, type PaymentLinkRecord } from '@/store/payment-links'
import { useProductsStore } from '@/store/products'
import { ApiError } from '@/lib/api/types'

interface Props {
  /** 打开某条 link 的详情（GET /{id}） */
  onInspect: (resourceId: string) => void
  /** 编辑某条 link（PUT /{id}） */
  onEdit: (record: PaymentLinkRecord) => void
}

export function LinksList({ onInspect, onEdit }: Props) {
  const { client } = useCredentialsStore()
  const links = usePaymentLinksStore((s) => s.links)
  const update = usePaymentLinksStore((s) => s.update)
  const remove = usePaymentLinksStore((s) => s.remove)
  const byId = useProductsStore((s) => s.byId)
  const [busy, setBusy] = useState<string | null>(null)

  async function refresh(rec: PaymentLinkRecord) {
    setBusy(rec.id)
    try {
      const res = await client.getLink(rec.resourceId)
      // 只更新 PLB 资源状态，本地生命周期 status 保持不变
      update(rec.id, { resourceStatus: res.status, raw: res })
    } catch (e) {
      console.error('[LinksList] refresh failed', e instanceof ApiError ? e.data : e)
    } finally {
      setBusy(null)
    }
  }

  async function del(rec: PaymentLinkRecord) {
    setBusy(rec.id)
    try {
      await client.deleteLink(rec.resourceId)
      remove(rec.id)
    } catch (e) {
      console.error('[LinksList] delete failed', e instanceof ApiError ? e.data : e)
      remove(rec.id) // demo: drop local record even if remote delete errors
    } finally {
      setBusy(null)
    }
  }

  if (links.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No links yet. Pick a product and create one.</p>
  }

  return (
    <div className="space-y-4">
      {links.map((rec) => (
        <LinkTicket
          key={rec.id}
          title={rec.name ?? byId(rec.productId)?.name ?? rec.productId}
          amount={rec.amount}
          currency={rec.currency}
          payUrl={rec.payUrl}
          status={rec.status}
        >
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onInspect(rec.resourceId)}>
              <Eye className="h-3.5 w-3.5" /> Details
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(rec)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" variant="outline" loading={busy === rec.id} onClick={() => refresh(rec)}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" variant="destructive" loading={busy === rec.id} onClick={() => del(rec)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </LinkTicket>
      ))}
    </div>
  )
}
