/**
 * 凭据全局状态管理（Zustand Store）
 *
 * 作用：
 *   集中管理 PayPal API 所需的全部凭据，包括环境（sandbox/production）、
 *   集成模式（一方 merchant / 三方 partner）及对应的 clientId/secret 等字段。
 *
 * 被使用处：
 *   - src/lib/api.ts — credentialHeaders() 从此处读取凭据，拼装请求头
 *   - src/components/ConfigPanel.tsx — UI 直接读写 store 中的各字段
 *   - src/hooks/usePaymentFlow.ts — initialize() 调用 getActiveCredentials() 取 clientId
 */
import { create } from 'zustand'

/** PayPal 环境：沙盒或正式环境 */
export type PayPalEnvironment = 'sandbox' | 'production'
/** 集成模式：一方商户（直连）或三方合作伙伴（代商户发起） */
export type IntegrationMode = 'merchant' | 'partner'

/** Sandbox 一方默认凭据，仅用于开发测试，切换到 production 时会被清空 */
const SANDBOX_MERCHANT_DEFAULTS = {
  clientId: 'Adz6qoCn9-BQ0tFfWVZBl_rSTyxD0_fpk39E_u2KqT1HoYtN8HTQsSwunpx5Jynk0q8tj1nxUHS-TWlL',
  clientSecret: 'ENCbxo_xFeOFsq4uVGll5gDau005zIVG_c7AeBipt60sqbbOdA6netNgqQjd1DUacHj2QUD-4GFVqcU8',
}

/** Zustand store 完整状态结构，包含字段和 action */
interface CredentialsState {
  // 环境与模式
  environment: PayPalEnvironment
  mode: IntegrationMode

  // 一方（merchant）凭据
  clientId: string
  clientSecret: string

  // 三方（partner）凭据；mode==='partner' 时生效
  partnerClientId: string
  partnerClientSecret: string
  /** 被授权商户的 PayPal Merchant ID（payer_id），用于生成 Auth Assertion 请求头 */
  partnerMerchantId: string

  // Actions — 由 ConfigPanel 调用更新对应字段
  setEnvironment: (env: PayPalEnvironment) => void
  setMode: (mode: IntegrationMode) => void
  setClientId: (id: string) => void
  setClientSecret: (secret: string) => void
  setPartnerClientId: (id: string) => void
  setPartnerClientSecret: (secret: string) => void
  setPartnerMerchantId: (id: string) => void
  /** 恢复所有字段到初始默认值 */
  reset: () => void
}

const INITIAL_STATE = {
  environment: 'sandbox' as PayPalEnvironment,
  mode: 'merchant' as IntegrationMode,
  clientId: SANDBOX_MERCHANT_DEFAULTS.clientId,
  clientSecret: SANDBOX_MERCHANT_DEFAULTS.clientSecret,
  // Partner defaults — placeholder values only (same as original HTML)
  partnerClientId: 'test_partner_client_id',
  partnerClientSecret: 'test_partner_secret_key',
  partnerMerchantId: 'test_partner_merchant_id',
}

export const useCredentialsStore = create<CredentialsState>((set) => ({
  ...INITIAL_STATE,
  setEnvironment: (environment) => {
    if (environment === 'production') {
      // Clear merchant credentials — no production defaults provided
      set({ environment, clientId: '', clientSecret: '' })
    } else {
      // Restore sandbox defaults when switching back
      set({ environment, clientId: SANDBOX_MERCHANT_DEFAULTS.clientId, clientSecret: SANDBOX_MERCHANT_DEFAULTS.clientSecret })
    }
  },
  setMode: (mode) => set({ mode }),
  setClientId: (clientId) => set({ clientId }),
  setClientSecret: (clientSecret) => set({ clientSecret }),
  setPartnerClientId: (partnerClientId) => set({ partnerClientId }),
  setPartnerClientSecret: (partnerClientSecret) => set({ partnerClientSecret }),
  setPartnerMerchantId: (partnerMerchantId) => set({ partnerMerchantId }),
  reset: () => set(INITIAL_STATE),
}))

/**
 * 根据当前 mode 返回实际生效的 clientId/secret。
 * - merchant 模式：返回一方凭据
 * - partner 模式：返回三方 Partner 凭据
 * 被 api.ts 的 credentialHeaders() 和 usePaymentFlow 的 initialize() 调用。
 */
export function getActiveCredentials() {
  const { mode, clientId, clientSecret, partnerClientId, partnerClientSecret } =
    useCredentialsStore.getState()
  return mode === 'merchant'
    ? { clientId, clientSecret }
    : { clientId: partnerClientId, clientSecret: partnerClientSecret }
}
