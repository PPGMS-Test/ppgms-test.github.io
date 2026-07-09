import { ChevronRight } from 'lucide-react'
import { STEPS, type FundSegment } from '@/lib/steps'
import { useFlowStore } from '@/store/flow'
import { cn } from '@/lib/utils'

const SEGMENTS: { key: Exclude<FundSegment, null>; label: string }[] = [
  { key: 'buyer', label: 'Buyer' },
  { key: 'gl', label: 'Merchant GL' },
  { key: 'psa', label: 'PSA' },
  { key: 'psp', label: 'PSP' },
  { key: 'seller', label: 'Seller' },
]

export function FundFlowBar() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const current = STEPS.find((s) => s.id === activeStep)?.fundSegment ?? null

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-white/40 px-3 py-2 text-xs">
      {SEGMENTS.map((seg, i) => (
        <div key={seg.key} className="flex items-center gap-1">
          <span
            className={cn(
              'rounded px-2 py-1 font-mono transition',
              current === seg.key ? 'bg-accent text-paper' : 'text-muted',
            )}
          >
            {seg.label}
          </span>
          {i < SEGMENTS.length - 1 && <ChevronRight size={12} className="text-line" />}
        </div>
      ))}
    </div>
  )
}
