// BYOK 凭证 store。存 sessionStorage（关标签即清），不落磁盘、不进代码。
// bnCode 为 PayPal-Partner-Attribution-Id（BN code），PSP Path 用它做结算路由。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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

const INITIAL = { clientId: '', clientSecret: '', bnCode: '' }

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
