// Renders the native <apple-pay-button> web component
// Uses an invisible overlay <button> on top because the Web Component's
// Shadow DOM click events don't reliably bubble to the light DOM parent.

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
  return (
    <div className="space-y-2">
      {/* Position wrapper so the overlay can cover the web component exactly */}
      <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
        <apple-pay-button buttonstyle="black" type="buy" locale="en" />

        {/* Transparent button sits on top — normal DOM element, React onClick works */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            console.log('[ApplePayButton] overlay clicked, starting session')
            onPay(config)
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: 'transparent',
            border: 'none',
            padding: 0,
          }}
          aria-label="Pay with Apple Pay"
        />
      </div>

      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <AlertCircle className="h-3 w-3" />
        仅在 Safari + Apple 设备上可见
      </p>
    </div>
  )
}
