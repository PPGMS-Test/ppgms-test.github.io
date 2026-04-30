import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, ClipboardList, ChevronDown, ChevronRight, History, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import todoRaw from '../../todo.md?raw'

type Priority = 'high' | 'medium' | 'low'

interface TodoItem {
  text: string
  done: boolean
  priority: Priority
  doneDate?: string  // ✅ YYYY-MM-DD
}

const PRIORITY_COLORS: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

const PRIORITY_LABELS: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const HEADER_COLOR = { bg: '#0f766e', accent: '#f0fdf4' }

// Obsidian Tasks 格式：
//   优先级 emoji：⏫ = high, 🔼 = medium, 🔽 = low（无 emoji 默认 medium）
//   完成日期：✅ YYYY-MM-DD（放在行尾）
function parseTodo(md: string): TodoItem[] {
  const items: TodoItem[] = []

  for (const line of md.split('\n')) {
    const task = line.match(/^-\s+\[(x| )\]\s+(.+)/i)
    if (!task) continue

    const done = task[1].toLowerCase() === 'x'
    let text = task[2].trim()

    let doneDate: string | undefined
    text = text.replace(/✅\s*(\d{4}-\d{2}-\d{2})/, (_, d) => { doneDate = d; return '' }).trim()

    let priority: Priority = 'medium'
    text = text.replace(/[⏫🔼🔽]/u, m => {
      if (m === '⏫') priority = 'high'
      else if (m === '🔽') priority = 'low'
      return ''
    }).trim()

    items.push({ text, done, priority, doneDate: done ? doneDate : undefined })
  }

  return items
}

function HistoryDialog({ items, onClose }: { items: TodoItem[]; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Group by doneDate year-month
  const groups: Record<string, TodoItem[]> = {}
  for (const item of items) {
    const key = item.doneDate ? item.doneDate.slice(0, 7) : '未知时间'
    ;(groups[key] ??= []).push(item)
  }
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="完成历史"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24,
      }}
    >
      <div className="history-dialog-box">
        {/* Header */}
        <div
          style={{
            background: HEADER_COLOR.bg,
            color: '#fff',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <History size={18} />
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>完成历史</span>
          <span style={{ fontSize: 12, opacity: 0.75 }}>{items.length} 条记录</span>
          <button
            onClick={onClose}
            aria-label="关闭"
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'flex',
              alignItems: 'center',
              marginLeft: 8,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {items.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              暂无完成记录
            </div>
          ) : (
            sortedKeys.map(month => (
              <div key={month}>
                <div
                  style={{
                    padding: '8px 18px 4px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: 2,
                  }}
                >
                  {month}
                </div>
                {groups[month].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '9px 18px',
                    }}
                  >
                    <CheckCircle2 size={15} style={{ color: HEADER_COLOR.bg, flexShrink: 0, marginTop: 2 }} />
                    <span style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-color)' }}>
                        {item.text}
                      </span>
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: PRIORITY_COLORS[item.priority],
                        background: `${PRIORITY_COLORS[item.priority]}18`,
                        borderRadius: 4,
                        padding: '2px 6px',
                        flexShrink: 0,
                        alignSelf: 'center',
                      }}
                    >
                      {PRIORITY_LABELS[item.priority]}
                    </span>
                    {item.doneDate && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, alignSelf: 'center' }}>
                        {item.doneDate}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export function TodoPanel() {
  const items = parseTodo(todoRaw)
  const pending = items.filter(i => !i.done)
  const done = items.filter(i => i.done)
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <>
      <div
        style={{
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
          background: `color-mix(in srgb, ${HEADER_COLOR.accent} 80%, var(--card-bg))`,
        }}
      >
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            background: HEADER_COLOR.bg,
            color: '#fff',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <ClipboardList size={20} />
          <span>Todo</span>
          {pending.length > 0 && (
            <span
              style={{
                background: 'rgba(255,255,255,0.25)',
                borderRadius: 999,
                padding: '1px 8px',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {pending.length} 待完成
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>

        {open && (
          <div style={{ padding: '8px 0' }}>
            {pending.map((item, i) => <TodoRow key={i} item={item} />)}
            {done.length > 0 && (
              <div style={{ padding: '6px 16px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 }}>
                  已完成 {done.length} 条
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setHistoryOpen(true) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    color: HEADER_COLOR.bg,
                    background: 'none',
                    border: `1px solid ${HEADER_COLOR.bg}`,
                    borderRadius: 4,
                    padding: '2px 7px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <History size={11} />
                  View All
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {historyOpen && <HistoryDialog items={done} onClose={() => setHistoryOpen(false)} />}
    </>
  )
}

function TodoRow({ item }: { item: TodoItem }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', opacity: item.done ? 0.55 : 1 }}>
      <div style={{ marginTop: 2, color: item.done ? 'var(--text-muted)' : PRIORITY_COLORS[item.priority], flexShrink: 0 }}>
        {item.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
      </div>
      <span
        style={{
          display: 'inline-block',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: PRIORITY_COLORS[item.priority],
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <span style={{ flex: 1 }}>
        <span style={{ fontSize: 13, lineHeight: 1.5, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-muted)' : 'var(--text-color)' }}>
          {item.text}
        </span>
        {item.doneDate && (
          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            ✅ {item.doneDate}
          </span>
        )}
      </span>
    </div>
  )
}
