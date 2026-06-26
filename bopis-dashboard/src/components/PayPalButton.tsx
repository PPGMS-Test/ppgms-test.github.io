// ============================================================
// components/PayPalButton.tsx — PayPal Web SDK v6 按钮组件
// Loads the PayPal v6 Web SDK, creates a checkout session,
// and renders the <paypal-button> Web Component.
//
// 完整流程：
// Full flow:
//   1. 动态加载 PayPal SDK script（单例，避免重复加载）
//      Dynamically load the SDK script (singleton, no duplicate loads)
//   2. 调用 window.paypal.createInstance() 初始化 SDK
//      Call window.paypal.createInstance() to init the SDK
//   3. 创建一次性支付 session（绑定 onApprove/onCancel/onError 回调）
//      Create a one-time payment session with callbacks
//   4. 动态创建 <paypal-button type="pay"> Web Component 并插入 DOM
//      Dynamically create <paypal-button> and insert into DOM
//   5. 按钮点击时依次尝试 auto → popup → modal 三种呈现模式
//      On button click, try presentation modes: auto → popup → modal
// ============================================================

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'

// PayPal Web SDK v6 沙盒环境的 script URL。
// 生产环境：https://www.paypal.com/web-sdk/v6/core（去掉 sandbox.）
// Sandbox SDK script URL. For production remove "sandbox.":
//   https://www.paypal.com/web-sdk/v6/core
const SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core'

// ── SDK 加载单例 SDK load singleton ─────────────────────────
// 问题：React StrictMode 在开发环境会对每个 effect 执行两次（mount → unmount → mount），
// 如果每次 mount 都创建新的 script 标签，会导致 SDK 重复加载、事件重复绑定。
// Problem: React StrictMode double-invokes effects in dev.
// Without this singleton, each remount would add a new <script> tag.
//
// 解决：用模块级变量 sdkReady 存储加载 Promise，保证全局只加载一次。
// Solution: module-level sdkReady Promise — load happens exactly once.
let sdkReady: Promise<void> | null = null

