import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Trash2 } from 'lucide-react'
import { useCredentialsStore } from '@/store/credentials'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export function CredentialsPage() {
  const { clientId, clientSecret, bnCode, setClientId, setClientSecret, setBnCode, reset, isConfigured } =
    useCredentialsStore()

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
        已预填默认 <b>HKPSP</b> sandbox 账号，可直接用或改成自己的 PSP <b>sandbox</b> client id / secret 与 BN code。
        修改后的值存于当前标签页 sessionStorage；默认值来自 <code>config/default-credentials.ts</code>（仅限 sandbox）。
      </p>

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
        <label className="flex flex-col gap-1 text-sm">
          BN Code（PayPal-Partner-Attribution-Id，可选）
          <input
            className="rounded border border-line bg-white px-3 py-2 font-mono text-sm"
            value={bnCode}
            onChange={(e) => setBnCode(e.target.value)}
            placeholder="XXXXXXXX_PSP"
          />
        </label>
        <div className="flex justify-end">
          <Button variant="outline" onClick={reset}>
            <Trash2 size={16} /> 清空
          </Button>
        </div>
      </Card>
    </div>
  )
}
