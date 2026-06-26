import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core'

interface Props {
  clientToken: string
  onCreateOrder: () => Promise<{ orderId: string }>
  onApprove: (data: { orderId: string }) => Promise<void>
  onError: (error: Error) => void
  onCancel: () => void
}

export function PayPalButton({ clientToken, onCreateOrder, onApprove, onError, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const sdkInstance = await window.paypal!.createInstance({
          clientToken,
          components: ['paypal-payments'],
          pageType: 'checkout',
        })

        if (cancelled) return

        const session = sdkInstance.createPayPalOneTimePaymentSession({
          onApprove,
          onCancel,
          onError,
        })

        if (!containerRef.current) return

        const btn = document.createElement('paypal-button')
        btn.setAttribute('type', 'pay')
        containerRef.current.appendChild(btn)

        btn.addEventListener('click', () => {
          void session
            .start({ presentationMode: 'auto' }, onCreateOrder())
            .catch((e: unknown) => onError(e instanceof Error ? e : new Error(String(e))))
        })

        setReady(true)
      } catch (e) {
        if (!cancelled) setInitError(String(e))
      }
    }

    const loadAndInit = () => {
      if (window.paypal) {
        void init()
        return
      }
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
      if (existing) {
        existing.addEventListener('load', () => void init())
        existing.addEventListener('error', () => setInitError('SDK script failed to load'))
        return
      }
      const script = document.createElement('script')
      script.src = SDK_URL
      script.async = true
      script.addEventListener('load', () => void init())
      script.addEventListener('error', () => setInitError('SDK script failed to load'))
      document.head.appendChild(script)
    }

    loadAndInit()
    return () => { cancelled = true }
  }, [clientToken]) // eslint-disable-line react-hooks/exhaustive-deps

  if (initError) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span className="font-mono text-xs">{initError}</span>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading PayPal SDK...</span>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full max-w-xs" />
}
