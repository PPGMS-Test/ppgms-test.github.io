import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CredentialsState {
  clientId: string
  clientSecret: string
  setClientId: (v: string) => void
  setClientSecret: (v: string) => void
  reset: () => void
  isConfigured: () => boolean
  basicAuth: () => string
}

// Sandbox 测试凭证，仅用于 subscription-dashboard 这个 playground 的演示/测试目的。
const DEFAULT_SANDBOX_CLIENT_ID =
  'BAAsJVdEZmuzwC3YDMTtNwg9oPIpfJWpqOb5tMLwlVrtlETSsJmeIzg8lNEo_vMNHWhHEHDyfy2X_7Lw6g'
const DEFAULT_SANDBOX_CLIENT_SECRET =
  'EOq3gqNa_OildWI-h2K3aPE_FgyD8e1vgyGuERhpYzFKXmKLwiU3gdVmtM-KQcNkrufYyIy0u3KxfmPf'

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      clientId: DEFAULT_SANDBOX_CLIENT_ID,
      clientSecret: DEFAULT_SANDBOX_CLIENT_SECRET,
      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),
      reset: () => set({ clientId: DEFAULT_SANDBOX_CLIENT_ID, clientSecret: DEFAULT_SANDBOX_CLIENT_SECRET }),
      isConfigured: () => Boolean(get().clientId && get().clientSecret),
      basicAuth: () => btoa(`${get().clientId}:${get().clientSecret}`),
    }),
    { name: 'subscription-credentials', storage: createJSONStorage(() => sessionStorage) },
  ),
)
