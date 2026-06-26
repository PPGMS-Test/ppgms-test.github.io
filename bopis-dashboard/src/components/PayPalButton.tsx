import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core'

// Singleton: prevent double-loading across React StrictMode double-invoke
let sdkReady: Promise<void> | null = null
function ensureSdk(): Promise<void> {
  if (!sdkReady) {
    sdkReady = new Promise<void>((resolve, reject) => {
      if (window.paypal) { resolve(); return }
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => { sdkReady = null; reject(new Error('SDK load error')) })
        return
      }
      const s = document.createElement('script')
      s.src = SDK_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { sdkReady = null; reject(new Error('PayPal SDK failed to load')) }
      document.head.appendChild(s)
    })
  }
  return sdkReady
}

interface Props {
  clientToken: string
  orderId: string
  onApprove: (data: { orderId: string }) => Promise<void>
  onError: (error: Error) => void
  onCancel: () => void
}

export function PayPalButton({ clientToken, orderId, onApprove, onError, onCancel }: Props) {
  // IMPORTANT: containerRef div is always rendered (hidden until ready).
  // If we conditionally render it only when ready=true, containerRef.current
  // is null when the effect runs, so `if (!containerRef.current) return` exits
  // early and setReady(true) is never reached — causing an infinite spinner.
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        await ensureSdk()
        if (cancelled) return

        const sdk = await window.paypal!.createInstance({
          clientToken,
          components: ['paypal-payments'],
          pageType: 'checkout',
        })
        if (cancelled) return

        const session = sdk.createPayPalOneTimePaymentSession({ onApprove, onCancel, onError })

        if (!containerRef.current || cancelled) return

        // Clear any leftover button from a prior mount (StrictMode double-invoke)
        containerRef.current.innerHTML = ''
        const btn = document.createElement('paypal-button')
        btn.setAttribute('type', 'pay')
        containerRef.current.appendChild(btn)

        btn.addEventListener('click', () => {
          const orderPromise = Promise.resolve({ orderId })
          void (async () => {
            const modes = ['auto', 'popup', 'modal'] as const
            for (let i = 0; i < modes.length; i++) {
              try {
                await session.start({ presentationMode: modes[i] }, orderPromise)
                return
              } catch (e: unknown) {
                const recoverable = (e as { isRecoverable?: boolean })?.isRecoverable
                if (!recoverable || i === modes.length - 1) {
                  onError(e instanceof Error ? e : new Error(String(e)))
                  return
                }
              }
            }
          })()
        })

        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e.message : String(e))
      }
    }

    void init()
    return () => { cancelled = true }
  }, [clientToken, orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      {!ready && !initError && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Initializing PayPal SDK...</span>
        </div>
      )}
      {initError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span className="font-mono text-xs">{initError}</span>
        </div>
      )}
      {/* Always rendered so containerRef.current is valid during useEffect */}
      <div ref={containerRef} className={ready ? 'w-full max-w-xs' : 'hidden'} />
    </div>
  )
}
