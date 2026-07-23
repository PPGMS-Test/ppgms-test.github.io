import { Link } from 'react-router-dom'
import { KeyRound, Moon, Sun, Workflow } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { useThemeStore } from '@/store/theme'
import { getPresetById } from '@/config/credential-presets'
import { Badge } from '@/components/ui/Badge'

export function TopBar() {
  const isConfigured = useCredentialsStore((s) => s.isConfigured())
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const activePreset = getPresetById(activePresetId)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  return (
    <header className="flex items-center justify-between border-b border-line bg-surface/70 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Workflow size={16} />
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink">PSP Path Playground</span>
        <Badge tone="muted">{activePreset.label}</Badge>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-muted">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isConfigured ? 'bg-ok shadow-[0_0_6px_var(--ok)]' : 'bg-danger shadow-[0_0_6px_var(--danger)]'
            }`}
          />
          Sandbox
        </span>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? '切换为暖色皮肤' : '切换为深色皮肤'}
          title={theme === 'dark' ? '切换为暖色皮肤' : '切换为深色皮肤'}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink transition hover:border-accent/50 hover:bg-surface2"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <Link
          to="/credentials"
          className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-ink transition hover:border-accent/50 hover:bg-surface2"
        >
          <KeyRound size={14} /> 凭证
        </Link>
      </div>
    </header>
  )
}
