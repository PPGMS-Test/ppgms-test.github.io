// 多套 BYOK 测试凭证。⚠️ 仅限 sandbox，切勿放 live / 生产凭证——这些值会被提交到仓库。
//
// 每套凭证包含：
//   clientId/clientSecret = PSP sandbox 账号自己的 BYOK 凭证
//   bnCodes = 该套凭证下所有可用的 PayPal-Partner-Attribution-Id（BN code），UI 用单选从中选一个生效
//   payerId/payeeEmail = 下游商户的占位标识（同一个下游商户，分别用 Payer ID 和邮箱两种方式标识）
//
// 凭证管理页里选中某套后，clientId/clientSecret/bnCode（默认取 bnCodes[0]）/payerId/payeeEmail 会整体切换。

export interface CredentialPreset {
  id: string
  label: string
  clientId: string
  clientSecret: string
  bnCodes: string[]
  payerId: string
  payeeEmail: string
}

export const CREDENTIAL_PRESETS: CredentialPreset[] = [
  {
    id: 'hkpsp',
    label: 'HKPSP Sandbox',
    clientId:
      'AULEbStcvqq5CAJp4_pjORKKqSKaS5vQDyNbOdi4pdQZEOoR6fKV8jlRgrWJAD-jFwZ4oG8SyWdAbCT7',
    clientSecret:
      'EAz1mD-cXy5rVe_DUfKmhZ6ZicGAQqqTfhLKO7xalTBV_1zniHdEwAsIPLcQVaBcQCFYf5bY3ojY0C9l',
    bnCodes: ['HKPSP'],
    payerId: 'CAWH8CFWQKULW',
    payeeEmail: 'psp-test-2026-hk@test.com',
  },
  {
    id: 'preset-2',
    label: 'TODO：新凭证套',
    clientId: 'TODO_CLIENT_ID',
    clientSecret: 'TODO_CLIENT_SECRET',
    bnCodes: ['TODO_BNCODE'],
    payerId: 'TODO_PAYER_ID',
    payeeEmail: 'TODO_PAYEE_EMAIL',
  },
]

export const DEFAULT_PRESET_ID = CREDENTIAL_PRESETS[0].id

export function getPresetById(id: string): CredentialPreset {
  return CREDENTIAL_PRESETS.find((p) => p.id === id) ?? CREDENTIAL_PRESETS[0]
}
