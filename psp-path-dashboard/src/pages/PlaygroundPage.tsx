import { TopBar } from '@/components/TopBar'
import { StepRail } from '@/components/StepRail'
import { FundFlowBar } from '@/components/FundFlowBar'
import { StepDetail } from '@/components/StepDetail'
import { ConceptPanel } from '@/components/ConceptPanel'

export function PlaygroundPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      {/* 桌面三栏；窄屏（<lg）塌缩为单列 */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* 左：步骤流。窄屏时横向可滑 */}
        <aside className="shrink-0 overflow-x-auto border-b border-line p-3 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <StepRail />
        </aside>
        {/* 中：资金流条 + 详情 */}
        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <FundFlowBar />
          <StepDetail />
        </main>
        {/* 右：概念讲解官。窄屏时移到底部 */}
        <aside className="shrink-0 overflow-y-auto border-t border-line p-4 lg:w-80 lg:border-l lg:border-t-0">
          <ConceptPanel />
        </aside>
      </div>
    </div>
  )
}
