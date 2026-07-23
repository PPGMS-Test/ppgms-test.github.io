// 记住用户选择的皮肤（深色 ledger / 暖色 paper），跨标签页/重启浏览器都记得。默认深色。
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'psp-theme', storage: createJSONStorage(() => localStorage) },
  ),
)
