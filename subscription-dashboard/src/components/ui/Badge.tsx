import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider', {
  variants: {
    tone: {
      ink: 'border-line text-ink bg-surface2/60',
      accent: 'border-accent/50 text-accent bg-accent/10',
      ok: 'border-ok/50 text-ok bg-ok/10',
      danger: 'border-danger/50 text-danger bg-danger/10',
      muted: 'border-line text-muted',
    },
  },
  defaultVariants: { tone: 'ink' },
})

export function Badge({ tone, className, children }: VariantProps<typeof badge> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>
}
