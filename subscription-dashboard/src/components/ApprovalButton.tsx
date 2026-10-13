// subscription-dashboard/src/components/ApprovalButton.tsx
// Sandbox client_id 必须从 www.sandbox.paypal.com 加载 SDK，否则报 invalid_client
// （见 jsv6-sdk-sandbox-host 已知限制）。script 用固定 DOM id 做单例去重，
// clientId 只在 createInstance() 时传入，不放进脚本 URL。
import { useEffect, useRef, useState } from 'react'
import { useCredentialsStore } from '@/store/credentials'
import { useFlowStore } from '@/store/flow'

const SDK_SRC = 'https://www.sandbox.paypal.com/web-sdk/v6/core'
const SDK_SCRIPT_ID = 'paypal-websdk-v6-core'

function loadSdkScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.paypal?.createInstance) {
      resolve()
      return
    }
    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('PayPal SDK 脚本加载失败')))
      return
    }
    const script = document.createElement('script')
    script.id = SDK_SCRIPT_ID
    script.src = SDK_SRC
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK 脚本加载失败'))
    document.body.appendChild(script)
  })
}

type ApprovalStatus = 'idle' | 'loading' | 'ready' | 'approved' | 'error'

export function ApprovalButton() {
  const clientId = useCredentialsStore((s) => s.clientId)
  const subscriptionId = useFlowStore((s) => s.subscriptionId)
  const setSubscriptionStatus = useFlowStore((s) => s.setSubscriptionStatus)
  const [status, setStatus] = useState<ApprovalStatus>('idle')
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!subscriptionId || !clientId) return
    let cancelled = false
    let cleanupClick: (() => void) | undefined
    setStatus('loading')
    setError('')

    loadSdkScript()
      .then(async () => {
        if (cancelled) return
        const paypal = window.paypal
        if (!paypal?.createInstance) throw new Error('window.paypal.createInstance 不存在，SDK 未正确加载')

        const sdkInstance = await paypal.createInstance({
          clientId,
          components: ['paypal-subscriptions'],
          pageType: 'checkout',
        })
        if (cancelled) return

        const session = sdkInstance.createPayPalSubscriptionPaymentSession({
          onApprove() {
            setStatus('approved')
            setSubscriptionStatus('ACTIVE（已批准，点右侧「查询状态」确认）')
          },
          onCancel() {
            setStatus('ready')
          },
          onError(err) {
            setStatus('error')
            setError(err instanceof Error ? err.message : String(err))
          },
        })

        const button = containerRef.current?.querySelector('paypal-button')
        if (!button) return
        const onClick = () => {
          session.start({ presentationMode: 'auto' }, Promise.resolve({ subscriptionId })).catch((err: unknown) => {
            setStatus('error')
            setError(err instanceof Error ? err.message : String(err))
          })
        }
        button.addEventListener('click', onClick)
        cleanupClick = () => button.removeEventListener('click', onClick)
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : String(err))
        }
      })

    return () => {
      cancelled = true
      cleanupClick?.()
    }
  }, [clientId, subscriptionId, setSubscriptionStatus])

  if (!subscriptionId) {
    return <p className="text-sm text-muted">请先完成 Step 4（Create Subscription）拿到 subscriptionId。</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div aria-live="polite">
        {status === 'loading' && <p className="text-sm text-muted">正在加载 PayPal SDK…</p>}
        {status === 'error' && (
          <p className="text-sm text-danger" role="alert">
            SDK 加载/按钮出错：{error}（常见原因：client_id 不是 sandbox 账号，或网络被拦截）
          </p>
        )}
        {status === 'approved' && <p className="text-sm text-ok">买家已批准订阅，可以去下方生命周期面板点「查询状态」确认。</p>}
      </div>
      <div ref={containerRef} className="max-w-xs">
        <paypal-button type="subscribe" />
      </div>
    </div>
  )
}
