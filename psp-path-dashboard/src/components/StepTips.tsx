import { useState } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { conceptsFor } from '@/lib/concepts'
import { useFlowStore, type StepId } from '@/store/flow'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

// 每步一句话：这一步在干什么/钱在哪/谁担风险。
const EXPLAIN: Record<StepId, string> = {
  auth: '用 BYOK 凭证换取 OAuth access_token。之后每一步都带着它调用，等价于 Postman 里的第 1 步 Auth。',
  onboarding: '通过 Partner Referral 让商户授权 PSP 代其收款/退款/延迟放款。产出一个商户点击授权的链接。',
  createOrder: '以 CAPTURE intent 建单，payee 指向被授权商户，带 BN code 头。此刻还没扣钱。',
  capture: '捕获订单，买家的钱进入商户 General Ledger（商户余额仍为 $0，等待划给 PSP）。',
  disburse: '用 capture id 触发 referenced-payouts，把钱从商户 GL 划到 PSP 的 PSA（Type 5 账户），日终 sweep 到 PSP 银行账户。',
  refund: '发起退款。PSP Path 下退款由 PSP 承担，且 2.0 保证退款从 PSA 出而非错误扣商户余额。',
}

export function StepTips() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const step = STEPS.find((s) => s.id === activeStep)!
  const concepts = conceptsFor(step.conceptKeys)
  const [openTips, setOpenTips] = useState(false)

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Lightbulb size={16} className="text-ink" />
        <span className="leading-relaxed">{EXPLAIN[activeStep]}</span>
      </div>
      {concepts.length > 0 && (
        <div className="border-t border-line pt-2">
          <button
            onClick={() => setOpenTips((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink"
          >
            <ChevronRight size={14} className={cn('transition', openTips && 'rotate-90')} />
            相关概念 {concepts.length} 条
          </button>
          {openTips && (
            <div className="mt-2 flex flex-col gap-2">
              {concepts.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.title}</span>
                    <Badge tone="muted">{c.docReferences.join(', ')}</Badge>
                  </div>
                  <p className="whitespace-pre-line text-ink/80">{c.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
