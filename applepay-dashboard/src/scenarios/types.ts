/**
 * scenarios/types.ts
 *
 * 作用：定义三种测试场景的类型和元数据，以及全局货币常量。
 *
 * 使用方：
 *   - src/scenarios/index.ts        — 构建 Apple Pay Payment Request 时判断场景
 *   - src/lib/apple-pay.ts          — 构建 Apple Pay session 时传入场景
 *   - src/lib/api.ts                — 调用后端接口时传入场景
 *   - src/lib/paypal-sdk.ts         — 使用 PAYMENT_CURRENCY 加载 SDK
 *   - src/hooks/usePaymentFlow.ts   — 判断场景决定初始化/支付流程分支
 *   - src/components/ScenarioSelector.tsx — 渲染场景选择卡片
 *   - src/components/ConfigPanel.tsx      — 根据场景显示/隐藏相关配置项
 */

/** 三种测试场景的标识符 */
export type ApplePayScenario = 'one-time-basic' | 'one-time-vault' | 'recurring-vault'

/**
 * 统一货币代码。PayPal JS SDK URL、Apple Pay session、后端 Order body
 * 三处必须保持一致，所以只在这里定义一次。
 */
export const PAYMENT_CURRENCY = 'USD'

/** 场景的 UI 元数据，用于 ScenarioSelector 渲染卡片 */
export interface ScenarioMeta {
  id: ApplePayScenario
  label: string
  description: string
  badge: string
  badgeColor: 'blue' | 'green' | 'purple'
  /** 是否需要在 ConfigPanel 中显示 Vault ID 输入框 */
  requiresVaultId: boolean
  showSavePaymentOption: boolean
}

/** 三种场景的完整定义，顺序即 UI 中的展示顺序 */
export const SCENARIOS: ScenarioMeta[] = [
  {
    id: 'one-time-basic',
    label: '一次性支付',
    description: '标准的 Apple Pay 单次结账流程，不保存支付信息',
    badge: 'One-Time',
    badgeColor: 'blue',
    requiresVaultId: false,
    showSavePaymentOption: false,
  },
  {
    id: 'one-time-vault',
    label: '一次性支付 + Vault',
    description: '单次支付成功后将 Apple Pay 保存到 Vault，用于后续免验证支付',
    badge: 'Vault Save',
    badgeColor: 'green',
    requiresVaultId: false,
    showSavePaymentOption: true,
  },
  {
    id: 'recurring-vault',
    label: '定期支付 (MIT)',
    description: '使用已保存的 Vault ID 发起 Merchant-Initiated Transaction，无需用户交互',
    badge: 'Recurring',
    badgeColor: 'purple',
    requiresVaultId: true,
    showSavePaymentOption: false,
  },
]
