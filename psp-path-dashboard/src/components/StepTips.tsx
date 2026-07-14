import { Lightbulb } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { conceptsFor } from '@/lib/concepts'
import { useFlowStore, type StepId } from '@/store/flow'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'

// 每步一句话：这一步在干什么/钱在哪/谁担风险。
const EXPLAIN: Record<StepId, string> = {
  auth: '用 BYOK 凭证换取 OAuth access_token。之后每一步都带着它调用，等价于 Postman 里的第 1 步 Auth。',
  onboarding: '通过 Partner Referral 让商户授权 PSP 代其收款/退款/延迟放款。产出一个商户点击授权的链接。',
  createOrder: '以 CAPTURE intent 建单，payee 指向被授权商户，带 BN code 头。此刻还没扣钱。',
  capture: '捕获订单，买家的钱进入商户 General Ledger（商户余额仍为 $0，等待划给 PSP）。',
  disburse: '用 capture id 触发 referenced-payouts，把钱从商户 GL 划到 PSP 的 PSA（Type 5 账户），日终 sweep 到 PSP 银行账户。',
  refund: '发起退款。PSP Path 下退款由 PSP 承担，且 2.0 保证退款从 PSA 出而非错误扣商户余额。',
}

// 内联小灯泡 + 悬浮提示：不占独立面板/一整行，鼠标悬停才展开讲解与相关概念。
export function StepTips() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const step = STEPS.find((s) => s.id === activeStep)!
  const concepts = conceptsFor(step.conceptKeys)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="这一步的说明" className="inline-flex shrink-0 items-center text-ink/70 hover:text-ink">
          <Lightbulb size={16} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{EXPLAIN[activeStep]}</p>
        {concepts.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            {concepts.map((c) => (
              // justify-between 右侧暂空着——章节号先拿掉，占位留给以后放别的内容
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.title}</span>
              </li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
