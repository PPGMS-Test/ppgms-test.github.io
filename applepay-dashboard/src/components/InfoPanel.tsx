/**
 * InfoPanel — 场景选择器和配置面板之间的提示条。
 *
 * 作用：
 *   为没有 Apple 测试账号的用户提供参考链接入口，
 *   点击后弹出 Dialog，展示 checkout flow 相关链接。
 *
 * 被使用处：
 *   - src/App.tsx — 渲染在 ScenarioSelector 和 ConfigPanel 之间
 */
import { useState } from 'react'
import { Info, ChevronRight } from 'lucide-react'
import { Dialog, DialogLink } from '@/components/ui/dialog'

export function InfoPanel() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* 触发条 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100/60 transition-colors duration-150 text-left"
      >
        <Info className="h-4 w-4 flex-shrink-0 text-blue-400" />
        <span className="text-sm text-blue-700 flex-1">
          If you don't have a test Apple account — view the checkout flow
        </span>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-300" />
      </button>

      {/* Dialog */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Checkout Flow References"
        description="Useful links to understand the Apple Pay checkout experience."
      >
        <div className="divide-y divide-border">
          {/* 用户后续在这里添加 DialogLink 条目，例如：
          <DialogLink
            href="https://..."
            label="Link title"
            description="Brief description of what this link contains"
          />
          */}
          <DialogLink
            href="#"
            label="Placeholder — content coming soon"
            description="The user will fill in the actual links."
          />
        </div>
      </Dialog>
    </>
  )
}
