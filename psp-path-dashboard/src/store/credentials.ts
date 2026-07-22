// src/store/credentials.ts
// BYOK 凭证 store。用户填的值存 sessionStorage（关标签即清）。
// 初始值/reset 取当前激活凭证套（见 store/active-preset.ts + config/credential-presets.ts）。
// bnCode 为 PayPal-Partner-Attribution-Id（BN code），PSP Path 用它做结算路由。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { getPresetById, type CredentialPreset } from '@/config/credential-presets'
import { useActivePresetStore } from './active-preset'

interface CredentialsState {
  clientId: string
  clientSecret: string
  bnCode: string
  setClientId: (v: string) => void
  setClientSecret: (v: string) => void
  setBnCode: (v: string) => void
  applyPreset: (preset: CredentialPreset) => void
  reset: () => void
  isConfigured: () => boolean
  basicAuth: () => string
}

function currentPreset(): CredentialPreset {
  return getPresetById(useActivePresetStore.getState().activePresetId)
}

function presetToFields(preset: CredentialPreset) {
  return { clientId: preset.clientId, clientSecret: preset.clientSecret, bnCode: preset.bnCodes[0].code }
}

export const useCredentialsStore = create<CredentialsState>()(
  persist(
    (set, get) => ({
      ...presetToFields(currentPreset()),
      setClientId: (clientId) => set({ clientId }),
      setClientSecret: (clientSecret) => set({ clientSecret }),
      setBnCode: (bnCode) => set({ bnCode }),
      applyPreset: (preset) => set(presetToFields(preset)),
      reset: () => set(presetToFields(currentPreset())),
      isConfigured: () => Boolean(get().clientId && get().clientSecret),
      basicAuth: () => btoa(`${get().clientId}:${get().clientSecret}`),
    }),
    { name: 'psp-credentials', storage: createJSONStorage(() => sessionStorage) },
  ),
)
