/**
 * Popover：点击触发的浮层，click-outside / Escape 关闭。无第三方依赖。
 *
 * 用法：
 *   <Popover trigger={<Info className="h-4 w-4" />}>
 *     <PopoverHeader icon={<Info/>} title="How to init a 3rd-party SDK instance" />
 *     <PopoverField label="CLIENT TOKEN" href="https://...">
 *       Pass <code>PayPal-Auth-Assertion</code> when creating the OAuth token.
 *     </PopoverField>
 *   </Popover>
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  /** 触发元素（会被包一层可聚焦按钮） */
  trigger: ReactNode
  children: ReactNode
  /** 浮层相对触发点的水平锚点 */
  align?: 'start' | 'center' | 'end'
  className?: string
  /** 触发按钮的无障碍标签 */
  label?: string
}

export function Popover({ trigger, children, align = 'start', className, label = 'More info' }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors',
          'hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
          open && 'text-brand',
        )}
      >
        {trigger}
      </button>

      {open && (
        <div
          role="dialog"
          className={cn(
            'absolute top-full z-50 mt-2 w-80 origin-top rounded-xl border border-border bg-card p-4 shadow-lg',
            'animate-in fade-in-0 zoom-in-95',
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** 浮层头部：柔色图标圆片 + 标题 */
export function PopoverHeader({ icon, title }: { icon?: ReactNode; title: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon && (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          {icon}
        </span>
      )}
      <span className="font-display text-sm font-semibold text-foreground">{title}</span>
    </div>
  )
}

/**
 * 浮层里的一个字段卡：品牌色小标签 + 可选右上角外链 + 描述。
 * 描述里可直接写 <code>…</code>，已配好等宽底色样式。
 */
export function PopoverField({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: ReactNode
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-3 first:mt-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">{label}</span>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-brand"
            aria-label={`Open ${label} docs`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.7rem] [&_code]:text-foreground">
        {children}
      </p>
    </div>
  )
}
