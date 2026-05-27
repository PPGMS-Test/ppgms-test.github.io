/**
 * 应用根组件 — PayPal Apple Pay 测试面板入口。
 *
 * 作用：
 *   组装整个页面布局，协调以下子模块：
 *   - ScenarioSelector：场景选择（场景切换会自动重置 SDK 状态）
 *   - ConfigPanel：参数配置 + 凭据管理 + 初始化触发
 *   - ApplePayButton / RecurringButton：根据场景渲染对应支付按钮
 *   - PaymentResult：展示支付成功或支付级别失败结果
 *
 *   状态完全由 usePaymentFlow hook 管理，App 仅做条件渲染：
 *   - isLoading：显示加载指示器
 *   - isInitError：显示初始化错误横幅（ConfigPanel 保持可见供重试）
 *   - isReady：显示支付按钮
 *   - isPaymentDone：隐藏 ConfigPanel，显示 PaymentResult
 */
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { ScenarioSelector } from '@/components/ScenarioSelector'
import { ConfigPanel } from '@/components/ConfigPanel'
import { PaymentResult } from '@/components/PaymentResult'
import { ApplePayButton } from '@/components/payment/ApplePayButton'
import { RecurringButton } from '@/components/payment/RecurringButton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePaymentFlow } from '@/hooks/usePaymentFlow'
import type { PaymentConfig } from '@/components/ConfigPanel'

/** 页面初始默认配置，含 sandbox 测试用 Vault ID 和 Customer ID */
const DEFAULT_CONFIG: PaymentConfig = {
  scenario: 'one-time-basic',
  amount: '10.00',
  vaultId: '4ay47978lf4391843',
  customerId: 'BQzraNHpkx',
  cdnVersion: '1.latest',
}

export default function App() {
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_CONFIG)
  const { status, error, result, initialize, startPayment, startRecurringPayment, reset } =
    usePaymentFlow()

  // Reset SDK state when scenario changes
  useEffect(() => {
    if (status !== 'idle') reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.scenario])

  const handleInitialize = () => {
    void initialize({
      scenario: config.scenario,
      amount: config.amount,
      vaultId: config.vaultId || undefined,
      cdnVersion: config.cdnVersion,
    })
  }

  const flowConfig = {
    scenario: config.scenario,
    amount: config.amount,
    vaultId: config.vaultId || undefined,
    cdnVersion: config.cdnVersion,
  }

  const isLoading = status === 'loading'
  const isReady = status === 'ready'
  const isProcessing = status === 'processing'
  // 支付级别完成：成功，或支付尝试后的失败（result 非 null 说明曾发起过支付）
  const isPaymentDone = status === 'success' || (status === 'error' && result !== null)
  // 初始化级别错误：错误发生在任何支付尝试之前（result 仍为 null）
  const isInitError = status === 'error' && result === null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">PayPal Apple Pay 测试面板</h1>
          <p className="text-sm text-muted-foreground">
            后端:{' '}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              ppgms-test-github-io.pages.dev
            </code>
          </p>
        </div>

        {/* Scenario selector — always visible */}
        <ScenarioSelector
          value={config.scenario}
          onChange={(scenario) => setConfig((c) => ({ ...c, scenario }))}
          disabled={isLoading || isProcessing}
        />

        {/* Config panel — stays visible until payment succeeds so user can fix & retry */}
        {!isPaymentDone && (
          <ConfigPanel
            config={config}
            onChange={setConfig}
            onSubmit={handleInitialize}
            loading={isLoading}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">正在加载 SDK...</p>
            </CardContent>
          </Card>
        )}

        {/* Initialization error — ConfigPanel stays visible so user can adjust and retry */}
        {isInitError && error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 pb-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700 font-mono">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={reset} className="flex-shrink-0">
                <RefreshCw className="h-3.5 w-3.5" />
                重置
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment buttons — show when ready */}
        {isReady && (
          <Card>
            <CardContent className="pt-6">
              {config.scenario === 'recurring-vault' ? (
                <RecurringButton
                  config={flowConfig}
                  onPay={(c) => void startRecurringPayment(c)}
                  loading={isProcessing}
                />
              ) : (
                <ApplePayButton
                  config={flowConfig}
                  onPay={startPayment}
                  disabled={isProcessing}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment result (success or payment-level error only) */}
        <PaymentResult status={status} result={result} error={error} onReset={reset} />

        {/* Version badge */}
        <p className="text-center text-xs text-muted-foreground">
          v{__APP_VERSION__} · {new Date().toISOString().slice(0, 10)}
        </p>
      </div>
    </div>
  )
}
