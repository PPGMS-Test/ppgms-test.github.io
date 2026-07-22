import { Link } from 'react-router-dom'
import { KeyRound, Workflow } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById } from '@/config/credential-presets'
import { Badge } from '@/components/ui/Badge'

export function TopBar() {
  const isConfigured = useCredentialsStore((s) => s.isConfigured())
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const activePreset = getPresetById(activePresetId)
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper/80 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <Workflow size={20} className="text-ink" />
        <span className="font-semibold">PSP Path Playground</span>
        <Badge tone="muted" className="ml-2">{activePreset.label}</Badge>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1 text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${isConfigured ? 'bg-ok' : 'bg-accent'}`} />
          Sandbox
        </span>
        <Link to="/credentials" className="flex items-center gap-1 rounded-md border border-ink px-3 py-1.5 hover:bg-ink/5">
          <KeyRound size={16} /> 凭证
        </Link>
      </div>
    </header>
  )
}
