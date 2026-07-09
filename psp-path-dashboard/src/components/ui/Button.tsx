import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:opacity-90',
        outline: 'border border-ink text-ink hover:bg-ink/5',
        ghost: 'text-ink hover:bg-ink/5',
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
