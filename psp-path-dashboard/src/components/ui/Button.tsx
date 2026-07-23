import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-[color:var(--on-accent)] font-semibold hover:brightness-110 active:brightness-95',
        outline: 'border border-line text-ink hover:border-accent/50 hover:bg-surface2',
        ghost: 'text-muted hover:text-ink hover:bg-surface2',
        danger: 'border border-danger/40 text-danger hover:bg-danger/10',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export function Button({
  variant,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>) {
  return <button className={cn(button({ variant }), className)} {...props} />
}
