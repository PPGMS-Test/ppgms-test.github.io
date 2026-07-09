import { Send } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { useFlowStore, type StepId } from '@/store/flow'
import { useCredentialsStore } from '@/store/credentials'
import * as api from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

// 每步的中文讲解（干什么/钱在哪/谁担风险）
const EXPLAIN: Record<StepId, string> = {
  auth: '用 BYOK 凭证换取 OAuth access_token。之后每一步都带着它调用，等价于 Postman 里的第 1 步 Auth。',
  onboarding: '通过 Partner Referral 让商户授权 PSP 代其收款/退款/延迟放款。产出一个商户点击授权的链接。',
  createOrder: '以 CAPTURE intent 建单，payee 指向被授权商户，带 BN code 头。此刻还没扣钱。',
  capture: '捕获订单，买家的钱进入商户 General Ledger（商户余额仍为 $0，等待划给 PSP）。',
  disburse: '用 capture id 触发 referenced-payouts，把钱从商户 GL 划到 PSP 的 PSA（Type 5 账户），日终 sweep 到 PSP 银行账户。',
  refund: '发起退款。PSP Path 下退款由 PSP 承担，且 2.0 保证退款从 PSA 出而非错误扣商户余额。',
}

async function runStep(id: StepId): Promise<{ status: number; data: unknown; ok: boolean }> {
  const flow = useFlowStore.getState()
  const { accessToken, orderId, captureId, config } = flow
  switch (id) {
    case 'auth': {
      const r = await api.fetchAccessToken()
      if (r.ok && r.data.accessToken) flow.setAccessToken(r.data.accessToken)
      return r
    }
    case 'onboarding':
      return api.createPartnerReferral(accessToken, config.trackingId, config.returnUrl)
    case 'createOrder': {
      const r = await api.createOrder(accessToken, {
        amount: config.amount, currency: config.currency, payeeEmail: config.payeeEmail,
        referenceId: `psp_${config.currency}`,
      })
      const id2 = (r.data as { id?: string }).id
      if (r.ok && id2) flow.setOrderId(id2)
      return r
    }
    case 'capture': {
      const r = await api.captureOrder(accessToken, orderId)
      const cap = (r.data as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }> })
        .purchase_units?.[0]?.payments?.captures?.[0]?.id
      if (r.ok && cap) flow.setCaptureId(cap)
      return r
    }
    case 'disburse':
      return api.disburse(accessToken, captureId)
    case 'refund': {
      const r = await api.refund(accessToken, captureId)
      const rid = (r.data as { id?: string }).id
      if (r.ok && rid) flow.setRefundId(rid)
      return r
    }
  }
}

export function StepDetail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const status = useFlowStore((s) => s.stepStatus[s.activeStep])
  const response = useFlowStore((s) => s.responses[s.activeStep])
  const config = useFlowStore((s) => s.config)
  const updateConfig = useFlowStore((s) => s.updateConfig)
  const setStepResult = useFlowStore((s) => s.setStepResult)
  const orderId = useFlowStore((s) => s.orderId)
  const captureId = useFlowStore((s) => s.captureId)
  const isConfigured = useCredentialsStore((s) => s.isConfigured())

  const step = STEPS.find((s) => s.id === activeStep)!
  const resolvedPath = step.pathTemplate
    .replace('{orderId}', orderId || '{orderId}')
    .replace('{captureId}', captureId || '{captureId}')

  const onSend = async () => {
    setStepResult(activeStep, 'running')
    try {
      const r = await runStep(activeStep)
      setStepResult(activeStep, r.ok ? 'success' : 'error', r.data, r.ok ? undefined : `HTTP ${r.status}`)
    } catch (e) {
      setStepResult(activeStep, 'error', { error: String(e) }, String(e))
    }
  }

  const showConfigFields = activeStep === 'createOrder' || activeStep === 'onboarding'

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">这一步在干什么</div>
        <p className="text-sm leading-relaxed">{EXPLAIN[activeStep]}</p>
      </Card>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="ink">{step.method}</Badge>
          <span className="font-mono text-sm">{resolvedPath}</span>
        </div>
        {showConfigFields && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {activeStep === 'createOrder' && (
              <>
                <label className="flex flex-col gap-1">金额
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.amount} onChange={(e) => updateConfig({ amount: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">币种
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.currency} onChange={(e) => updateConfig({ currency: e.target.value })} />
                </label>
                <label className="col-span-2 flex flex-col gap-1">Payee Email（被授权商户）
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.payeeEmail} onChange={(e) => updateConfig({ payeeEmail: e.target.value })} />
                </label>
              </>
            )}
            {activeStep === 'onboarding' && (
              <>
                <label className="flex flex-col gap-1">Tracking ID
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.trackingId} onChange={(e) => updateConfig({ trackingId: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1">Return URL
                  <input className="rounded border border-line bg-white px-2 py-1 font-mono"
                    value={config.returnUrl} onChange={(e) => updateConfig({ returnUrl: e.target.value })} />
                </label>
              </>
            )}
          </div>
        )}
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={onSend} disabled={!isConfigured || status === 'running'}>
          <Send size={16} /> 发送
        </Button>
        {!isConfigured && <span className="text-xs text-accent">请先到「凭证」页填 client id/secret</span>}
        {status !== 'idle' && (
          <Badge tone={status === 'success' ? 'ok' : status === 'error' ? 'accent' : 'muted'}>{status}</Badge>
        )}
      </div>

      {response !== undefined && (
        <Card>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">响应</div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
            {JSON.stringify(response, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
