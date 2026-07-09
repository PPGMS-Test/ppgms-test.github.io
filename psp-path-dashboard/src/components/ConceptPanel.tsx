import { useState } from 'react'
import { BookOpen, ChevronRight } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { conceptsFor } from '@/lib/concepts'
import { useFlowStore } from '@/store/flow'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export function ConceptPanel() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const step = STEPS.find((s) => s.id === activeStep)!
  const concepts = conceptsFor(step.conceptKeys)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen size={18} /> 概念讲解官
      </div>
      {concepts.length === 0 && <p className="text-xs text-muted">这一步没有额外概念。</p>}
      {concepts.map((c) => (
        <Card key={c.key} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{c.title}</span>
            <Badge tone="muted">{c.section}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-ink/90">{c.body}</p>
          {c.faqs?.map((f) => {
            const id = `${c.key}:${f.q}`
            const isOpen = open === id
            return (
              <div key={id} className="border-t border-line pt-2">
                <button
                  onClick={() => setOpen(isOpen ? null : id)}
                  className="flex w-full items-center gap-1 text-left text-sm text-ink"
                >
                  <ChevronRight size={14} className={cn('transition', isOpen && 'rotate-90')} />
                  {f.q}
                </button>
                {isOpen && <p className="mt-1 pl-5 text-sm text-muted">{f.a}</p>}
              </div>
            )
          })}
        </Card>
      ))}
    </div>
  )
}
