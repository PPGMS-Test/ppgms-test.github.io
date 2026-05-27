/**
 * 配置面板组件。
 *
 * 作用：
 *   提供支付所需的全部参数配置 UI，包括：
 *   - 金额输入
 *   - Apple Pay CDN 版本切换（非 recurring 场景）
 *   - Vault ID / Customer ID 输入（requiresVaultId 场景）
 *   - 可折叠凭据区：环境（sandbox/production）、集成模式、clientId/secret 等
 *   点击"确认配置并初始化 SDK"按钮触发 onSubmit，由 App.tsx 调用 initialize()。
 *
 * 被使用处：
 *   - src/App.tsx — 在未完成支付时持续显示，允许用户修改配置后重试
 *
 * 凭据字段直接读写 src/store/credentials.ts 的 Zustand store，
 * 其余字段（amount / vaultId / cdnVersion 等）通过 onChange(config) 回传给 App。
 */
import { useState } from 'react'
import { Settings, ChevronDown, ChevronRight, KeyRound, RotateCcw, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SCENARIOS } from '@/scenarios/types'
import { useCredentialsStore } from '@/store/credentials'
import type { ApplePayScenario } from '@/scenarios/types'
import type { ApplePayCDNVersion } from '@/lib/paypal-sdk'
import type { PayPalEnvironment, IntegrationMode, ApiRequestMode } from '@/store/credentials'

/** 面板管理的完整配置对象，由 App.tsx 维护并通过 onChange 回传 */
export interface PaymentConfig {
  scenario: ApplePayScenario
  amount: string
  /** 仅 one-time-vault / recurring-vault 场景需要填写 */
  vaultId: string
  /** 仅 recurring-vault 场景需要填写 */
  customerId: string
  cdnVersion: ApplePayCDNVersion
}

interface ConfigPanelProps {
  config: PaymentConfig
  /** 任意字段变更时回调，App.tsx 用新 config 替换旧值 */
  onChange: (config: PaymentConfig) => void
  /** 点击"确认配置并初始化 SDK"按钮时触发，由 App.tsx 调用 initialize() */
  onSubmit: () => void
  /** 初始化进行中时显示按钮 loading 状态 */
  loading?: boolean
}

const CDN_OPTIONS: { value: ApplePayCDNVersion; label: string }[] = [
  { value: '1.latest', label: '1.latest (推荐)' },
  { value: 'v1', label: 'v1 (仅 Safari)' },
]

/**
 * 通用切换按钮组，用于 环境/模式/CDN版本 等二选一或多选一场景。
 * 当前选中项高亮显示，点击即切换。
 */
