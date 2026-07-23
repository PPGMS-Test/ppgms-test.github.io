import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface/80 p-4 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]', className)}>
      {children}
    </div>
  )
}
