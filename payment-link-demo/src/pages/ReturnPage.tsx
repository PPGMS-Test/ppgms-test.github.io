import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, ArrowLeft, Loader2, Info } from 'lucide-react'
import { usePaymentLinksStore } from '@/store/payment-links'
import { useCredentialsStore } from '@/store/credentials'
import { ApiError } from '@/lib/api/types'

type Outcome = 'paid' | 'cancelled' | 'unknown'

/**
 * 支付回流页：买家在 PayPal 托管页完成/取消后被重定向到这里。
 * URL 形如 /#/return?link=<recordId>&status=paid|cancelled。
 * - paid：把对应本地记录标记为 paid，并尽力用 getLink 同步一次真实状态
 * - cancelled：不改状态，提示可重试
 */
export default function ReturnPage() {
  const [params] = useSearchParams()
  const linkId = params.get('link') ?? ''
  const status = (params.get('status') as Outcome) || 'unknown'

  const record = usePaymentLinksStore((s) => s.links.find((l) => l.id === linkId))
  const update = usePaymentLinksStore((s) => s.update)
  const client = useCredentialsStore((s) => s.client)
  const [syncing, setSyncing] = useState(false)
  const applied = useRef(false)

  useEffect(() => {
    if (applied.current || status !== 'paid' || !record) return
    applied.current = true
    update(record.id, { status: 'paid' })
    console.log('[Return] marked paid:', record.id, '· resource:', record.resourceId)

    // 尽力再拉一次真实资源状态（PLB 无权限时会报错，忽略即可）；
    // 只写 resourceStatus，本地 status 保持 paid 覆盖，不被 ACTIVE 冲掉
    setSyncing(true)
    client
      .getLink(record.resourceId)
      .then((res) => update(record.id, { raw: res, resourceStatus: res.status }))
      .catch((e) => console.warn('[Return] getLink sync skipped:', e instanceof ApiError ? e.status : e))
      .finally(() => setSyncing(false))
  }, [status, record, update, client])

  const view = useMemo(() => {
    if (status === 'cancelled') return 'cancelled' as const
    if (status === 'paid') return 'paid' as const
    return 'unknown' as const
  }, [status])

  return (
    <div data-context="buyer" className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <Link to="/store" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to shop
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {view === 'paid' && (
          <>
            <CheckCircle2 className="h-14 w-14 text-verified" />
            <h1 className="mt-4 font-display text-3xl font-bold">Payment complete</h1>
            <p className="mt-2 text-muted-foreground">
              {record
                ? <>Thanks — your payment for <span className="font-medium text-foreground">{record.currency} {record.amount}</span> went through.</>
                : 'Thanks — your payment went through.'}
            </p>
            {syncing && (
              <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Confirming status…
              </p>
            )}

            <TransactionIdNote />
          </>
        )}

        {view === 'cancelled' && (
          <>
            <XCircle className="h-14 w-14 text-muted-foreground" />
            <h1 className="mt-4 font-display text-3xl font-bold">Payment cancelled</h1>
            <p className="mt-2 text-muted-foreground">No charge was made. You can try again from the shop.</p>
          </>
        )}

        {view === 'unknown' && (
          <>
            <XCircle className="h-14 w-14 text-muted-foreground" />
            <h1 className="mt-4 font-display text-3xl font-bold">Nothing to show</h1>
            <p className="mt-2 text-muted-foreground">This page handles the redirect after a PayPal payment.</p>
          </>
        )}

        <Link
          to="/store"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Continue shopping
        </Link>
      </main>
    </div>
  )
}

/**
 * 开发者说明卡片：解释这个回流页拿不到真实交易号，以及生产环境该怎么拿。
 * 面向集成方，不是买家话术；纯静态文案，无逻辑。
 */
function TransactionIdNote() {
  return (
    <div className="mt-10 w-full rounded-xl border border-border bg-muted/40 p-5 text-left">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-semibold">Developer note — where's the transaction ID?</h2>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        This screen only reflects a <span className="font-medium text-foreground">local demo record</span>. There is no
        real transaction ID here: the Payment Links &amp; Buttons resource
        (<code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">GET /v1/checkout/payment-resources/&#123;id&#125;</code>)
        returns only the link's lifecycle <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">status</code> (ACTIVE / INACTIVE) —
        never the order or capture ID. The payment is a separate Order + Capture object that PayPal creates on its hosted page and does not write back onto the link.
      </p>

      <p className="mt-4 text-xs font-medium text-foreground">How to obtain the transaction ID in production</p>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Webhooks (authoritative, real-time).</span> Subscribe your app to{' '}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">PAYMENT.CAPTURE.COMPLETED</code> —{' '}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">resource.id</code> is the capture ID
          (the transaction number used for refunds and shown in the dashboard).{' '}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">CHECKOUT.ORDER.APPROVED</code>/<code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">.COMPLETED</code>{' '}
          gives the order ID. Correlate back to a link via <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">custom_id</code>/<code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">invoice_id</code>.
        </li>
        <li>
          <span className="font-medium text-foreground">Don't rely on the return URL.</span> NCP/PLB hosted pages don't
          reliably append the order ID to <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">return_url</code> —
          treat the redirect as a "buyer is back" signal only, and take the transaction ID from webhooks.
        </li>
        <li>
          <span className="font-medium text-foreground">Reporting API (offline reconciliation).</span>{' '}
          <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">GET /v1/reporting/transactions</code>{' '}
          can be queried by date range as a fallback, but has up to ~3h delay — not for real-time display.
        </li>
      </ul>
    </div>
  )
}
