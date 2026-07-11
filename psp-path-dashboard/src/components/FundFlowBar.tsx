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
    <div className="rounded-lg border border-line bg-white/40 px-4 py-3">
      {/* 标题 */}
      <div className="mb-3 text-xs font-semibold text-ink">
        资金流 — 当前步骤的资金位置
      </div>

      {/* 流条：段 + 箭头 */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-2">
        {FUND_FLOW.map((segment, idx) => {
          const isHighlighted = highlightedIndices.includes(idx)

          return (
            <div key={idx} className="flex items-center gap-2 shrink-0">
              {/* 段 */}
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 transition-all',
                  isHighlighted
                    ? 'border-accent/60 shadow-sm'
                    : 'border-line/30'
                )}
                style={{
                  backgroundColor: isHighlighted
                    ? segment.color
                    : '#f9fafb',
                }}
              >
                <div className="text-xs font-medium text-ink">{segment.label}</div>
                <div className="text-xs text-muted">{segment.description}</div>
              </div>

              {/* 箭头（最后一段后没有） */}
              {idx < FUND_FLOW.length - 1 && (
                <div className="shrink-0">
                  <ArrowRight
                    size={16}
                    className={cn(
                      'transition-colors',
                      highlightedIndices.includes(idx) || highlightedIndices.includes(idx + 1)
                        ? 'text-accent'
                        : 'text-line/30'
                    )}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 步骤说明 */}
      <div className="text-xs text-muted">
        {getStepDescription(activeStep)}
      </div>
    </div>
  )
}
