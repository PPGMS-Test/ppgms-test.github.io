// subscription-dashboard/src/components/LifecyclePanel.tsx
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { callCommon } from '@/lib/api'
import { buildReviseBody } from '@/lib/subscription-requests'
import { useFlowStore } from '@/store/flow'

type Action = 'query' | 'suspend' | 'activate' | 'cancel' | 'revise' | 'capture'

export function LifecyclePanel() {
  const subscriptionId = useFlowStore((s) => s.subscriptionId)
  const subscriptionStatus = useFlowStore((s) => s.subscriptionStatus)
  const accessToken = useFlowStore((s) => s.accessToken)
  const setSubscriptionStatus = useFlowStore((s) => s.setSubscriptionStatus)
  const planId = useFlowStore((s) => s.planId)

  const [pending, setPending] = useState<Action | null>(null)
  const [message, setMessage] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)

  async function run(action: Action) {
    if (!subscriptionId || !accessToken) return
    setPending(action)
    setMessage('')
    try {
      const base = `/v1/billing/subscriptions/${subscriptionId}`
      let result
      switch (action) {
        case 'query':
          result = await callCommon(base, { token: accessToken, method: 'GET' })
          break
        case 'suspend':
          result = await callCommon(`${base}/suspend`, { token: accessToken, rawBody: JSON.stringify({ reason: '测试暂停' }) })
          break
        case 'activate':
          result = await callCommon(`${base}/activate`, { token: accessToken, rawBody: JSON.stringify({ reason: '测试恢复' }) })
          break
        case 'cancel':
          result = await callCommon(`${base}/cancel`, { token: accessToken, rawBody: JSON.stringify({ reason: '测试取消' }) })
          break
        case 'revise':
          result = await callCommon(`${base}/revise`, { token: accessToken, rawBody: JSON.stringify(buildReviseBody(planId)) })
          break
        case 'capture':
          result = await callCommon(`${base}/capture`, {
            token: accessToken,
            rawBody: JSON.stringify({
              note: '测试补扣',
              capture_type: 'OUTSTANDING_BALANCE',
              amount: { currency_code: 'USD', value: '0.01' },
            }),
          })
          break
      }

      if (action === 'query' && result.ok) {
        const data = result.data as { status?: string }
        if (data.status) setSubscriptionStatus(data.status)
      }

      setMessage(result.ok ? `${action} 成功` : `${action} 失败：HTTP ${result.status}`)
    } catch (err) {
      setMessage(`${action} 出错：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPending(null)
      if (action === 'cancel') setConfirmCancel(false)
    }
  }

  if (!subscriptionId) {
    return (
      <Card>
        <p className="text-sm text-muted">完成 Step 4（Create Subscription）后，生命周期管理操作会出现在这里。</p>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-ink">生命周期管理</p>
        <span className="font-mono text-xs text-muted" aria-live="polite">
          status: {subscriptionStatus || '未知'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending !== null} onClick={() => run('query')}>
          {pending === 'query' ? '查询中…' : '查询状态'}
        </Button>
        <Button variant="outline" disabled={pending !== null} onClick={() => run('suspend')}>
          {pending === 'suspend' ? '暂停中…' : '暂停'}
        </Button>
        <Button variant="outline" disabled={pending !== null} onClick={() => run('activate')}>
          {pending === 'activate' ? '恢复中…' : '恢复'}
        </Button>
        <Button variant="outline" disabled={pending !== null || !planId} onClick={() => run('revise')}>
          {pending === 'revise' ? '修改中…' : '修改 Plan（用当前 Plan）'}
        </Button>
        <Button variant="outline" disabled={pending !== null} onClick={() => run('capture')}>
          {pending === 'capture' ? '补扣中…' : '补扣'}
        </Button>
        {confirmCancel ? (
          <>
            <Button variant="danger" disabled={pending !== null} onClick={() => run('cancel')}>
              {pending === 'cancel' ? '取消中…' : '确认取消？点击确认'}
            </Button>
            <Button variant="outline" disabled={false} onClick={() => setConfirmCancel(false)}>
              再想想
            </Button>
          </>
        ) : (
          <Button variant="danger" disabled={pending !== null} onClick={() => setConfirmCancel(true)}>
            取消
          </Button>
        )}
      </div>
      {message && (
        <p className="text-xs text-muted" aria-live="polite">
          {message}
        </p>
      )}
    </Card>
  )
}
