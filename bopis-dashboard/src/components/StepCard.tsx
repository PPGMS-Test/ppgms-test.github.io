// ============================================================
// components/StepCard.tsx — 单步骤卡片
// Generic step card used in every scenario. Displays:
//   - 步骤编号 + 标题 + 可选 badge  (step number, title, optional badge)
//   - 描述文本                       (description text)
//   - 请求 URL（等宽字体）           (request URL in monospace)
//   - 请求 body（可折叠 JSON 块）     (request body as collapsible JSON)
//   - 执行按钮                       (execute button)
//   - 子组件插槽（PayPal 按钮等）     (children slot for e.g. PayPalButton)
//   - 响应 JSON（成功/失败后显示）    (response JSON after execution)
//   - PayPal debug-id               (debug-id from PayPal response header)
//   - 错误文本                       (error text if failed)
// ============================================================

import { Loader2 } from 'lucide-react'
import type { StepResult } from '@/types'
import { StatusBadge } from './StatusBadge'
import { JsonBlock } from './JsonBlock'

// ── Badge 变体样式 Badge variant styles ─────────────────────
// 在 StepCard 标题旁显示小标签，例如 "Full Capture" / "Partial Capture"。
// Small tag next to the step title, e.g. "Full Capture" / "Partial Capture".
// 新增 variant 时在此对象添加对应 Tailwind 类。
// To add a new variant, add it here with matching Tailwind classes.
const BADGE_STYLES = {
  green: 'bg-green-100 text-green-700 border-green-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  blue:  'bg-blue-100  text-blue-700  border-blue-200',
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface Props {
  number: number       // 步骤序号（圆形蓝色数字徽章）
  title: string        // 步骤标题
  badge?: {
    label: string
    variant: keyof typeof BADGE_STYLES
  }
  description: string  // 步骤说明文字（灰色小字）
  requestUrl?: string  // 显示在 "Request" 标签下的完整 URL（等宽字体）
  requestBody?: unknown // 请求 body，以可折叠 JSON 展示（默认收起）
  result: StepResult   // 当前步骤的执行状态和响应数据
  onExecute?: () => Promise<void> // 点击"执行"按钮时调用；不传则不显示按钮
  disabled?: boolean   // 前置步骤未完成时传 true，卡片变半透明且按钮不可点
  children?: React.ReactNode // 用于插入 PayPalButton 等自定义内容
}

export function StepCard({
  number, title, badge, description,
  requestUrl, requestBody, result,
  onExecute, disabled, children,
}: Props) {
  const isLoading = result.status === 'loading'
  // 可点击条件：未 disabled + 未正在执行 + 有 onExecute 回调
  // Button is clickable when: not disabled, not loading, and handler provided.
  const canExecute = !disabled && !isLoading && onExecute !== undefined

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 transition-opacity ${
        disabled ? 'opacity-40' : ''
        // disabled 时整张卡片半透明，提示用户需先完成前序步骤
        // Semi-transparent when disabled — visually signals dependency on prior steps
      }`}
    >
      {/* ── 标题行 Header row ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 步骤序号圆形徽章 Step number badge */}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {number}
          </span>
          <h3 className="font-semibold text-sm">{title}</h3>
          {/* 可选的类型标签，例如 "Partial Capture" */}
          {/* Optional type badge, e.g. "Partial Capture" */}
          {badge && (
            <span className={`border rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_STYLES[badge.variant]}`}>
              {badge.label}
            </span>
          )}
        </div>
        {/* 右侧状态徽章 Status badge on the right */}
        <StatusBadge status={result.status} />
      </div>

      {/* ── 描述文字 Description ───────────────────────────── */}
      <p className="text-xs text-muted-foreground">{description}</p>

      {/* ── 请求 URL（等宽字体）Request URL ──────────────── */}
      {/* 只在传入 requestUrl 时显示，buyers approval 步骤不显示 */}
      {/* Only shown when requestUrl is provided; approval step omits it */}
      {requestUrl !== undefined && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Request</p>
          <code className="block text-xs font-mono bg-muted px-2 py-1.5 rounded break-all leading-relaxed">
            {requestUrl}
          </code>
        </div>
      )}

      {/* ── 请求 Body（折叠）Request body ─────────────────── */}
      {/* defaultOpen=false：body 默认收起，避免页面过长 */}
      {requestBody !== undefined && (
        <JsonBlock label="Body" data={requestBody} defaultOpen={false} />
      )}

      {/* ── 执行按钮 Execute button ────────────────────────── */}
      {/* onExecute 不传时整个按钮不渲染（例如 Buyer Approval 步骤） */}
      {/* Not rendered when onExecute is absent (e.g. Buyer Approval step) */}
      {onExecute && (
        <button
          onClick={() => void onExecute()}
          disabled={!canExecute}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          执行
        </button>
      )}

      {/* ── 子组件插槽 Children slot ───────────────────────── */}
      {/* 用于插入 PayPalButton 或其他自定义 UI（如 authId 显示框）。 */}
      {/* Slot for custom UI like PayPalButton or info boxes. */}
      {children}

      {/* ── 响应 JSON（默认展开）Response JSON ────────────── */}
      {/* 有 response 数据才显示，默认展开方便直接查看结果 */}
      {/* Only shown when response data exists; defaultOpen=true for quick inspection */}
      {result.response !== undefined && (
        <JsonBlock label="Response" data={result.response} defaultOpen={true} />
      )}

      {/* ── PayPal Debug ID ────────────────────────────────── */}
      {/* 后端从 PayPal 响应头提取并透传，提供给 PayPal 支持排查用 */}
      {/* Forwarded from PayPal response header; provide to PayPal support when filing tickets */}
      {result.debugId && (
        <p className="text-xs text-muted-foreground font-mono">
          <span className="select-none">debug-id: </span>{result.debugId}
        </p>
      )}

      {/* ── 错误信息 Error text ────────────────────────────── */}
      {result.error && (
        <p className="text-xs text-red-600 font-mono">{result.error}</p>
      )}
    </div>
  )
}
