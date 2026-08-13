import { useCredentialsStore } from '@/store/credentials'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { KeyRound } from 'lucide-react'

/** 只读展示 + 预设切换（凭证来自 hardcode config，不在 UI 编辑） */
export function CredentialsPanel() {
  const { presets, selectedId, credential, select } = useCredentialsStore()
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 font-display font-semibold">
        <KeyRound className="h-4 w-4 text-gold" /> Partner credentials
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="cred">Preset</Label>
          <Select id="cred" value={selectedId} onChange={(e) => select(e.target.value)}>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </div>
        <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <dt>env</dt><dd>{credential.environment}</dd>
          <dt>client</dt><dd className="truncate">{credential.partnerClientId.slice(0, 18)}…</dd>
          <dt>merchant</dt><dd>{credential.partnerMerchantId}</dd>
        </dl>
      </div>
    </div>
  )
}
