// Button for Merchant-Initiated recurring payments (no Apple Pay session required)
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
