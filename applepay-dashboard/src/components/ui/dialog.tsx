/**
 * Dialog + DialogLink 通用组件。
 *
 * 作用：
 *   - Dialog：Portal 实现的弹窗，支持 ESC / 背景点击关闭，带 scale 淡入动画
 *   - DialogLink：Dialog 内链接条目，带图标、标题、描述
 *
 * 被使用处：
 *   - src/components/InfoPanel.tsx — 展示 checkout flow 参考链接
 */
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Dialog ──────────────────────────────────────────────────────────────────

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 w-full max-w-md',
          'bg-card rounded-2xl shadow-xl border border-border',
          'p-6',
          'animate-dialog-in',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-1">
          <h2 id={titleId} className="text-base font-semibold text-foreground leading-tight">
            {title}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex-shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}

        {children}
      </div>
    </div>,
    document.body,
  )
}

// ── DialogLink ───────────────────────────────────────────────────────────────

interface DialogLinkProps {
  href: string
  label: string
  description?: string
  className?: string
}

export function DialogLink({ href, label, description, className }: DialogLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg',
        'hover:bg-accent/60 transition-colors duration-150',
        className,
      )}
    >
      <ArrowUpRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
    </a>
  )
}
