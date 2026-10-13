import { NavLink } from 'react-router-dom'
import { Workflow } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCredentialsStore } from '@/store/credentials'

export function TopBar() {
  const clientId = useCredentialsStore((s) => s.clientId)
  const clientSecret = useCredentialsStore((s) => s.clientSecret)
  const setClientId = useCredentialsStore((s) => s.setClientId)
  const setClientSecret = useCredentialsStore((s) => s.setClientSecret)
  const isConfigured = useCredentialsStore((s) => s.isConfigured())

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/70 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Workflow size={16} />
        </span>
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink">Subscription Playground</span>
      </div>

      <nav className="flex items-center gap-2 text-sm">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn('rounded-full px-3.5 py-1.5 transition', isActive ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2/60 hover:text-ink')
          }
        >
          Playground
        </NavLink>
        <NavLink
          to="/guide"
          className={({ isActive }) =>
            cn('rounded-full px-3.5 py-1.5 transition', isActive ? 'bg-surface2 text-ink' : 'text-muted hover:bg-surface2/60 hover:text-ink')
          }
        >
          Integration Guide
        </NavLink>
      </nav>

      <div className="flex items-center gap-2 text-sm">
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            isConfigured ? 'bg-ok shadow-[0_0_6px_var(--ok)]' : 'bg-danger shadow-[0_0_6px_var(--danger)]',
          )}
        />
        <input
          className="w-36 rounded-lg border border-line bg-surface2 px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent/60"
          placeholder="client_id"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <input
          className="w-36 rounded-lg border border-line bg-surface2 px-2 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent/60"
          placeholder="client_secret"
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
      </div>
    </header>
  )
}
