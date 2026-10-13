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

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      clientId: '',
      clientSecret: '',
      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),
      reset: () => set({ clientId: '', clientSecret: '' }),
      isConfigured: () => Boolean(get().clientId && get().clientSecret),
      basicAuth: () => btoa(`${get().clientId}:${get().clientSecret}`),
    }),
    { name: 'subscription-credentials', storage: createJSONStorage(() => sessionStorage) },
  ),
)
