import { useEffect, useState } from 'react'
import { ExternalLink, Copy, Check, ChevronRight, ChevronDown, Package } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useCredentialsStore } from '@/store/credentials'
import {
  ApiError,
  extractPayUrl,
  type PaymentResource,
  type LineItem,
  type Money,
} from '@/lib/api/types'

interface LinkDetailsDialogProps {
  /** 要展示的 payment resource id，null 表示关闭 */
  resourceId: string | null
  onClose: () => void
}

/** ACTIVE 走 verified 配色，其余走 muted */
function statusPillClass(status?: string): string {
  if (status === 'ACTIVE') return 'bg-verified/10 text-verified border border-verified/30'
  return 'bg-muted text-muted-foreground border border-border'
}

/** 把 ApiError 格式化成一行可读文案（带 HTTP status + debug_id） */
function formatError(e: unknown): string {
  if (e instanceof ApiError) {
    return `${e.message} (HTTP ${e.status}${e.debugId ? ` · debug_id ${e.debugId}` : ''})`
  }
  return e instanceof Error ? e.message : String(e)
}

/** 金额展示 */
function money(m?: Money): string {
  return m ? `${m.currency_code} ${m.value}` : '—'
}

/** 一行 label/value */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground break-all">{children}</span>
    </div>
  )
}

export function LinkDetailsDialog({ resourceId, onClose }: LinkDetailsDialogProps) {
  const { client } = useCredentialsStore()
  const open = !!resourceId

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PaymentResource | null>(null)
  const [rawOpen, setRawOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // resourceId 变化时拉取详情；用 requestedId 兜住竞态（id 变了就丢弃旧响应）
  useEffect(() => {
    if (!resourceId) return
    const requestedId = resourceId
    setLoading(true)
    setError(null)
    setData(null)
    setRawOpen(false)
    console.log('[LinkDetailsDialog] getLink', requestedId)
    client
      .getLink(requestedId)
      .then((res) => {
        if (requestedId !== resourceId) return
        setData(res)
      })
      .catch((e) => {
        if (requestedId !== resourceId) return
        console.error('[LinkDetailsDialog] getLink failed', e instanceof ApiError ? e.data : e)
        setError(formatError(e))
      })
      .finally(() => {
        if (requestedId !== resourceId) return
        setLoading(false)
      })
  }, [resourceId, client])

  async function copyPayUrl(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    console.log('[LinkDetailsDialog] copied pay url:', url)
    setTimeout(() => setCopied(false), 1500)
  }

  const payUrl = data ? extractPayUrl(data) : null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Payment resource details"
      description="Live data fetched from PayPal (GET /v1/checkout/payment-resources/{id})."
      size="lg"
    >
      {loading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      {error && !loading && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <p className="mt-1 text-xs opacity-80">
            A 403/404 here is expected in sandbox when partner authorization isn&apos;t fully wired.
          </p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-5">
          {/* 概要字段 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ID"><span className="font-mono text-xs">{data.id}</span></Field>
            <Field label="Status">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs', statusPillClass(data.status))}>
                {data.status ?? 'UNKNOWN'}
              </span>
            </Field>
            <Field label="Reusable">{data.reusable ?? '—'}</Field>
            <Field label="Type">{data.type ?? '—'}</Field>
            <Field label="Integration mode">{data.integration_mode ?? '—'}</Field>
            <Field label="Return URL">{data.return_url ?? '—'}</Field>
            <Field label="Created">{data.create_time ?? '—'}</Field>
            <Field label="Updated">{data.update_time ?? '—'}</Field>
          </div>

          {/* 支付 URL */}
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-muted-foreground">Pay URL</span>
            {payUrl ? (
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-brand hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{payUrl}</span>
                </a>
                <button
                  onClick={() => copyPayUrl(payUrl)}
                  aria-label="Copy pay URL"
                  className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="h-4 w-4 text-verified" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>

          {/* line items */}
          <div>
            <span className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Line items ({data.line_items?.length ?? 0})
            </span>
            <div className="space-y-3">
              {(data.line_items ?? []).map((li, i) => (
                <LineItemCard key={i} item={li} />
              ))}
              {(!data.line_items || data.line_items.length === 0) && (
                <p className="text-sm text-muted-foreground">No line items.</p>
              )}
            </div>
          </div>

          {/* Raw JSON 折叠 */}
          <div>
            <button
              onClick={() => setRawOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-brand"
            >
              {rawOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Raw JSON
            </button>
            {rawOpen && (
              <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs font-mono">
                {JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

/** 单个 line item 的通用展示：核心字段 + 存在则罗列附加计费/选项 */
function LineItemCard({ item }: { item: LineItem }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-foreground">{item.name}</span>
        <span className="font-mono text-sm text-foreground">{money(item.unit_amount)}</span>
      </div>
      {item.product_id && (
        <div className="mt-0.5 font-mono text-xs text-muted-foreground">SKU: {item.product_id}</div>
      )}
      {item.description && (
        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
      )}

      {/* 附加信息：仅在存在时渲染，通用罗列 */}
      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {item.taxes && item.taxes.length > 0 && (
          <div>Taxes: {item.taxes.map((t) => `${t.name ? `${t.name} ` : ''}${t.value} (${t.type})`).join(', ')}</div>
        )}
        {item.shipping && item.shipping.length > 0 && (
          <div>Shipping: {item.shipping.map((s) => `${s.value} (${s.type})`).join(', ')}</div>
        )}
        {item.discounts && item.discounts.length > 0 && (
          <div>Discounts: {item.discounts.map((d) => `${d.value} (${d.type})`).join(', ')}</div>
        )}
        {item.handling && item.handling.length > 0 && (
          <div>Handling: {item.handling.map((h) => `${h.value} (${h.type})`).join(', ')}</div>
        )}
        {typeof item.collect_shipping_address === 'boolean' && (
          <div>Collect shipping address: {item.collect_shipping_address ? 'yes' : 'no'}</div>
        )}
        {item.customer_notes && item.customer_notes.length > 0 && (
          <div>Customer notes: {item.customer_notes.map((n) => `${n.label}${n.required ? ' *' : ''}`).join(', ')}</div>
        )}
        {item.adjustable_quantity && (
          <div>
            Adjustable quantity:{' '}
            {JSON.stringify(item.adjustable_quantity)}
          </div>
        )}
        {item.variants && item.variants.dimensions.length > 0 && (
          <div>
            Variants:{' '}
            {item.variants.dimensions
              .map((dim) => `${dim.name}${dim.primary ? ' (primary)' : ''}: ${dim.options.map((o) => o.label).join('/')}`)
              .join(' · ')}
          </div>
        )}
        {item.images && item.images.length > 0 && (
          <div>
            Images ({item.images.length}):{' '}
            {item.images.map((im) => `${im.asset_id}${im.is_primary ? ' (primary)' : ''}`).join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}
