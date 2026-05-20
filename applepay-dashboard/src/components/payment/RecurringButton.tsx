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
import { Button } from '@/components/ui/button'
import type { PaymentFlowConfig } from '@/hooks/usePaymentFlow'

interface RecurringButtonProps {
  config: PaymentFlowConfig
  onPay: (config: PaymentFlowConfig) => void
  loading?: boolean
}

export function RecurringButton({ config, onPay, loading }: RecurringButtonProps) {
  return (
    <div className="space-y-2">
      <Button
        className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white"
        onClick={() => onPay(config)}
        loading={loading}
        size="lg"
      >
        <CreditCard className="h-5 w-5" />
        立即扣款 (MIT Recurring)
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Merchant-Initiated Transaction — 使用已保存的 Vault ID 直接扣款
      </p>
    </div>
  )
}
