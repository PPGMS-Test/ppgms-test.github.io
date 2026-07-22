// 记住"当前用的是哪套测试凭证"，用 localStorage 持久化（跨标签页/重启浏览器都记得）。
// 凭证套本身的详细值（clientId/secret/bnCode/payerId/payeeEmail）不在这里存，
// 那些仍走各自原有的存储方式（sessionStorage / 不持久化），见 credentials.ts 和 flow.ts。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { DEFAULT_PRESET_ID } from '@/config/credential-presets'

interface ActivePresetState {
  activePresetId: string
  setActivePresetId: (id: string) => void
}

export const useActivePresetStore = create<ActivePresetState>()(
  persist(
    (set) => ({
      activePresetId: DEFAULT_PRESET_ID,
      setActivePresetId: (activePresetId) => set({ activePresetId }),
    }),
    { name: 'psp-active-preset', storage: createJSONStorage(() => localStorage) },
  ),
)
