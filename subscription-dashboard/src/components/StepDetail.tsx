// subscription-dashboard/src/components/StepDetail.tsx
import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PlanSliders } from '@/components/PlanSliders'
import { BillingTimeline } from '@/components/BillingTimeline'
import { ApprovalButton } from '@/components/ApprovalButton'
import { STEPS, type StepId } from '@/lib/steps'
import { buildProductBody, buildPlanBody, buildSubscriptionBody } from '@/lib/subscription-requests'
import { fetchAccessToken, callCommon } from '@/lib/api'
import { useFlowStore } from '@/store/flow'
import { useCredentialsStore } from '@/store/credentials'

function buildBodyFor(stepId: StepId, flow: ReturnType<typeof useFlowStore.getState>): object | undefined {
  switch (stepId) {
    case 'createProduct':
      return buildProductBody('Subscription Playground Product', '由 subscription-dashboard 创建的测试产品')
    case 'createPlan':
      return buildPlanBody({
        productId: flow.productId,
        name: `Subscription Playground Plan (${flow.planType})`,
        description: '由 subscription-dashboard 创建的测试计费计划',
        config: flow.planConfig,
      })
    case 'createSubscription':
      return buildSubscriptionBody(flow.planId)
    default:
      return undefined
  }
}

function targetPathFor(stepId: StepId): { path: string; method: string } {
  switch (stepId) {
    case 'createProduct':
      return { path: '/v1/catalogs/products', method: 'POST' }
    case 'createPlan':
      return { path: '/v1/billing/plans', method: 'POST' }
    case 'createSubscription':
      return { path: '/v1/billing/subscriptions', method: 'POST' }
    default:
      return { path: '', method: 'POST' }
  }
}

export function StepDetail() {
  const flow = useFlowStore()
  const clientId = useCredentialsStore((s) => s.clientId)
  const clientSecret = useCredentialsStore((s) => s.clientSecret)
  const [sending, setSending] = useState(false)

  const step = STEPS.find((s) => s.id === flow.activeStep)!
  const body = useMemo(
    () => buildBodyFor(step.id, flow),
    [step.id, flow.productId, flow.planId, flow.planType, flow.planConfig],
  )

  async function runStep() {
    setSending(true)
    flow.setStepResult(step.id, 'running')
    try {
      if (step.id === 'auth') {
        const result = await fetchAccessToken()
        if (result.ok && result.data.accessToken) {
          flow.setAccessToken(result.data.accessToken)
          flow.setStepResult('auth', 'success', result.data)
        } else {
          flow.setStepResult('auth', 'error', result.data, result.data.error ?? `HTTP ${result.status}`)
        }
        return
      }

      const { path, method } = targetPathFor(step.id)
      const result = await callCommon(path, {
        token: flow.accessToken,
        method,
        rawBody: body ? JSON.stringify(body) : undefined,
      })

      if (!result.ok) {
        const data = result.data as { message?: string; name?: string }
        flow.setStepResult(step.id, 'error', result.data, data.message ?? data.name ?? `HTTP ${result.status}`, result.debugId)
        return
      }

      const data = result.data as { id?: string; status?: string }
      if (step.id === 'createProduct' && data.id) flow.setProductId(data.id)
      if (step.id === 'createPlan' && data.id) flow.setPlanId(data.id)
      if (step.id === 'createSubscription') {
        if (data.id) flow.setSubscriptionId(data.id)
        if (data.status) flow.setSubscriptionStatus(data.status)
      }
      flow.setStepResult(step.id, 'success', result.data, undefined, result.debugId)
    } catch (err) {
      flow.setStepResult(step.id, 'error', undefined, err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const status = flow.stepStatus[step.id]
  const response = flow.responses[step.id]
  const error = flow.errors[step.id]
  const debugId = flow.debugIds[step.id]
  const disabled = sending || !clientId || !clientSecret

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{step.title}</h2>
          <p className="text-xs text-muted">参考章节：{step.docSection}</p>
        </div>
        <span aria-live="polite">
          <Badge tone={status === 'success' ? 'ok' : status === 'error' ? 'danger' : status === 'running' ? 'accent' : 'muted'}>
            {status}
          </Badge>
        </span>
      </div>

      {step.id === 'createPlan' && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <PlanSliders />
          </div>
          <div className="flex-1">
            <BillingTimeline />
          </div>
        </div>
      )}

      {step.id === 'approval' ? (
        <ApprovalButton />
      ) : (
        <>
          {body && (
            <pre className="max-h-64 overflow-auto rounded-lg bg-surface2 p-3 font-mono text-xs text-ink">
              {JSON.stringify(body, null, 2)}
            </pre>
          )}
          <Button onClick={runStep} disabled={disabled}>
            {sending ? '发送中…' : '发送请求'}
          </Button>
        </>
      )}

      <div aria-live="polite">
        {error && (
          <p className="text-sm text-danger" role="alert">
            错误：{error}
            {debugId ? `（debug-id: ${debugId}）` : ''}
          </p>
        )}
        {!error && response !== undefined && (
          <pre className="max-h-64 overflow-auto rounded-lg bg-surface2 p-3 font-mono text-xs text-ink">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </div>
    </Card>
  )
}
