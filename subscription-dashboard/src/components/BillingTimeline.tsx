// subscription-dashboard/src/components/BillingTimeline.tsx
import { Card } from '@/components/ui/Card'
import { computeBillingTimeline } from '@/lib/billing-timeline'
import { useFlowStore } from '@/store/flow'

export function BillingTimeline() {
  const planConfig = useFlowStore((s) => s.planConfig)
  const events = computeBillingTimeline(planConfig)

  return (
    <Card className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-ink">扣款时间线预览</p>
      <ol className="flex flex-col gap-1 text-xs text-muted">
        {events.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-14 shrink-0 font-mono text-ink">Day {e.day}</span>
            <span>{e.label}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}
