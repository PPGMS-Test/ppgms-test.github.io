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

/** 测试用凭证(1st and 3rd) */
const PARTNER_CREDENTIALS: PartnerCredential[] = [
  {
    // partner js v6 sandbox（p-test-cn-v6-2026-partner@test.com / payer-id PVQS4XCWAMC72）
    id: 'partner-v6',
    label: 'p-test-cn-v6-2026-partner@test.com',
    environment: 'sandbox',
    mode: 'third-party',
    partnerClientId:
      'AePs-yrCXVsSOXgyI366Of0nlHm4siQdYBTKmQHSOwAaelbWFi836og7nc1y-gKZxROWTNFSV1l7oELW',
    partnerClientSecret:
      'EAvQRspHg3Z5ID5q8u0NY5PmmXVHNJFpEQpqjIoqhUe5iwWQNnZTMpYDSP9LVz_TEwDn7midKulLkRZ4',

    /**
     * 
      email: payment-link@yqtest.com
      pwd: 12345678
     */
    partnerMerchantId: '2Z793HCNQFCS4',
  },
  {
    /**
     * 
      email: payment-link@yqtest.com
      pwd: 12345678
     */
    id: 'firstparty-sandbox',
    label: '1st-party merchant',
    environment: 'sandbox',
    mode: 'first-party',
    partnerClientId:
      'Ae8clZMtGonMbX4-UAGPUv025SVKkFR0DdlK1fFNUXbbqgqLH8jRX-sSBsDevtmrtWv8aBR1q6rSP8mn',
    partnerClientSecret:
      'EG6d3EzkMc6yiQ3Yd4w_S3lgeeSFE3L00oTP86CWRBaZISe9CG57dix5QOq5e4CrdG5d88btGLrUOi9V',
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
