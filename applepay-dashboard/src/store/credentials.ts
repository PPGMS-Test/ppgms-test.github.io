import { create } from 'zustand'

export type PayPalEnvironment = 'sandbox' | 'production'
export type IntegrationMode = 'merchant' | 'partner'

const SANDBOX_MERCHANT_DEFAULTS = {
  clientId: 'Adz6qoCn9-BQ0tFfWVZBl_rSTyxD0_fpk39E_u2KqT1HoYtN8HTQsSwunpx5Jynk0q8tj1nxUHS-TWlL',
  clientSecret: 'ENCbxo_xFeOFsq4uVGll5gDau005zIVG_c7AeBipt60sqbbOdA6netNgqQjd1DUacHj2QUD-4GFVqcU8',
}

interface CredentialsState {
  // Environment & mode
  environment: PayPalEnvironment
  mode: IntegrationMode

  // 1st-party (merchant) credentials
  clientId: string
  clientSecret: string

  // 3rd-party (partner) credentials
  partnerClientId: string
  partnerClientSecret: string
  partnerMerchantId: string

  // Actions
  setEnvironment: (env: PayPalEnvironment) => void
  setMode: (mode: IntegrationMode) => void
  setClientId: (id: string) => void
  setClientSecret: (secret: string) => void
  setPartnerClientId: (id: string) => void
  setPartnerClientSecret: (secret: string) => void
  setPartnerMerchantId: (id: string) => void
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

/** Returns the active clientId/secret based on current mode */
export function getActiveCredentials() {
  const { mode, clientId, clientSecret, partnerClientId, partnerClientSecret } =
    useCredentialsStore.getState()
  return mode === 'merchant'
    ? { clientId, clientSecret }
    : { clientId: partnerClientId, clientSecret: partnerClientSecret }
}
