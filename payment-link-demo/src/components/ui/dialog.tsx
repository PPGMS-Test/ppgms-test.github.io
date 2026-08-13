/**
 * Dialog + DialogLink 通用组件。
 *
 * 作用：
 *   - Dialog：Portal 实现的弹窗，支持 ESC / 背景点击关闭，带 scale 淡入动画
 *   - DialogLink：Dialog 内链接条目，带图标、标题、描述
 *
 * 被使用处：
 *   - src/components/InfoPanel.tsx — 展示 checkout flow 参考链接
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
import { X, ArrowUpRight, Play } from 'lucide-react'
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

// ── DialogLink ───────────────────────────────────────────────────────────────
//
// Tailwind group / group-hover 的用法：
//   父元素加 "group" class，子元素用 "group-hover:xxx" 描述"父被 hover 时自己的样式"。
//   这样鼠标移到整行任意位置，图标和文字都能同时变色，而不需要 JS。
//
//   <a className="group">
//     <Icon className="group-hover:text-blue-500" />   ← 父 hover → 图标变色
//     <span className="group-hover:text-primary" />    ← 父 hover → 文字变色
//   </a>

interface DialogLinkProps {
  href: string
  label: string
  description?: string
  className?: string
}

// ── DialogVideoLink ──────────────────────────────────────────────────────────
//
// 与 DialogLink 的区别：
//   - 图标用 Play（而非 ArrowUpRight），让用户一眼知道"这是视频"
//   - 右侧有可选的 fileSize badge（如 "MP4 · 1.4 MB"）
//   - 其余布局完全兼容 DialogLink，放在同一个 divide-y 列表里不会突兀

interface DialogVideoLinkProps {
  href: string
  label: string
  description?: string
  fileSize?: string  // 可选，显示文件大小提示，如 "1.4 MB"
  className?: string
}

export function DialogVideoLink({ href, label, description, fileSize, className }: DialogVideoLinkProps) {
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
      {/* Play 图标：蓝色圆形背景，视觉上比 ArrowUpRight 更明确"这是视频" */}
      <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
        <Play className="h-2.5 w-2.5 text-blue-500 fill-blue-500" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
            {label}
          </p>
          {/* fileSize badge：灰色小标签，告知用户文件大小，设置预期 */}
          {fileSize && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
              MP4 · {fileSize}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
    </a>
  )
}

export function DialogLink({ href, label, description, className }: DialogLinkProps) {
  return (
    <a
      href={href}
      target="_blank"          // 在新标签页打开
      rel="noopener noreferrer" // 安全属性：防止新页面通过 window.opener 访问当前页
      className={cn(
        'group flex items-start gap-3 py-3 px-2 -mx-2 rounded-lg',
        // -mx-2 配合 px-2：视觉上与列表对齐，hover 背景却能撑满宽度
        'hover:bg-accent/60 transition-colors duration-150',
        className,
      )}
    >
      {/* mt-0.5 让图标与第一行文字垂直对齐；flex-shrink-0 防止图标被压缩 */}
      <ArrowUpRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-400 group-hover:text-blue-500 transition-colors" />
      <div className="min-w-0"> {/* min-w-0 防止长文本撑破弹窗宽度 */}
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
