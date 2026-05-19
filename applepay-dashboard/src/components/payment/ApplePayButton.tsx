// Renders the native <apple-pay-button> web component
// Apple Pay session is started via usePaymentFlow — this is purely presentational

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
  // Wrap in a plain <div> so React's onClick works reliably.
  // The <apple-pay-button> web component uses Shadow DOM — click events
  // inside it bubble through the shadow boundary and reach the parent div.
  return (
    <div className="space-y-2">
      <div
        onClick={() => {
          if (!disabled) {
            console.log('[ApplePayButton] clicked, starting payment session')
            onPay(config)
          }
        }}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <apple-pay-button
          buttonstyle="black"
          type="buy"
          locale="en"
          style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        />
      </div>
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <AlertCircle className="h-3 w-3" />
        仅在 Safari + Apple 设备上可见
      </p>
    </div>
  )
}
