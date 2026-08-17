/**
 * PayPal 凭证配置 —— 全部 hardcode 于此，便于阅读与追加。
 * 追加新凭证：复制数组里的一项，改 id/label/mode/各字段即可。不使用 env。
 *
 * 两种集成角色(mode)：
 *   - third-party：合作方(Partner)代商户调用，需 `PayPal-Auth-Assertion`(iss=partner client id,
 *     payer_id=被授权商户) + BN Code。要求 partner↔merchant 授权关系已配好，否则 403。
 *   - first-party：商户用自己的 client id/secret 直接调用，**不带 auth-assertion**，
 *     无需授权关系，权限齐全即可跑通。
 */
import type { PayPalEnvironment } from './paypal.config'

export type IntegrationRole = 'first-party' | 'third-party'

export interface PartnerCredential {
  /** 唯一标识，用于选择与 URL */
  id: string
  /** 下拉展示名 */
  label: string
  environment: PayPalEnvironment
  /** 集成角色：决定是否注入 auth-assertion / BN 头 */
  mode: IntegrationRole
  /** client id —— 三方时为 Partner 的(Auth Assertion 的 iss)；一方时为商户自己的 */
  partnerClientId: string
  /** client secret（仅 demo；勿用于生产） */
  partnerClientSecret: string
  /** 被授权商户的 payer id —— 仅三方需要(Auth Assertion 的 payer_id/sub) */
  partnerMerchantId?: string
}

/** 已知可用于疏通的凭证；后续在此追加 */
const PARTNER_CREDENTIALS: PartnerCredential[] = [
  {
    id: 'shoppaas-test',
    label: 'shoppaas-test.tt@gmai.com',
    environment: 'sandbox',
    mode: 'third-party',
    partnerClientId:
      'ATIwW9NdRH9Nqde8MCftI_0QbOL9APdYok0a7ircWl2-3fBHv-CoMYsfIDpcUDisqTHmHT7d0Dz9DV7V',
    partnerClientSecret:
      'EC-Qcp-6LdYoEw9g02iTkVTRHa49c_HLP19P2hxbSHATN3cov2_G-wmFzp5-Cx2gK3phIzrKhOhbLhPJ',
    partnerMerchantId: 'TVARY8GX789ZA',
  },
  {
    // 一方凭证：商户自有 client id/secret，无 auth-assertion，权限齐全即可测通。
    // TODO(用户提供)：把 1st-party 的 client id / secret 粘到下面两行。
    id: 'firstparty-sandbox',
    label: '1st-party merchant',
    environment: 'sandbox',
    mode: 'first-party',
    partnerClientId: '',
    partnerClientSecret: '',
  },
]

/** Config 工厂：集中提供凭证查询能力 */
export function createCredentialConfig() {
  return {
    all: (): PartnerCredential[] => PARTNER_CREDENTIALS,
    byId: (id: string): PartnerCredential | undefined =>
      PARTNER_CREDENTIALS.find((c) => c.id === id),
    byMode: (mode: IntegrationRole): PartnerCredential[] =>
      PARTNER_CREDENTIALS.filter((c) => c.mode === mode),
    /** 某角色下的默认凭证（该角色第一个）；无则回退全局第一个 */
    defaultFor: (mode: IntegrationRole): PartnerCredential =>
      PARTNER_CREDENTIALS.find((c) => c.mode === mode) ?? PARTNER_CREDENTIALS[0],
    default: (): PartnerCredential => PARTNER_CREDENTIALS[0],
  }
}
