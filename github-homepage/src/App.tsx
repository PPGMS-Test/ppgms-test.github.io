import { useEffect, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { NavPanel } from './components/NavPanel'
import { SortablePanelGrid, type SortablePanelItem } from './components/SortablePanelGrid'
import { TodoPanel } from './components/TodoPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { usePanelOrder } from './hooks/usePanelOrder'
import type { NavPanelData } from './types'
import navData from './router/nav-data.json'

const BREAKPOINT_COLS = {
  default: 4,
  1400: 3,
  1024: 2,
  640: 1,
}

const PANELS = navData as NavPanelData[]
const TODO_ID = '__todo__'

// Stable colorIndex by panel title — reordering must not shuffle panel colors.
const PANEL_COLOR_INDEX = new Map(PANELS.map((p, i) => [p.title, i]))
const PANEL_BY_TITLE = new Map(PANELS.map(p => [p.title, p]))
const ALL_IDS = [...PANELS.map(p => p.title), TODO_ID]

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  const { orderedIds, setOrder, reset, isCustom } = usePanelOrder(ALL_IDS)

  const sortableItems = useMemo<SortablePanelItem[]>(() => {
    return orderedIds.map(id => {
      if (id === TODO_ID) {
        return {
          id,
          render: drag => (
            <TodoPanel
              dragNodeRef={drag.setNodeRef}
              dragStyle={drag.dragStyle}
              dragHandleProps={drag.dragHandleProps}
              isDragging={drag.isDragging}
            />
          ),
        }
      }
      const panel = PANEL_BY_TITLE.get(id) as NavPanelData
      const colorIndex = PANEL_COLOR_INDEX.get(id) ?? 0
      return {
        id,
        render: drag => (
          <NavPanel
            panel={panel}
            colorIndex={colorIndex}
            dragNodeRef={drag.setNodeRef}
            dragStyle={drag.dragStyle}
            dragHandleProps={drag.dragHandleProps}
            isDragging={drag.isDragging}
          />
        ),
      }
    })
  }, [orderedIds])

  return (
    <>
      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} />

      {isCustom && (
        <button
          type="button"
          className="reset-order-btn"
          onClick={reset}
          title="恢复默认面板顺序"
        >
          <RotateCcw size={13} />
          重置面板顺序
        </button>
      )}

      <main className="page-main">
        <header className="page-header">
          <h1>PayPal GMS SH — 测试页面导航</h1>
          <p>{PANELS.length} 个模块 · 点击任意链接在新标签页打开 · 拖动面板标题可重排</p>
        </header>

        <SortablePanelGrid
          items={sortableItems}
          onOrderChange={setOrder}
          breakpointCols={BREAKPOINT_COLS}
        />
      </main>

      <footer>
        <a href="https://github.com/ppgms-test" target="_blank" rel="noopener noreferrer">
          GitHub: ppgms-test
        </a>
        {' · '}
        PayPal GMS Shanghai 内部测试导航
      </footer>
    </>
  )
}
