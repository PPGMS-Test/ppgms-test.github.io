/**
 * Apple Pay 支付按钮组件。
 *
 * 作用：
 *   渲染原生 <apple-pay-button> Web Component（由 Apple Pay JS SDK 注册），
 *   并在其上叠加一个透明的普通 <button> 作为点击代理。
 *
 *   之所以需要透明遮罩层：Web Component 内部使用 Shadow DOM，
 *   其 click 事件不能可靠地冒泡到 React 的合成事件系统，
 *   用普通 DOM button 覆盖后即可正常触发 React onClick。
 *
 * 被使用处：
 *   - src/App.tsx — status === 'ready' 且场景不是 recurring-vault 时渲染，
 *     onPay 回调绑定到 usePaymentFlow 的 startPayment()
 */

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
