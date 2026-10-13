import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? '切换到深色模式' : '切换到浅色模式'}
      aria-pressed={isLight}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition hover:border-accent/50 hover:text-ink"
    >
      {isLight ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  )
}
