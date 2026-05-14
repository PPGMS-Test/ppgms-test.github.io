export type ApplePayScenario = 'one-time-basic' | 'one-time-vault' | 'recurring-vault'

export interface ScenarioMeta {
  id: ApplePayScenario
  label: string
  description: string
  badge: string
  badgeColor: 'blue' | 'green' | 'purple'
  requiresVaultId: boolean
  showSavePaymentOption: boolean
}

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
