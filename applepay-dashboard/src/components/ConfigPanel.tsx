import { useState } from 'react'
import { Settings, ChevronDown, ChevronRight, KeyRound, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SCENARIOS } from '@/scenarios/types'
import { useCredentialsStore } from '@/store/credentials'
import type { ApplePayScenario } from '@/scenarios/types'
import type { ApplePayCDNVersion } from '@/lib/paypal-sdk'

export interface PaymentConfig {
  scenario: ApplePayScenario
  amount: string
  vaultId: string
  customerId: string
  cdnVersion: ApplePayCDNVersion
}

interface ConfigPanelProps {
  config: PaymentConfig
  onChange: (config: PaymentConfig) => void
  onSubmit: () => void
  loading?: boolean
}

const CDN_OPTIONS: { value: ApplePayCDNVersion; label: string }[] = [
  { value: '1.latest', label: '1.latest (推荐)' },
  { value: 'v1', label: 'v1 (仅 Safari)' },
]

export function ConfigPanel({ config, onChange, onSubmit, loading }: ConfigPanelProps) {
  const set = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) =>
    onChange({ ...config, [key]: value })

  const needsVault = SCENARIOS.find((s) => s.id === config.scenario)?.requiresVaultId ?? false

  const [credsOpen, setCredsOpen] = useState(false)
  const { clientId, clientSecret, setClientId, setClientSecret, reset: resetCreds } =
    useCredentialsStore()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          配置参数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="amount">金额 (USD)</Label>
          <Input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={config.amount}
            onChange={(e) => set('amount', e.target.value)}
          />
        </div>

        {config.scenario !== 'recurring-vault' && (
          <div className="space-y-1.5">
            <Label>Apple Pay CDN 版本</Label>
            <div className="flex gap-2">
              {CDN_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('cdnVersion', opt.value)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
                    config.cdnVersion === opt.value
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-input text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {config.cdnVersion === 'v1' && (
              <p className="text-xs text-amber-600">
                ⚠ 切换到 v1 后如需测试 1.latest 请刷新页面，因为 1.latest 已被缓存
              </p>
            )}
          </div>
        )}

        {needsVault && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="vaultId">Vault ID</Label>
              <Input
                id="vaultId"
                placeholder="4ay47978lf4391843"
                value={config.vaultId}
                onChange={(e) => set('vaultId', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerId">Customer ID</Label>
              <Input
                id="customerId"
                placeholder="BQzraNHpkx"
                value={config.customerId}
                onChange={(e) => set('customerId', e.target.value)}
              />
            </div>
          </>
        )}

        {/* Collapsible credentials section */}
        <div className="rounded-lg border border-dashed border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setCredsOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">PayPal Credentials (Sandbox)</span>
            {credsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          <div className={cn('px-3 pb-3 space-y-3', !credsOpen && 'hidden')}>
            <div className="space-y-1.5">
              <Label htmlFor="cred-client-id" className="text-xs">
                Client ID
              </Label>
              <Input
                id="cred-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="font-mono text-xs h-8"
                placeholder="Client ID"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cred-client-secret" className="text-xs">
                Client Secret
              </Label>
              <Input
                id="cred-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className="font-mono text-xs h-8"
                placeholder="Client Secret"
              />
            </div>
            <button
              type="button"
              onClick={resetCreds}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              恢复 Sandbox 默认值
            </button>
          </div>
        </div>

        <Button className="w-full" onClick={onSubmit} loading={loading} size="lg">
          确认配置并初始化 SDK
        </Button>
      </CardContent>
    </Card>
  )
}
