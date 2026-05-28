/**
 * InfoPanel — 场景选择器和配置面板之间的提示条。
 *
 * 作用：
 *   为没有 Apple 测试账号的用户提供参考链接入口，
 *   点击后弹出 Dialog，展示 checkout flow 相关链接。
 *
 * 被使用处：
 *   - src/App.tsx — 渲染在 ScenarioSelector 和 ConfigPanel 之间
 *
 * ──────────────────────────────────────────────────────
 * 实现原理
 * ──────────────────────────────────────────────────────
 *
 * 状态管理：只有一个 boolean 状态 open，
 *   true  = Dialog 可见
 *   false = Dialog 不渲染（Dialog 内部 open=false 时直接 return null）
 *
 * 数据流向：
 *   InfoPanel 拥有 open 状态
 *     → 把 open 和 setOpen 传给 Dialog（以 onOpenChange 回调形式）
 *     → 触发条的 onClick 把 open 设为 true
 *     → Dialog 内部（ESC/背景/X按钮）把 open 设为 false
 *   这是 React 的"状态提升"模式：子组件不自己管状态，由父组件统一控制。
 *
 * 为什么用 <> </> 空标签包裹？
 *   JSX 要求每个组件只能返回一个根元素。
 *   触发条和 Dialog 是兄弟节点，用 React.Fragment（即 <> </>）包起来，
 *   不会在 DOM 里多生成一个 <div>。
 *
 * 如何添加新链接：
 *   在下方 <div className="divide-y divide-border"> 里加 <DialogLink>：
 *
 *   <DialogLink
 *     href="https://example.com"
 *     label="链接标题"
 *     description="一句话描述这个链接的内容"
 *   />
 *
 *   divide-y 会自动在每两个 DialogLink 之间加一条分隔线。
 */
import { useState } from 'react'
import { Info, ChevronRight } from 'lucide-react'
import { Dialog, DialogLink, DialogVideoLink } from '@/components/ui/dialog'

export function InfoPanel() {
  // open：控制 Dialog 是否显示，初始为 false（关闭）
  const [open, setOpen] = useState(false)

  return (
    // React.Fragment：包裹两个兄弟节点，不产生额外 DOM 元素
    <>
      {/* 触发条
          - w-full：撑满父容器宽度
          - flex items-center gap-3：图标、文字、箭头横向排列，间距 12px
          - text-left：覆盖 button 默认的居中对齐 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100/60 transition-colors duration-150 text-left"
      >
        {/* flex-shrink-0：防止图标在空间不足时被压缩 */}
        <Info className="h-4 w-4 flex-shrink-0 text-blue-400" />

        {/* flex-1：让文字占满中间剩余空间，把箭头推到最右侧 */}
        <span className="text-sm text-blue-700 flex-1">
          More Apple Pay Related Info/If you don't have a test Apple account, view checkout flow record
        </span>

        {/* ml-auto 效果由父 flex-1 的文字撑开，ChevronRight 自然靠右 */}
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-blue-300" />
      </button>

      {/* Dialog：open/onOpenChange 由父组件（InfoPanel）控制
          内部的 ESC、背景点击、X 按钮都通过 onOpenChange(false) 来关闭 */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Checkout Flow References"
        description="Useful links to understand the Apple Pay checkout experience."
      >
        {/* divide-y divide-border：每两个子元素之间自动插入一条 1px 分隔线 */}
        <div className="divide-y divide-border">

          {/* 视频演示 — 静态资源托管于 applepay-dashboard/public/videos/
              视频放好后把 href 里的文件名改成实际文件名 */}
          <DialogVideoLink
            href="/__1__-jsv5-test/ApplePay/videos/checkout-demo.mp4"
            label="Checkout Flow Demo"
            description="Watch the full Apple Pay checkout flow — 无需测试账号"
            fileSize="1.4 MB"
          />

          {/* ↓ 在这里添加普通外链，格式如下：
          <DialogLink
            href="https://..."
            label="链接标题"
            description="一句话描述"
          />
          */}
          <DialogLink
            href="https://developer.apple.com/apple-pay/sandbox-testing/"
            label="Add an Apple Pay Test Card"
            description="You need to add a test card to your Apple Wallet to test the checkout flow. "
          />
          <DialogLink
            href="https://developer.apple.com/documentation/applepayontheweb/applepayrecurringpaymentrequest"
            label="Apple Pay Doc [1]"
            description="ApplePayRecurringPaymentRequest "
          />
          <DialogLink
            href="https://developer.apple.com/documentation/applepayontheweb/applepayrecurringpaymentrequest/regularbilling"
            label="Apple Pay Doc [2]"
            description="RegularBilling "
          />
          <DialogLink
            href="https://developer.apple.com/documentation/applepayontheweb/applepaylineitem"
            label="Apple Pay Doc [3]"
            description="ApplePayLineItem "
          />
        </div>
      </Dialog>
    </>
  )
}
