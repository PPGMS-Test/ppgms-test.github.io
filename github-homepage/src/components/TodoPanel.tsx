import { useState } from 'react'
import { CheckCircle2, Circle, ClipboardList, ChevronDown, ChevronRight } from 'lucide-react'
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

    // 提取完成日期 ✅ YYYY-MM-DD
    let doneDate: string | undefined
    text = text.replace(/✅\s*(\d{4}-\d{2}-\d{2})/, (_, d) => { doneDate = d; return '' }).trim()

    // 提取优先级 emoji（加 u flag 确保正确匹配 surrogate pair）
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

export function TodoPanel() {
  const items = parseTodo(todoRaw)
  const pending = items.filter(i => !i.done)
  const done = items.filter(i => i.done)
  const [open, setOpen] = useState(false)

  return (
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
            <>
              <div style={{ padding: '6px 16px 2px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                已完成
              </div>
              {done.map((item, i) => <TodoRow key={i} item={item} />)}
            </>
          )}
        </div>
      )}
    </div>
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
