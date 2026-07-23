import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { useFlowStore } from '@/store/flow'
import { FUND_FLOW } from '@/lib/steps'
import { cn } from '@/lib/utils'

/**
 * 根据当前步骤确定哪些段应该被高亮
 * 返回被高亮的段索引数组
 */
function getHighlightedSegmentIndices(stepId: string): number[] {
  switch (stepId) {
    case 'auth':
    case 'onboarding':
      return [] // 还未涉及资金流
    case 'createOrder':
    case 'capture':
      return [0, 1] // Buyer → PayPal GL
    case 'disburse':
      return [1, 2] // PayPal GL → PSA
    case 'refund':
      return [0, 1] // Buyer ← PayPal GL（退款回流）
    default:
      return []
  }
}

/**
 * 根据步骤获取步骤说明文本
 */
function getStepDescription(stepId: string): string {
  switch (stepId) {
    case 'auth':
      return '步骤 1：获取 access token，还未涉及资金流动'
    case 'onboarding':
      return '步骤 2：注册下游商户，在 PayPal 为其建立虚拟账户'
    case 'createOrder':
      return '步骤 3：创建订单，从买家收款'
    case 'capture':
      return '步骤 4：Capture 完成，资金已在 PayPal GL'
    case 'disburse':
      return '步骤 5：将资金从 PayPal GL 转入下游商户虚拟账户'
    case 'refund':
      return '步骤 6：退款，资金退回买家的原支付方式'
    default:
      return ''
  }
}

export function FundFlowBar() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const highlightedIndices = getHighlightedSegmentIndices(activeStep)

  return (
    <div className="rounded-xl border border-line bg-surface/60 px-4 py-4">
      {/* 标题 */}
      <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]" />
        资金流 · Ledger Trace
      </div>

      {/* 流条：段 + 箭头 */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1">
        {FUND_FLOW.map((segment, idx) => {
          const isHighlighted = highlightedIndices.includes(idx)

          return (
            <div key={idx} className="flex shrink-0 items-center gap-1.5">
              {/* 段 */}
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 transition-all duration-300',
                  isHighlighted ? 'shadow-[0_0_14px_-6px_var(--accent-glow)]' : 'opacity-50',
                )}
                style={{
                  borderColor: isHighlighted ? segment.color : 'var(--line)',
                  backgroundColor: isHighlighted ? `${segment.color}1f` : 'var(--surface-2)',
                  '--accent-glow': segment.color,
                } as CSSProperties}
              >
                <div className="text-xs font-medium" style={{ color: isHighlighted ? segment.color : 'var(--ink)' }}>
                  {segment.label}
                </div>
                <div className="text-[10px] text-muted">{segment.description}</div>
              </div>

              {/* 箭头（最后一段后没有） */}
              {idx < FUND_FLOW.length - 1 && (
                <div className="shrink-0">
                  <ArrowRight
                    size={14}
                    className={cn(
                      'transition-colors',
                      highlightedIndices.includes(idx) || highlightedIndices.includes(idx + 1)
                        ? 'text-accent'
                        : 'text-line',
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 步骤说明 */}
      <div className="text-xs text-muted">{getStepDescription(activeStep)}</div>
    </div>
  )
}
