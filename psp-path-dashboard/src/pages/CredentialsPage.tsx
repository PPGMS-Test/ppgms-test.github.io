import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft size={16} /> 返回演练台
        </Link>
        <Badge tone={isConfigured() ? 'ok' : 'muted'}>{isConfigured() ? '已配置' : '未配置'}</Badge>
      </div>

      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <KeyRound size={20} /> BYOK 凭证管理
      </h1>
      <p className="text-sm text-muted">
        选择一套凭证套会整体覆盖 client id / secret / BN code / payer id / payee email；
        修改后的 client id/secret/BN code 存于当前标签页 sessionStorage，选中的凭证套存于 localStorage。
        默认值来自 <code>config/credential-presets.ts</code>（仅限 sandbox）。
      </p>

      <Card className="flex flex-col gap-2">
        <span className="text-sm font-medium">凭证套</span>
        {CREDENTIAL_PRESETS.map((preset) => (
          <label key={preset.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="credential-preset"
              value={preset.id}
              checked={activePresetId === preset.id}
              onChange={() => applyCredentialPreset(preset.id)}
            />
            {preset.label}
          </label>
        ))}
      </Card>

      <Card className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Client ID
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="A21..."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Client Secret
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="EC..."
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span>BN Code（PayPal-Partner-Attribution-Id）—— {activePreset.label} 可选：</span>
          {activePreset.bnCodes.map((code) => (
            <label key={code} className="flex items-center gap-2">
              <input
                type="radio"
                name="bn-code"
                value={code}
                checked={bnCode === code}
                onChange={() => setBnCode(code)}
              />
              {code}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <Trash2 size={16} /> 清空
          </Button>
        </div>
      </Card>
    </div>
  )
}
