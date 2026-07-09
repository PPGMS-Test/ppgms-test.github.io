// BYOK 凭证 store。用户填的值存 sessionStorage（关标签即清）。
// 初始值来自 config/default-credentials（默认 HKPSP sandbox 账号，预填方便直接跑）。
// bnCode 为 PayPal-Partner-Attribution-Id（BN code），PSP Path 用它做结算路由。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_CREDENTIALS } from '@/config/default-credentials'

interface CredentialsState {
  clientId: string
  clientSecret: string
  bnCode: string
  setClientId: (v: string) => void
  setClientSecret: (v: string) => void
  setBnCode: (v: string) => void
  reset: () => void
  isConfigured: () => boolean
  basicAuth: () => string
}

const INITIAL = {
  clientId: DEFAULT_CREDENTIALS.clientId,
  clientSecret: DEFAULT_CREDENTIALS.clientSecret,
  bnCode: DEFAULT_CREDENTIALS.bnCode,
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),
      setBnCode: (bnCode) => set({ bnCode }),
      reset: () => set(INITIAL),
      isConfigured: () => Boolean(get().clientId && get().clientSecret),
      basicAuth: () => btoa(`${get().clientId}:${get().clientSecret}`),
    }),
    { name: 'psp-credentials', storage: createJSONStorage(() => sessionStorage) },
  ),
)
