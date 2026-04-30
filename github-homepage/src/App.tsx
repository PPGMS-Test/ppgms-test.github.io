import { useState, useEffect } from 'react'
import Masonry from 'react-masonry-css'
import { NavPanel } from './components/NavPanel'
import { TodoPanel } from './components/TodoPanel'
import { ThemeToggle } from './components/ThemeToggle'
import type { NavPanelData } from './types'
import navData from './router/nav-data.json'

const BREAKPOINT_COLS = {
  default: 4,
  1400: 3,
  1024: 2,
  640: 1,
}

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

  const panels = navData as NavPanelData[]

  return (
    <>
      <ThemeToggle isDark={isDark} onToggle={() => setIsDark(d => !d)} />

      <main className="page-main">
        <header className="page-header">
          <h1>PayPal GMS SH — 测试页面导航</h1>
          <p>{panels.length} 个模块 · 点击任意链接在新标签页打开</p>
        </header>

        <Masonry
          breakpointCols={BREAKPOINT_COLS}
          className="masonry-grid"
          columnClassName="masonry-col"
        >
          {panels.map((panel, i) => (
            <NavPanel key={i} panel={panel} colorIndex={i} />
          ))}
          <TodoPanel />
        </Masonry>
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
