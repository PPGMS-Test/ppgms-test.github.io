import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-line bg-white/60 p-4 shadow-sm', className)}>
      {children}
    </div>
  )
}
