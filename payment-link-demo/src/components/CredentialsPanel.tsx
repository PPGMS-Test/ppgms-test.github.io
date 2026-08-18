import { useCredentialsStore } from '@/store/credentials'
import { useFeatureFlagsStore } from '@/store/feature-flags'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { KeyRound, Handshake, Store, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IntegrationRole } from '@/config/credentials.config'

const MODES: Array<{ value: IntegrationRole; label: string; icon: typeof Store }> = [
  { value: 'first-party', label: '1st-party', icon: Store },
  { value: 'third-party', label: '3rd-party', icon: Handshake },
]

/** 只读展示 + 角色(1st/3rd)与预设切换（凭证来自 hardcode config，不在 UI 编辑） */
export function CredentialsPanel() {
  const { presets, mode, selectedId, credential, select, setMode } = useCredentialsStore()
  const imagesEnabled = useFeatureFlagsStore((s) => s.imagesEnabled)
  const toggleImages = useFeatureFlagsStore((s) => s.toggleImages)
  const modePresets = presets.filter((p) => p.mode === mode)
  const missingCreds = !credential.partnerClientId || !credential.partnerClientSecret

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 font-display font-semibold">
        <KeyRound className="h-4 w-4 text-gold" /> API credentials
      </div>

      {/* 集成角色分段切换 */}
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
        {MODES.map((m) => {
          const Icon = m.icon
          const activeMode = mode === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {m.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {mode === 'third-party'
          ? 'Partner 代商户调用，注入 PayPal-Auth-Assertion + BN。需授权关系。'
          : '商户自有凭证直连，不带 auth-assertion，权限齐全即可测通。'}
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <Label htmlFor="cred">Preset</Label>
          <Select id="cred" value={selectedId} onChange={(e) => select(e.target.value)}>
            {modePresets.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </Select>
        </div>

        {missingCreds ? (
          <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
            <span>
              该预设的 client id/secret 尚未填写。请在 <span className="font-mono">src/config/credentials.config.ts</span> 里粘入后再调用。
            </span>
          </div>
        ) : (
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            <dt>env</dt><dd>{credential.environment}</dd>
            <dt>client</dt><dd className="truncate">{credential.partnerClientId.slice(0, 18)}…</dd>
            {credential.mode === 'third-party' && (
              <>
                <dt>merchant</dt><dd>{credential.partnerMerchantId}</dd>
                <dt>assertion</dt><dd className="text-verified">on</dd>
              </>
            )}
            {credential.mode === 'first-party' && (
              <>
                <dt>assertion</dt><dd className="text-muted-foreground">off</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {/* 全局功能开关：PLB 图片两步上传（内部 Q1 2026 能力，feature-flag 门控，公开 sandbox 未部署） */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-gold" />
            <span className="text-sm font-medium text-foreground">Image upload</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={imagesEnabled}
            onClick={toggleImages}
            className={cn(
              'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors',
              imagesEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                imagesEnabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          PLB 图片 API（<span className="font-mono">/payment-resources/images</span> 两步上传）是内部 Q1 2026 能力，
          受 feature flag 门控，<span className="text-foreground">公开 sandbox 未部署（调用会 404）</span>。默认关闭；
          在开了 flag 的内部环境可打开。开启后上传为 best-effort，失败会跳过图片继续建 link。
        </p>
      </div>
    </div>
  )
}
