// ============================================================
// components/JsonBlock.tsx — 可折叠 JSON 展示块
// Collapsible JSON display block with:
//   - 点击 label 展开/收起 (click label to toggle)
//   - 右上角一键复制按钮 (copy-to-clipboard button)
//   - 用户可拖拽调整高度 (user-resizable height via resize-y)
//   - 深色背景 + 细滚动条（.json-scrollbar，定义在 index.css）
// ============================================================

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface Props {
  label: string           // 折叠按钮的文本，例如 "Body" 或 "Response"
  data: unknown           // 任意 JSON 可序列化数据
  defaultOpen?: boolean   // 默认是否展开（Response 块默认展开，Body 块默认折叠）
}

export function JsonBlock({ label, data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  // data 为 undefined 时不渲染任何内容（例如步骤还未执行时 response 为 undefined）
  // Don't render anything if data is undefined (e.g. step not yet executed).
  if (data === undefined) return null

  // 预先序列化，避免复制按钮和 pre 各自调用一次 JSON.stringify。
  // Pre-serialize once; reused by both the <pre> and the copy handler.
  const json = JSON.stringify(data, null, 2)

  // 复制到剪贴板，1.5 秒后图标还原。
  // Copy to clipboard; icon reverts after 1.5 s.
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()  // 防止点击复制按钮时触发父级折叠事件
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="text-xs">
      {/* 折叠控制按钮 — 点击整行切换展开/收起 */}
      {/* Toggle button — clicking anywhere on this row expands/collapses */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>

      {open && (
        <div className="mt-1">
          {/* ── 工具栏（复制按钮）放在 pre 上方，避免与垂直滚动条重叠 */}
          {/* Toolbar placed above <pre> so it doesn't overlap the scrollbar */}
          <div className="flex justify-end bg-slate-900 rounded-t-md px-2 py-1 border-b border-slate-700">
            <button
              onClick={handleCopy}
              title="复制 JSON"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
            >
              {/* 复制成功后短暂显示绿色对勾图标 / Green check shown briefly after copy */}
              {copied
                ? <Check className="h-3.5 w-3.5 text-green-400" />
                : <Copy className="h-3.5 w-3.5" />
              }
            </button>
          </div>

          {/*
            pre 样式说明：
            - h-64        初始高度（不是 max-height！），用户可向下拖拽扩大。
                          Initial height (NOT max-height), user can drag to grow.
            - resize-y    允许用户垂直拖拽改变高度（右下角拖拽手柄）。
                          Allows vertical resize via the bottom-right drag handle.
            - overflow-auto 内容超出时出现滚动条，同时让 resize-y 生效。
                          Enables scrollbar when content overflows; required for resize-y.
            - json-scrollbar 自定义滚动条样式，定义在 src/index.css。
                          Custom scrollbar style defined in src/index.css.
            - rounded-b-md 只有底部圆角，顶部与工具栏无缝衔接。
                          Bottom-only radius; top is flush with the toolbar div.
          */}
          <pre className="json-scrollbar p-3 bg-slate-900 text-slate-100 rounded-b-md overflow-auto min-h-[4rem] h-64 resize-y text-[11px] leading-relaxed">
            {json}
          </pre>
        </div>
      )}
    </div>
  )
}
