/**
 * MIT 定期扣款按钮组件（recurring-vault 场景专用）。
 *
 * 作用：
 *   为 recurring-vault 场景提供一个普通的触发按钮。
 *   与 ApplePayButton 不同，此场景无需弹出 Apple Pay 面板，
 *   直接调用后端 API 用已保存的 Vault ID 发起 MIT 扣款。
 *
 * 被使用处：
 *   - src/App.tsx — status === 'ready' 且 scenario === 'recurring-vault' 时渲染，
 *     onPay 回调绑定到 usePaymentFlow 的 startRecurringPayment()
 */
import { CreditCard } from 'lucide-react'
import type { PaymentFlowConfig } from '@/hooks/usePaymentFlow'

interface RecurringButtonProps {
  config: PaymentFlowConfig
  onPay: (config: PaymentFlowConfig) => void
  loading?: boolean
}

export function RecurringButton({ config, onPay, loading }: RecurringButtonProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={loading}
        onClick={() => onPay(config)}
        className={[
          'relative w-full h-14 px-6 rounded-xl overflow-hidden',
          'flex items-center justify-center gap-2.5',
          'font-semibold text-base text-white tracking-wide',
          'bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800',
          'ring-1 ring-purple-400/30',
          'shadow-[0_4px_16px_0_rgba(109,40,217,0.45)]',
          'hover:from-violet-500 hover:via-purple-600 hover:to-indigo-700',
          'hover:shadow-[0_6px_24px_0_rgba(109,40,217,0.65)]',
          'hover:ring-purple-400/60 hover:scale-[1.02]',
          'active:scale-[0.97] active:shadow-[0_2px_8px_0_rgba(109,40,217,0.4)]',
          'transition-all duration-200 ease-out',
          'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none disabled:scale-100',
        ].join(' ')}
      >
        {/* shimmer overlay */}
        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 pointer-events-none" />
        {loading ? (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <CreditCard className="h-5 w-5" />
        )}
        立即扣款 (MIT Recurring)
      </button>
      <p className="text-xs text-center text-muted-foreground">
        Merchant-Initiated Transaction — 使用已保存的 Vault ID 直接扣款
      </p>
    </div>
  )
}
