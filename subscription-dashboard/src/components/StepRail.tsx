// subscription-dashboard/src/components/StepRail.tsx
import { CircleCheck, CircleX, Circle, LoaderCircle } from 'lucide-react'
import { STEPS, type StepId } from '@/lib/steps'
import { useFlowStore, type StepStatus } from '@/store/flow'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<StepStatus, typeof Circle> = {
  idle: Circle,
  running: LoaderCircle,
  success: CircleCheck,
  error: CircleX,
}

const NODE_CLASS: Record<StepStatus, string> = {
  idle: 'border-line text-muted bg-bg',
  running: 'border-accent text-accent bg-bg shadow-[0_0_10px_-1px_var(--accent)]',
  success: 'border-ok bg-ok text-[color:var(--on-accent)] shadow-[0_0_10px_-2px_var(--ok)]',
  error: 'border-danger bg-danger text-[color:var(--on-accent)] shadow-[0_0_10px_-2px_var(--danger)]',
}

export function StepRail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const stepStatus = useFlowStore((s) => s.stepStatus)
  const setActiveStep = useFlowStore((s) => s.setActiveStep)

  return (
    <nav className="relative flex flex-col gap-0.5">
      <div className="absolute bottom-2 left-6 top-2 w-px bg-line" aria-hidden="true" />
      {STEPS.map((step) => {
        const status = stepStatus[step.id as StepId]
        const Icon = STATUS_ICON[status]
        const active = activeStep === step.id
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveStep(step.id)}
            aria-current={active ? 'step' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition',
              active ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2/60 hover:text-ink',
            )}
          >
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition',
                NODE_CLASS[status],
              )}
            >
              <Icon size={13} aria-hidden="true" className={cn(status === 'running' && 'animate-spin')} />
              <span className="sr-only">{status}</span>
            </span>
            <span className="flex-1 truncate">
              <span className="mr-1.5 font-mono text-[11px] text-muted">{String(step.order).padStart(2, '0')}</span>
              {step.title}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