function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 rounded-md border px-3 py-2 text-sm transition-colors',
            value === opt.value
              ? 'border-primary bg-primary/5 text-primary font-medium'
              : 'border-input text-muted-foreground hover:border-primary/50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function ConfigPanel({ config, onChange, onSubmit, loading }: ConfigPanelProps) {
  const set = <K extends keyof PaymentConfig>(key: K, value: PaymentConfig[K]) =>
    onChange({ ...config, [key]: value })

  const needsVault = SCENARIOS.find((s) => s.id === config.scenario)?.requiresVaultId ?? false

  const [credsOpen, setCredsOpen] = useState(false)
  const {
    environment, mode, apiRequestMode, proxyPostSession,
    lastVaultId, lastCustomerId,
    clientId, clientSecret,
    partnerClientId, partnerClientSecret, partnerMerchantId,
    setEnvironment, setMode, setApiRequestMode, setProxyPostSession,
    setClientId, setClientSecret,
    setPartnerClientId, setPartnerClientSecret, setPartnerMerchantId,
    reset: resetCreds,
  } = useCredentialsStore()

  // 切换到 recurring-vault 时，若 store 有上次 vault 信息则自动填入
  const handleScenarioChange = (scenario: ApplePayScenario) => {
    if (scenario === 'recurring-vault' && lastVaultId) {
      onChange({ ...config, scenario, vaultId: lastVaultId, customerId: lastCustomerId })
    } else {
      set('scenario', scenario)
    }
  }

  const isPartner = mode === 'partner'
  const headerLabel = `PayPal 凭据 · ${environment === 'sandbox' ? 'Sandbox' : 'Production'} · ${isPartner ? '三方' : '一方'}`

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          配置参数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount */}
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

        {/* CDN version — only relevant for Apple Pay sessions */}
        {config.scenario !== 'recurring-vault' && (
          <div className="space-y-1.5">
            <Label>Apple Pay CDN 版本</Label>
            <ToggleGroup
              value={config.cdnVersion}
              options={CDN_OPTIONS}
              onChange={(v) => set('cdnVersion', v)}
            />
            {config.cdnVersion === 'v1' && (
              <p className="text-xs text-amber-600">
                ⚠ 切换到 v1 后如需测试 1.latest 请刷新页面，因为 1.latest 已被缓存
              </p>
            )}
          </div>
        )}

        {/* Vault fields — recurring only */}
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

        {/* API 请求模式 */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">API 请求模式</Label>
          <ToggleGroup<ApiRequestMode>
            value={apiRequestMode}
            options={[
              { value: 'direct', label: '直连 PayPal' },
              { value: 'proxy', label: '后端代理' },
            ]}
            onChange={setApiRequestMode}
          />
          <p className="text-xs text-muted-foreground">
            {apiRequestMode === 'direct'
              ? '✓ 前端直调 PayPal API — Apple Pay session 内推荐'
              : '⚠ 经由 Cloudflare Pages 代理 — Apple Pay session 内可能被 Safari 跨域 block'}
          </p>
        </div>

        {/* Post-session 开关 — 仅 proxy 模式下可见 */}
        {apiRequestMode === 'proxy' && (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={proxyPostSession}
              onClick={() => setProxyPostSession(!proxyPostSession)}
              className={cn(
                'mt-0.5 relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200',
                proxyPostSession ? 'bg-amber-500' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                  proxyPostSession ? 'translate-x-4' : 'translate-x-0',
                )}
              />
            </button>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-amber-800">Session 关闭后再发请求</p>
              <p className="text-xs text-amber-700">
                {proxyPostSession
                  ? '先 completePayment() 关闭面板，再调后端 — 绕过跨域限制'
                  : '标准流程：session 活跃期间调后端（可能被 block）'}
              </p>
            </div>
          </div>
        )}

        {/* ── Collapsible credentials section ── */}
        <div className="rounded-lg border border-dashed border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setCredsOpen((o) => !o)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{headerLabel}</span>
            {credsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          <div className={cn('px-3 pb-3 space-y-4', !credsOpen && 'hidden')}>
            {/* Environment */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Globe className="h-3 w-3" /> 环境
              </Label>
              <ToggleGroup<PayPalEnvironment>
                value={environment}
                options={[
                  { value: 'sandbox', label: 'Sandbox' },
                  { value: 'production', label: 'Production' },
                ]}
                onChange={setEnvironment}
              />
              {environment === 'production' && (
                <p className="text-xs text-amber-600">⚠ 请填入正式环境凭据，不提供默认值</p>
              )}
            </div>

            {/* Integration mode */}
            <div className="space-y-1.5">
              <Label className="text-xs">集成模式</Label>
              <ToggleGroup<IntegrationMode>
                value={mode}
                options={[
                  { value: 'merchant', label: '一方 Merchant' },
                  { value: 'partner', label: '三方 Partner' },
                ]}
                onChange={setMode}
              />
            </div>

            {/* 1st-party credentials */}
            {!isPartner && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-client-id" className="text-xs">Client ID</Label>
                  <Input
                    id="cred-client-id"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="font-mono text-xs h-8"
                    placeholder="Client ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-client-secret" className="text-xs">Client Secret</Label>
                  <Input
                    id="cred-client-secret"
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="font-mono text-xs h-8"
                    placeholder="Client Secret"
                  />
                </div>
              </>
            )}

            {/* 3rd-party credentials */}
            {isPartner && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-partner-client-id" className="text-xs">Partner Client ID</Label>
                  <Input
                    id="cred-partner-client-id"
                    value={partnerClientId}
                    onChange={(e) => setPartnerClientId(e.target.value)}
                    className="font-mono text-xs h-8"
                    placeholder="Partner Client ID"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-partner-secret" className="text-xs">Partner Client Secret</Label>
                  <Input
                    id="cred-partner-secret"
                    type="password"
                    value={partnerClientSecret}
                    onChange={(e) => setPartnerClientSecret(e.target.value)}
                    className="font-mono text-xs h-8"
                    placeholder="Partner Client Secret"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cred-merchant-id" className="text-xs">
                    授权 Merchant ID
                    <span className="ml-1 text-muted-foreground">(用于 Auth Assertion)</span>
                  </Label>
                  <Input
                    id="cred-merchant-id"
                    value={partnerMerchantId}
                    onChange={(e) => setPartnerMerchantId(e.target.value)}
                    className="font-mono text-xs h-8"
                    placeholder="Merchant ID (payer_id)"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={resetCreds}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              恢复全部默认值
            </button>
          </div>
        </div>

        <Button className="w-full rounded-full tracking-wide" onClick={onSubmit} loading={loading} size="lg">
          确认配置并初始化 SDK
        </Button>
      </CardContent>
    </Card>
  )
}
