import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, ArrowLeft, Loader2 } from 'lucide-react'
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

    // 尽力再拉一次真实状态（PLB 无权限时会报错，忽略即可）
    setSyncing(true)
    client
      .getLink(record.resourceId)
      .then((res) => update(record.id, { raw: res, status: (res.status as typeof record.status) ?? 'paid' }))
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
