/**
 * PayPal API 配置工厂（无 env，全部代码内定义）。
 * createPayPalConfig(env) 产出某环境下的 base URL、PLB 端点与 BN Code。
 */
export type PayPalEnvironment = 'sandbox' | 'production'

export interface PayPalConfig {
  environment: PayPalEnvironment
  apiBase: string
  /** Partner 归因 / revshare 的 BN Code，注入 PayPal-Partner-Attribution-Id 头 */
  bnCode: string
  endpoints: {
    oauthToken: string
    paymentResources: string
    /** 图片两步上传端点：POST 上传 / GET {asset_id} 查状态 / DELETE {asset_id} 删孤立图 */
    paymentResourceImages: string
  }
}

const API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
}

/**
 * BNCODE for p-test-cn-v6-2026-partner@test.com
 */
export const DEFAULT_BN_CODE = 'jsv6_c2_platform'

export function createPayPalConfig(environment: PayPalEnvironment): PayPalConfig {
  return {
    environment,
    apiBase: API_BASE[environment],
    bnCode: DEFAULT_BN_CODE,
    endpoints: {
      oauthToken: '/v1/oauth2/token',
      paymentResources: '/v1/checkout/payment-resources',
      paymentResourceImages: '/v1/checkout/payment-resources/images',
    },
  }
}
