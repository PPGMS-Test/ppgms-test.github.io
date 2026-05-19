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
  // Payment-level done: success, or error that happened after a payment attempt (result != null)
  const isPaymentDone = status === 'success' || (status === 'error' && result !== null)
  // Init-level error: error before any payment was attempted
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
          v1 · {new Date().toISOString().slice(0, 10)}
        </p>
      </div>
    </div>
  )
}