function ensureSdk(): Promise<void> {
  if (!sdkReady) {
    sdkReady = new Promise<void>((resolve, reject) => {
      // 已加载完成（window.paypal 存在）直接 resolve
      if (window.paypal) { resolve(); return }

      // Script 标签已存在但还未 load 完毕（StrictMode 第二次 mount 可能遇到此情况）
      // Script tag exists but hasn't loaded yet — attach to existing tag's events.
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`)
      if (existing) {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => { sdkReady = null; reject(new Error('SDK load error')) })
        return
      }

      // 首次加载：动态创建 script 标签
      // First load: create the script tag dynamically.
      const s = document.createElement('script')
      s.src = SDK_URL
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { sdkReady = null; reject(new Error('PayPal SDK failed to load')) }
      document.head.appendChild(s)
    })
  }
  return sdkReady
}

interface Props {
  clientToken: string                               // 由 getSandboxClientToken() 获取
  orderId: string                                   // 已创建的 PayPal 订单 ID
  onApprove: (data: { orderId: string }) => Promise<void>  // 买家批准后的回调
  onError: (error: Error) => void                   // SDK 错误回调
  onCancel: () => void                              // 买家取消时的回调
}

export function PayPalButton({ clientToken, orderId, onApprove, onError, onCancel }: Props) {
  // containerRef 始终渲染（通过 hidden 类隐藏），确保 useEffect 执行时 DOM 元素已存在。
  // containerRef div is ALWAYS rendered (hidden until ready) so the ref is never null
  // when the effect runs. Conditional rendering would cause an infinite loading spinner.
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    // cancelled flag：防止组件卸载后异步回调继续更新状态（避免 React 内存泄漏警告）
    // cancelled flag prevents state updates after component unmount (avoids React warnings).
    let cancelled = false

    const init = async () => {
      try {
        // 步骤 1：确保 SDK script 已加载
        await ensureSdk()
        if (cancelled) return

        // 步骤 2：初始化 SDK 实例
        // Step 2: Initialize SDK instance with client token.
        const sdk = await window.paypal!.createInstance({
          clientToken,
          components: ['paypal-payments'],  // 只加载支付组件
          pageType: 'checkout',
        })
        if (cancelled) return

        // 步骤 3：创建一次性支付 Session，绑定回调
        // Step 3: Create payment session with callbacks.
        const session = sdk.createPayPalOneTimePaymentSession({ onApprove, onCancel, onError })

        if (!containerRef.current || cancelled) return

        // 清除上一次 mount 留下的旧按钮（StrictMode double-invoke 导致）
        // Clear any button left by a prior StrictMode remount.
        containerRef.current.innerHTML = ''

        // 步骤 4：创建 PayPal Web Component 按钮
        // Step 4: Create the <paypal-button> Web Component.
        const btn = document.createElement('paypal-button')
        btn.setAttribute('type', 'pay')
        containerRef.current.appendChild(btn)

        // 步骤 5：点击按钮时启动支付，依次 fallback 三种 presentationMode
        // Step 5: On click, try presentation modes in order until one succeeds.
        btn.addEventListener('click', () => {
          // orderPromise：SDK 要求传入一个 Promise<{orderId}>，此处直接 resolve 已有的 ID。
          // SDK expects a Promise<{orderId}>; we resolve immediately since order is pre-created.
          const orderPromise = Promise.resolve({ orderId })

          void (async () => {
            // 呈现模式优先级：auto（SDK自选）→ popup（弹窗）→ modal（遮罩层）
            // Presentation mode priority: auto → popup → modal
            // 若某种模式不可用，SDK 抛出 { isRecoverable: true }，自动尝试下一个。
            // If a mode is unavailable, SDK throws { isRecoverable: true }; try next.
            const modes = ['auto', 'popup', 'modal'] as const
            for (let i = 0; i < modes.length; i++) {
              try {
                await session.start({ presentationMode: modes[i] }, orderPromise)
                return  // 成功后直接退出循环
              } catch (e: unknown) {
                const recoverable = (e as { isRecoverable?: boolean })?.isRecoverable
                // isRecoverable=false 或已是最后一个模式时，报错给上层
                // Non-recoverable or last mode: propagate error to caller.
                if (!recoverable || i === modes.length - 1) {
                  onError(e instanceof Error ? e : new Error(String(e)))
                  return
                }
                // isRecoverable=true：继续循环，尝试下一个模式
              }
            }
          })()
        })

        if (!cancelled) setReady(true)
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e.message : String(e))
      }
    }

    void init()

    // Cleanup：组件卸载时设置 cancelled=true，阻止后续异步操作
    // Cleanup: set cancelled flag so any pending async ops are discarded.
    return () => { cancelled = true }
  }, [clientToken, orderId]) // eslint-disable-line react-hooks/exhaustive-deps
  // 依赖项说明：clientToken 和 orderId 变化时重新初始化按钮。
  // Re-initialize when clientToken or orderId changes.
  // onApprove/onError/onCancel 不加入依赖：这些是 scenario 组件的内联箭头函数，
  // 每次渲染都是新引用，加入会导致无限循环。
  // Callbacks are excluded from deps: they are inline arrow functions that
  // change reference every render — including them would cause infinite re-init.

  return (
    <div className="space-y-2">
      {/* SDK 初始化中的加载提示 Loading spinner while SDK initializes */}
      {!ready && !initError && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Initializing PayPal SDK...</span>
        </div>
      )}

      {/* SDK 加载/初始化失败时的错误提示 Error display on SDK failure */}
      {initError && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span className="font-mono text-xs">{initError}</span>
        </div>
      )}

      {/*
        容器 div 始终渲染（通过 hidden 类控制可见性），
        确保 containerRef.current 在 useEffect 执行时不为 null。
        Always rendered; visibility controlled by CSS class.
        If rendered conditionally, containerRef.current would be null
        during the effect, causing an infinite loading spinner.
      */}
      <div ref={containerRef} className={ready ? 'w-full max-w-xs' : 'hidden'} />
    </div>
  )
}
