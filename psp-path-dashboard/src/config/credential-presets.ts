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
  //email-addr: psp-test-hk02@test.com
  //pwd: 12345678
  {
    id: 'yuncong-hk-psp1',
    label: 'psp-psa-hk02',
    clientId: 'Ae-cHHlxYpe7aDw4RPA9MmS0gJl3y2pPQgwkGXmaRdc2NxjiFBQoMbG4m006PirzQ5fVbTPdsAGnrk3I',
    clientSecret: 'EE6S8_AFncCAw-38chvrFRWgJAJv2erxkPMcCVqeT8ISrD3jDZEIxfquenHHoI0obKq5DifxZYyScrZ5',
    bnCodes: [
      //C2, HK merchant
      'testPSPyqBNCODE1',
      //C2, SG merchant
      'testPSPyqBNCODE2'
    ],
    // ********
    payerId: 'AES9BQ3KZHL6L',
    //pwd; 12345678
    payeeEmail: 'psp-test-sg-merchant-01@test.com',
  },
]

export const DEFAULT_PRESET_ID = CREDENTIAL_PRESETS[0].id

export function getPresetById(id: string): CredentialPreset {
  return CREDENTIAL_PRESETS.find((p) => p.id === id) ?? CREDENTIAL_PRESETS[0]
}
