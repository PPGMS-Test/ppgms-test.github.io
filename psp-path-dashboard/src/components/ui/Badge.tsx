import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono', {
  variants: {
    tone: {
      ink: 'border-ink text-ink',
      accent: 'border-accent text-accent',
      ok: 'border-ok text-ok',
      muted: 'border-line text-muted',
    },
  },
  defaultVariants: { tone: 'ink' },
})

export function Badge({ tone, className, children }: VariantProps<typeof badge> & { className?: string; children: React.ReactNode }) {
  return <span className={cn(badge({ tone }), className)}>{children}</span>
}
