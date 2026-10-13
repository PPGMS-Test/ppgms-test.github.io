// subscription-dashboard/src/pages/PlaygroundPage.tsx
import { TopBar } from '@/components/TopBar'
import { StepRail } from '@/components/StepRail'
import { StepDetail } from '@/components/StepDetail'
import { LifecyclePanel } from '@/components/LifecyclePanel'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="shrink-0 overflow-x-auto border-b border-line p-3 lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StepRail />
        </aside>
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <StepDetail />
          <LifecyclePanel />
        </main>
      </div>
    </div>
  )
}
