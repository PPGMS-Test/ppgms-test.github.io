// ============================================================
// types.ts — 全局类型定义
// Global type definitions shared across the BOPIS dashboard.
// ============================================================

// ── 步骤状态 Step status ────────────────────────────────────
// 每个 API 步骤卡片的执行状态，驱动 UI 显示（图标、颜色、disabled）。
// Controls the visual state of each StepCard.
export type StepStatus = 'idle' | 'loading' | 'success' | 'error'

// ── 步骤结果 Step result ────────────────────────────────────
// 每个步骤的完整结果，存储在各 scenario 组件的 useState 里。
// Each field is optional so callers can do partial updates via spread.
export interface StepResult {
  status: StepStatus
  response?: unknown   // PayPal API 返回的原始 JSON body
  error?: string       // 人类可读的错误文本，例如 "HTTP 422"
  debugId?: string     // PayPal 响应头中的 paypal-debug-id，用于联系 PayPal 支持排查
}

// ── 门店地址 Store address ──────────────────────────────────
// 对应 PayPal Order API 中 shipping.address 字段的结构。
// Maps 1:1 to the PayPal v2 Order API shipping.address object.
// 修改地址时只改这里，api.ts 的后端路由会自动带入。
export interface StoreAddress {
  address_line_1: string   // 街道地址
  admin_area_2: string     // 城市 City
  admin_area_1: string     // 州/省缩写 State (e.g. "CA")
  postal_code: string      // 邮编 ZIP code
  country_code: string     // ISO 国家代码 (e.g. "US")
}

// ── PayPal SDK v6 类型 ──────────────────────────────────────
// PayPal Web SDK v6 没有官方的 @types 包，以下是手动推断的接口定义。
// These are manually inferred from the PayPal v6 SDK behavior — not from official types.

/**
 * 一次性支付 Session 对象，由 sdk.createPayPalOneTimePaymentSession() 返回。
 * Represents a single buyer checkout session.
 */
export interface PayPalPaymentSession {
  /**
   * 启动支付弹窗 / App Switch，传入 presentationMode 和 createOrder Promise。
   * Kicks off the payment UX. presentationMode controls how the PayPal window appears:
   *   - 'auto'             → SDK 自动选择最合适的模式
   *   - 'popup'            → 弹出新窗口（桌面默认）
   *   - 'modal'            → 页面内遮罩层（部分设备）
   *   - 'direct-app-switch'→ 跳转到 PayPal App（移动端）
   *
   * 如果某种模式不可用，SDK 会抛出 { isRecoverable: true }，
   * PayPalButton 组件会依次 fallback 到下一个模式。
   * If a mode is unavailable, the SDK throws { isRecoverable: true };
   * PayPalButton falls back to the next mode automatically.
   */
  start(
    opts: { presentationMode: 'auto' | 'popup' | 'modal' | 'direct-app-switch' },
    createOrderPromise: Promise<{ orderId: string }>,
  ): Promise<void>

  // 用于 App Switch 场景判断是否已从 PayPal App 返回（本项目暂未使用）
  // Used in App Switch flows to check if buyer has returned from PayPal App.
  hasReturned(): boolean
  resume(): Promise<void>
}

/**
 * window.paypal.createInstance() 返回的 SDK 实例。
 * The PayPal SDK instance created from the global window.paypal object.
 */
export interface PayPalSDKInstance {
  createPayPalOneTimePaymentSession(opts: {
    onApprove: (data: { orderId: string }) => Promise<void>
    onCancel?: (data: unknown) => void
    onError?: (error: Error) => void
  }): PayPalPaymentSession
}

// ── 全局类型扩展 Global augmentations ───────────────────────
declare global {
  interface Window {
    /**
     * PayPal Web SDK v6 挂载到 window 的全局对象。
     * 加载 https://www.sandbox.paypal.com/web-sdk/v6/core 后可用。
     * Injected by the PayPal v6 SDK script tag.
     */
    paypal?: {
      createInstance(opts: {
        clientToken: string      // 后端通过 /api/auth/sandbox-client-token 获取的 token
        components: string[]     // 需要加载的 SDK 组件，本项目固定为 ['paypal-payments']
        pageType: string         // 页面类型，固定为 'checkout'
      }): Promise<PayPalSDKInstance>
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      // PayPal SDK v6 的自定义 Web Component 按钮元素。
      // 由 PayPalButton 组件通过 document.createElement('paypal-button') 动态创建。
      'paypal-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { type?: string }  // type="pay" 显示支付按钮样式
    }
  }
}
