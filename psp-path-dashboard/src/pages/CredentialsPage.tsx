import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { useFlowStore } from '@/store/flow'
import { applyCredentialPreset } from '@/store/apply-preset'
import { CREDENTIAL_PRESETS, getPresetById } from '@/config/credential-presets'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function CredentialsPage() {
  const { clientId, clientSecret, bnCode, setClientId, setClientSecret, setBnCode, reset, isConfigured } =
    useCredentialsStore()
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const activePreset = getPresetById(activePresetId)
  const { payerId, payeeEmail } = useFlowStore((s) => s.config)
  const updateFlowConfig = useFlowStore((s) => s.updateConfig)

  const resetAll = () => {
    reset()
    updateFlowConfig({ payerId: activePreset.payerId, payeeEmail: activePreset.payeeEmail })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted hover:text-accent">
          <ArrowLeft size={16} /> 返回演练台
        </Link>
        <Badge tone={isConfigured() ? 'ok' : 'muted'}>{isConfigured() ? '已配置' : '未配置'}</Badge>
      </div>

      <h1 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink">
        <KeyRound size={20} className="text-accent" /> BYOK 凭证管理
      </h1>
      <p className="text-sm leading-relaxed text-muted">
        选择一套凭证套会整体覆盖 client id / secret / BN code / payer id / payee email；
        修改后的 client id/secret/BN code 存于当前标签页 sessionStorage，选中的凭证套存于 localStorage。
        默认值来自 <code>config/credential-presets.ts</code>（仅限 sandbox）。
        Payer ID / Payee Email 只能在这里修改，各请求步骤详情页里为只读展示。
      </p>

      <Card className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">凭证套</span>
        {CREDENTIAL_PRESETS.map((preset) => (
          <label key={preset.id} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="credential-preset"
              className="accent-[var(--accent)]"
              value={preset.id}
              checked={activePresetId === preset.id}
              onChange={() => applyCredentialPreset(preset.id)}
            />
            {preset.label}
          </label>
        ))}
      </Card>

      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Client ID
          <input
            className="rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="A21..."
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Client Secret
          <input
            className="rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="EC..."
          />
        </label>
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink">BN Code（PayPal-Partner-Attribution-Id）—— {activePreset.label} 可选：</span>
          {activePreset.bnCodes.map((option) => (
            <label key={option.code} className="flex items-center gap-2 text-ink">
              <input
                type="radio"
                name="bn-code"
                className="accent-[var(--accent)]"
                value={option.code}
                checked={bnCode === option.code}
                onChange={() => setBnCode(option.code)}
              />
              {option.code}（{option.country}）
            </label>
          ))}
        </div>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Payee Email（下游商户）
          <input
            className="rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            value={payeeEmail}
            onChange={(e) => updateFlowConfig({ payeeEmail: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink">
          Payer ID（下游商户）
          <input
            className="rounded-lg border border-line bg-surface2 px-3 py-2 font-mono text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
            value={payerId}
            onChange={(e) => updateFlowConfig({ payerId: e.target.value })}
          />
        </label>
        <div className="flex justify-end">
          <Button variant="danger" onClick={resetAll}>
            <Trash2 size={16} /> 清空
          </Button>
        </div>
      </Card>
    </div>
  )
}
