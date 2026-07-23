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

// 节点样式：idle=空心环，running=金色脉冲（电流正流经此处），success/error=实心点亮
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
    <nav className="flex flex-col gap-6">
      {STEP_GROUPS.map((group) => {
        const groupSteps = STEPS.filter((s) => s.group === group)
        return (
          <div key={group} className="flex flex-col gap-1">
            <div className="px-3 pb-1 text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted">
              {group}
            </div>
            {/* 一条贯穿本组所有步骤的导线：完成的节点实心点亮，像电流已流经 */}
            <div className="relative flex flex-col gap-0.5">
              <div className="absolute bottom-2 left-6 top-2 w-px bg-line" aria-hidden="true" />
              {groupSteps.map((step) => {
                const status = stepStatus[step.id as StepId]
                const Icon = STATUS_ICON[status]
                const active = activeStep === step.id
                return (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
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
                      <Icon size={13} className={cn(status === 'running' && 'animate-spin')} />
                    </span>
                    <span className="flex-1 truncate">
                      <span className="mr-1.5 font-mono text-[11px] text-muted">
                        {String(step.order).padStart(2, '0')}
                      </span>
                      {step.title}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}
