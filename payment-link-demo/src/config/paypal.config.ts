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
  }
}

const API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  production: 'https://api-m.paypal.com',
}

/** 默认 BN Code；真实商用需向 PayPal 申请专属值，此处为 demo 占位 */
export const DEFAULT_BN_CODE = 'PAYLINKDEMO_SP_PPCP'

export function createPayPalConfig(environment: PayPalEnvironment): PayPalConfig {
  return {
    environment,
    apiBase: API_BASE[environment],
    bnCode: DEFAULT_BN_CODE,
    endpoints: {
      oauthToken: '/v1/oauth2/token',
      paymentResources: '/v1/checkout/payment-resources',
    },
  }
}
