import { TopBar } from '@/components/TopBar'
import { StepRail } from '@/components/StepRail'
import { FundFlowBar } from '@/components/FundFlowBar'
import { StepDetail } from '@/components/StepDetail'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {/* 左：步骤流；中：资金流条 + 请求/响应（讲解以悬浮小灯泡内联在 StepDetail 里，不占独立行）。窄屏塌成单列 */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="shrink-0 overflow-x-auto border-b border-line p-3 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StepRail />
        </aside>
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <FundFlowBar />
          <StepDetail />
        </main>
      </div>
    </div>
  )
}
