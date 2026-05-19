// Renders the native <apple-pay-button> web component
// Apple Pay session is started via usePaymentFlow — this is purely presentational

import { useRef, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import type { PaymentFlowConfig } from '@/hooks/usePaymentFlow'

interface ApplePayButtonProps {
  config: PaymentFlowConfig
  onPay: (config: PaymentFlowConfig) => void
  disabled?: boolean
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'apple-pay-button': React.HTMLAttributes<HTMLElement> & {
        buttonstyle?: string
        type?: string
        locale?: string
      }
    }
  }
}

export function ApplePayButton({ config, onPay, disabled }: ApplePayButtonProps) {
  const buttonRef = useRef<HTMLElement>(null)

  // React's onClick is unreliable on Web Components — use native addEventListener instead
  useEffect(() => {
    const el = buttonRef.current
    if (!el) return

    const handler = () => {
      if (!disabled) onPay(config)
    }

    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [config, onPay, disabled])

  return (
    <div className="space-y-2">
      <apple-pay-button
        ref={buttonRef}
        buttonstyle="black"
        type="buy"
        locale="en"
        style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
      />
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <AlertCircle className="h-3 w-3" />
        仅在 Safari + Apple 设备上可见
      </p>
    </div>
  )
}
