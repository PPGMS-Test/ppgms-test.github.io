// ============================================================
// App.tsx — 根组件，管理顶部 Tab 导航
// Root component. Renders the top-level tab navigation and
// mounts the active scenario component.
// ============================================================

import { useState } from 'react'
import { ShoppingBag, Scissors, FlaskConical, Ban } from 'lucide-react'
import { StandardFlow } from '@/scenarios/StandardFlow'
import { PartialCapture } from '@/scenarios/PartialCapture'
import { ResearchMultiAddr } from '@/scenarios/ResearchMultiAddr'
import { VoidFlow } from '@/scenarios/VoidFlow'

// localStorage 中存储当前激活 Tab 的键名。
// localStorage key for persisting the active tab across page refreshes.
const TAB_STORAGE_KEY = 'bopis-dashboard-active-tab'

// ── Tab 配置表 Tab registry ──────────────────────────────────
// 新增 tab 时只需在此数组末尾加一条记录，其余代码自动适配。
// To add a new tab, append an entry here — everything else adapts automatically.
const TABS = [
  { id: 'standard',  label: 'Standard BOPIS',   icon: ShoppingBag,  component: StandardFlow      },
  { id: 'partial',   label: 'Partial Capture',   icon: Scissors,     component: PartialCapture    },
  { id: 'research',  label: 'Research: 多地址',   icon: FlaskConical, component: ResearchMultiAddr },
  { id: 'void',      label: 'Void (弃单)',         icon: Ban,          component: VoidFlow          },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  // ── Tab 状态，带 localStorage 持久化 ─────────────────────
  // 初始值从 localStorage 恢复；若存储的值非法（删除 localStorage 后 fallback）则用 'standard'。
  // Initial value is restored from localStorage; falls back to 'standard' on invalid values.
  const [active, setActive] = useState<TabId>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY)
    return (TABS.some((t) => t.id === saved) ? saved : 'standard') as TabId
  })

  // 切换 Tab 时同步写入 localStorage，刷新后自动恢复。
  // Switching tabs persists the choice to localStorage for next page load.
  const switchTab = (id: TabId) => {
    setActive(id)
    localStorage.setItem(TAB_STORAGE_KEY, id)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* ── 顶部标题区 Header ─────────────────────────────── */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">PayPal BOPIS 测试面板</h1>
          <p className="text-sm text-muted-foreground">Buy Online Pick Up In Store — Sandbox</p>
          <p className="text-xs text-muted-foreground">
            后端:{' '}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">
              ppgms-test-github-io.pages.dev
            </code>
          </p>
        </div>

        {/* ── Tab 导航栏 Tab navigation ─────────────────────── */}
        {/* overflow-x-auto 保证窄屏下 tab 可横向滚动。 */}
        {/* overflow-x-auto allows horizontal scrolling on narrow screens. */}
        <div className="flex gap-0 border-b overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => switchTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                active === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Scenario 内容区 Scenario panels ──────────────── */}
        {/*
          所有 tab 内容同时渲染，非激活的用 hidden 隐藏。
          All scenarios are mounted simultaneously; inactive ones are hidden via CSS.
          这样切换 tab 时不会丢失已完成的步骤状态（useState 保留在内存中）。
          This preserves step state when switching tabs — no state reset on tab switch.

          如果改为条件渲染（{active === id && <Component />}），
          切换 tab 后回来状态会全部重置。
          Switching to conditional rendering would reset all step state on tab change.
        */}
        {TABS.map(({ id, component: Component }) => (
          <div key={id} className={id === active ? '' : 'hidden'}>
            <Component />
          </div>
        ))}

        {/* ── 底部说明 Footer ───────────────────────────────── */}
        <p className="text-center text-xs text-muted-foreground">
          BOPIS Demo · Sandbox Only · PayPal v6 SDK
        </p>

      </div>
    </div>
  )
}
