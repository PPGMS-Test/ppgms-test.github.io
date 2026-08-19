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
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PopoverProps {
  /** 触发元素（会被包一层可聚焦按钮） */
  trigger: ReactNode
  children: ReactNode
  /** 浮层相对触发点的水平锚点（作为首选，出屏时会自动钳制到视口内） */
  align?: 'start' | 'center' | 'end'
  className?: string
  /** 触发按钮的无障碍标签 */
  label?: string
}

/** 浮层宽度（px），与 className 的 w-80 保持一致，用于视口钳制计算 */
const POPOVER_WIDTH = 320
/** 与触发点、视口边缘之间保留的间距 */
const GAP = 8

export function Popover({ trigger, children, align = 'start', className, label = 'More info' }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  // 依触发点位置计算浮层坐标（fixed 定位）：水平按 align 首选，再钳制进视口；
  // 下方空间不足则翻到上方；极窄视口时宽度也收窄以免溢出。
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect()
      if (!t) return
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const width = Math.min(POPOVER_WIDTH, vw - GAP * 2)
      const h = panelRef.current?.offsetHeight ?? 0

      // 水平：按 align 定首选左端，再钳制到 [GAP, vw - width - GAP]
      let left =
        align === 'end' ? t.right - width : align === 'center' ? t.left + t.width / 2 - width / 2 : t.left
      left = Math.max(GAP, Math.min(left, vw - width - GAP))

      // 垂直：默认放触发点下方；下方放不下且上方更宽裕则翻到上方
      let top = t.bottom + GAP
      if (h && top + h > vh - GAP && t.top - GAP - h > 0) top = t.top - GAP - h

      setPos({ top, left, width })
    }
    place()
    // 面板尺寸测出来后再摆一次（首帧 h=0）
    const raf = requestAnimationFrame(place)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
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
    <>
      <button
        ref={triggerRef}
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

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            style={{
              position: 'fixed',
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: pos?.width ?? POPOVER_WIDTH,
              visibility: pos ? 'visible' : 'hidden',
            }}
            className={cn(
              'z-50 rounded-xl border border-border bg-card p-4 shadow-lg',
              'animate-in fade-in-0 zoom-in-95',
              className,
            )}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
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
