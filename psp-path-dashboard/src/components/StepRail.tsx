import { CircleCheck, CircleX, Circle, LoaderCircle } from 'lucide-react'
import { STEP_GROUPS, STEPS } from '@/lib/steps'
import { useFlowStore, type StepId, type StepStatus } from '@/store/flow'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<StepStatus, typeof Circle> = {
  idle: Circle,
  running: LoaderCircle,
  success: CircleCheck,
  error: CircleX,
}
const STATUS_COLOR: Record<StepStatus, string> = {
  idle: 'text-muted',
  running: 'text-ink animate-spin',
  success: 'text-ok',
  error: 'text-accent',
}

export function StepRail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const stepStatus = useFlowStore((s) => s.stepStatus)
  const setActiveStep = useFlowStore((s) => s.setActiveStep)

  return (
    <nav className="flex flex-col gap-4">
      {STEP_GROUPS.map((group) => (
        <div key={group} className="flex flex-col gap-1">
          <div className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">{group}</div>
          {STEPS.filter((s) => s.group === group).map((step) => {
            const status = stepStatus[step.id as StepId]
            const Icon = STATUS_ICON[status]
            const active = activeStep === step.id
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition',
                  active ? 'border-ink bg-ink/5' : 'border-transparent hover:bg-ink/5',
                )}
              >
                <Icon size={16} className={cn('shrink-0', STATUS_COLOR[status])} />
                <span className="flex-1">
                  <span className="font-mono text-xs text-muted">{step.order}.</span> {step.title}
                </span>
                <span className="text-[10px] text-muted">{step.docSection}</span>
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
