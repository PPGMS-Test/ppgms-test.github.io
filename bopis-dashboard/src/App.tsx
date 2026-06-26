import { useState } from 'react'
import { ShoppingBag, Scissors, FlaskConical, Ban } from 'lucide-react'
import { StandardFlow } from '@/scenarios/StandardFlow'
import { PartialCapture } from '@/scenarios/PartialCapture'
import { ResearchMultiAddr } from '@/scenarios/ResearchMultiAddr'
import { VoidFlow } from '@/scenarios/VoidFlow'

const TABS = [
  { id: 'standard', label: 'Standard BOPIS', icon: ShoppingBag, component: StandardFlow },
  { id: 'partial', label: 'Partial Capture', icon: Scissors, component: PartialCapture },
  { id: 'research', label: 'Research: 多地址', icon: FlaskConical, component: ResearchMultiAddr },
  { id: 'void', label: 'Void (弃单)', icon: Ban, component: VoidFlow },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [active, setActive] = useState<TabId>('standard')
  const ActiveComponent = TABS.find((t) => t.id === active)!.component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
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

        <div className="flex gap-0 border-b overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
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

        <ActiveComponent />

        <p className="text-center text-xs text-muted-foreground">
          BOPIS Demo · Sandbox Only · PayPal v6 SDK
        </p>
      </div>
    </div>
  )
}
