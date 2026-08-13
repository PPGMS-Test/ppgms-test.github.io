/**
 * 全局明暗主题 store（持久化到 localStorage）。
 * 首次访问无存储值时，取系统偏好（prefers-color-scheme）作为默认。
 * 主题的实际应用在 App.tsx：根据 theme 给 <html> 加/去 `dark` class。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark'

/** 读取系统配色偏好；SSR / 无 matchMedia 时回退 light */
function systemPreference(): Theme {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: systemPreference(),
      setTheme: (theme) => set({ theme }),
      toggle: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: 'paylink-demo-theme' },
  ),
)
