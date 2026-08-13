/**
 * Dialog 通用组件。
 *
 * 作用：
 *   - Dialog：Portal 实现的弹窗，支持 ESC / 背景点击关闭，带 scale 淡入动画
 *
 * 被使用处：
 *   - src/components/CreateLinkDialog.tsx — 创建支付链接的表单弹窗
 *
 * ──────────────────────────────────────────────────────
 * 实现原理
 * ──────────────────────────────────────────────────────
 *
 * 1. createPortal — 为什么要用它？
 *    React 默认把组件渲染到它在 JSX 树中所在的位置。
 *    但弹窗必须覆盖整个页面，如果留在原位，父元素的
 *    overflow:hidden 或 z-index 会把它"截断"。
 *    createPortal 把 DOM 节点直接挂到 document.body 下，
 *    完全脱离原来的层级，因此能盖住所有内容。
 *
 *      createPortal(<弹窗JSX>, document.body)
 *
 * 2. ESC 关闭 — useEffect 监听键盘
 *    open 为 true 时注册 keydown 监听；
 *    useEffect 返回的函数是"清除函数"，React 会在：
 *      a) 组件卸载时
 *      b) 下一次 effect 执行前（即 open 变化时）
 *    自动调用它，保证监听器不会泄漏。
 *
 *      useEffect(() => {
 *        if (!open) return           // open=false 时直接跳过，不注册
 *        const fn = (e) => { ... }
 *        document.addEventListener('keydown', fn)
 *        return () => document.removeEventListener('keydown', fn)  // 清除
 *      }, [open])
 *
 * 3. 背景点击关闭
 *    遮罩层是一个覆盖全屏的 <div>，绑 onClick。
 *    弹窗 panel 叠在遮罩上方（z-10 > 遮罩无 z），
 *    点 panel 内部时事件不会冒泡到遮罩，只有点遮罩本身才触发关闭。
 *
 * 4. 入场动画
 *    CSS keyframes 定义在 src/index.css 里：
 *      from { opacity:0; transform:scale(0.95) }
 *      to   { opacity:1; transform:scale(1)    }
 *    Panel 上挂 .animate-dialog-in class。
 *    每次 Dialog 从 null 变成真实 DOM 节点（open:false→true），
 *    class 重新挂载，动画自动从头播放一次。
 *
 * 5. 无障碍（a11y）
 *    - role="dialog" + aria-modal="true"：告知屏幕阅读器这是弹窗
 *    - aria-labelledby={titleId}：将标题 <h2> 与弹窗关联
 *    - useId() 生成唯一 ID，避免多个 Dialog 同时存在时 ID 冲突
 */
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
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
  // useId() 生成一个在整个应用内唯一的字符串 ID，
  // 用于把 <h2> 标题和弹窗的 aria-labelledby 关联起来
  const titleId = useId()

  // ESC 关闭：open 为 true 时注册，open 变为 false 或组件卸载时自动清除
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  // open=false 时返回 null，组件从 DOM 中彻底移除（动画下次打开时重新触发）
  if (!open) return null

  return createPortal(
    // fixed inset-0：覆盖整个视口；flex 居中弹窗
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      {/* 遮罩：absolute inset-0 撑满父容器，点击触发关闭
          backdrop-blur-sm：毛玻璃效果，让背景内容隐约可见 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* 弹窗 Panel：relative z-10 让它叠在遮罩上方
          animate-dialog-in：触发 index.css 里的 scale+opacity 入场动画 */}
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
        {/* 标题行：id 与外层 aria-labelledby 配对 */}
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

        {/* description 可选，不传就不渲染 */}
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}

        {children}
      </div>
    </div>,
    document.body, // ← Portal 挂载目标
  )
}
