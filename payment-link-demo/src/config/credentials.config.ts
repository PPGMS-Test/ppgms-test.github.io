/**
 * 三方（Partner）凭证配置 —— 全部 hardcode 于此，便于阅读与追加。
 * 追加新凭证：复制数组里的一项，改 id/label/各字段即可。不使用 env。
 */
import type { PayPalEnvironment } from './paypal.config'

export interface PartnerCredential {
  /** 唯一标识，用于选择与 URL */
  id: string
  /** 下拉展示名 */
  label: string
  environment: PayPalEnvironment
  /** Partner 的 client id —— Auth Assertion 的 iss */
  partnerClientId: string
  /** Partner 的 client secret（仅 demo；勿用于生产） */
  partnerClientSecret: string
  /** 被授权商户的 payer id —— Auth Assertion 的 payer_id (sub) */
  partnerMerchantId: string
}

/** 已知可用于疏通的三方凭证；后续在此追加 */
const PARTNER_CREDENTIALS: PartnerCredential[] = [
  {
    id: 'shoppaas-test',
    label: 'shoppaas-test.tt@gmai.com (sandbox)',
    environment: 'sandbox',
    partnerClientId:
      'ATIwW9NdRH9Nqde8MCftI_0QbOL9APdYok0a7ircWl2-3fBHv-CoMYsfIDpcUDisqTHmHT7d0Dz9DV7V',
    partnerClientSecret:
      'EC-Qcp-6LdYoEw9g02iTkVTRHa49c_HLP19P2hxbSHATN3cov2_G-wmFzp5-Cx2gK3phIzrKhOhbLhPJ',
    partnerMerchantId: 'TVARY8GX789ZA',
  },
]

/** Config 工厂：集中提供凭证查询能力 */
export function createCredentialConfig() {
  return {
    all: (): PartnerCredential[] => PARTNER_CREDENTIALS,
    byId: (id: string): PartnerCredential | undefined =>
      PARTNER_CREDENTIALS.find((c) => c.id === id),
    default: (): PartnerCredential => PARTNER_CREDENTIALS[0],
  }
}
