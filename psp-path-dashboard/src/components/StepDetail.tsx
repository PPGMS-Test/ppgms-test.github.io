import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Pencil, RotateCcw, Eye, EyeOff, Info, ExternalLink } from 'lucide-react'
import { STEPS } from '@/lib/steps'
import { useFlowStore, generateTrackingId, type StepId, type FlowConfig } from '@/store/flow'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById, getBnCodeCountry } from '@/config/credential-presets'
import * as api from '@/lib/api'
import {
  buildPartnerReferralBody,
  buildOrderBody,
  buildReferencedPayoutBody,
  buildRefundBody,
} from '@/lib/psp-requests'
import { generateAuthAssertion } from '@/lib/auth-assertion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { StepTips } from '@/components/StepTips'

// 哪些步骤有 request body（capture 无 body；auth 走独立路由）。
const STEP_HAS_BODY: Record<StepId, boolean> = {
  auth: false,
  onboarding: true,
  createOrder: true,
  capture: false,
  disburse: true,
  refund: true,
  createOrderDelayed: true,
  captureDelayed: false,
}

// 由 config + 链路 id 构建某步的 body 对象；无 body 或依赖未就绪时返回 null。
function buildBodyFor(id: StepId, config: FlowConfig, captureId: string): object | null {
  switch (id) {
    case 'onboarding':
      return buildPartnerReferralBody(config.trackingId, config.returnUrl)
    case 'createOrder':
      return buildOrderBody({
        amount: config.amount,
        currency: config.currency,
        payeeEmail: config.payeeEmail,
        referenceId: `psp_${config.currency}`,
      })
    case 'createOrderDelayed':
      return buildOrderBody({
        amount: config.amount,
        currency: config.currency,
        payeeEmail: config.payeeEmail,
        referenceId: `psp_${config.currency}`,
        disbursementMode: 'DELAYED',
      })
    case 'disburse':
      return captureId ? buildReferencedPayoutBody(captureId) : null
    case 'refund':
      return buildRefundBody()
    default:
      return null
  }
}

// 从响应的 links 数组里按 rel 取对应的 href，找不到返回 null。
export function extractLinkByRel(response: unknown, rel: string): string | null {
  const links = (response as { links?: Array<{ rel?: string; href?: string }> } | undefined)?.links
  return links?.find((l) => l.rel === rel)?.href ?? null
}

// partner-referrals 响应里的商户授权链接，方便直接点开。
export function extractActionUrl(response: unknown): string | null {
  return extractLinkByRel(response, 'action_url')
}

// create order 响应里买家的 approve 链接（rel === 'approve'），方便直接点开走审批流程。
export function extractApproveLink(response: unknown): string | null {
  return extractLinkByRel(response, 'approve')
}

async function runStep(id: StepId): Promise<api.ApiResult> {
  const flow = useFlowStore.getState()
  const cred = useCredentialsStore.getState()
  const { accessToken, orderId, captureId, config, requestBodies } = flow

  if (id === 'auth') {
    const r = await api.fetchAccessToken()
    if (r.ok && r.data.accessToken) flow.setAccessToken(r.data.accessToken)
    return r
  }

  const step = STEPS.find((s) => s.id === id)!
  const targetPath = step.pathTemplate
    .replace('{orderId}', orderId)
    .replace('{captureId}', captureId)
  const authAssertion =
    config.sendAuthAssertion && cred.clientId && config.payerId
      ? generateAuthAssertion(cred.clientId, config.payerId)
      : undefined

  const r = await api.callCommon(targetPath, {
    method: 'POST',
    rawBody: STEP_HAS_BODY[id] ? requestBodies[id] : undefined,
    token: accessToken,
    bnCode: config.sendBnCode ? (cred.bnCode || undefined) : undefined,
    authAssertion,
  })

  if (id === 'createOrder' || id === 'createOrderDelayed') {
    const oid = (r.data as { id?: string }).id
    if (r.ok && oid) flow.setOrderId(oid)
  } else if (id === 'capture' || id === 'captureDelayed') {
    const cap = (r.data as {
      purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }>
    }).purchase_units?.[0]?.payments?.captures?.[0]?.id
    if (r.ok && cap) flow.setCaptureId(cap)
  } else if (id === 'refund') {
    const rid = (r.data as { id?: string }).id
    if (r.ok && rid) flow.setRefundId(rid)
  }
  return r
}

export function StepDetail() {
  const activeStep = useFlowStore((s) => s.activeStep)
  const status = useFlowStore((s) => s.stepStatus[s.activeStep])
  const response = useFlowStore((s) => s.responses[s.activeStep])
  const debugId = useFlowStore((s) => s.debugIds[s.activeStep])
  const config = useFlowStore((s) => s.config)
  const updateConfig = useFlowStore((s) => s.updateConfig)
  const setStepResult = useFlowStore((s) => s.setStepResult)
  const orderId = useFlowStore((s) => s.orderId)
  const captureId = useFlowStore((s) => s.captureId)
  const accessToken = useFlowStore((s) => s.accessToken)
  const requestBody = useFlowStore((s) => s.requestBodies[s.activeStep])
  const editing = useFlowStore((s) => Boolean(s.bodyEditing[s.activeStep]))
  const setRequestBody = useFlowStore((s) => s.setRequestBody)
  const setBodyEditing = useFlowStore((s) => s.setBodyEditing)
  const isConfigured = useCredentialsStore((s) => s.isConfigured())
  const clientId = useCredentialsStore((s) => s.clientId)
  const bnCode = useCredentialsStore((s) => s.bnCode)
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const bnCodeCountry = getBnCodeCountry(getPresetById(activePresetId), bnCode)
  const [showToken, setShowToken] = useState(false)

  const step = STEPS.find((s) => s.id === activeStep)!
  const resolvedPath = step.pathTemplate
    .replace('{orderId}', orderId || '{orderId}')
    .replace('{captureId}', captureId || '{captureId}')

  // 进入某步时若还没生成 body，则由 config 生成初值。
  useEffect(() => {
    if (!STEP_HAS_BODY[activeStep]) return
    if (requestBody !== undefined) return
    const built = buildBodyFor(activeStep, config, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }, [activeStep, requestBody, config, captureId, setRequestBody])

  const regenerate = () => {
    // Onboarding 每次重新生成都换一个新的 tracking_id，避免和之前发过的请求重复。
    if (activeStep === 'onboarding') {
      const trackingId = generateTrackingId()
      updateConfig({ trackingId })
      const built = buildBodyFor(activeStep, { ...config, trackingId }, captureId)
      if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
      return
    }
    const built = buildBodyFor(activeStep, config, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }

  // 改结构化字段：更新 config 并按新值重建当前步 body（覆盖手动编辑）。
  const onField = (patch: Partial<FlowConfig>) => {
    updateConfig(patch)
    const built = buildBodyFor(activeStep, { ...config, ...patch }, captureId)
    if (built !== null) setRequestBody(activeStep, JSON.stringify(built, null, 2))
  }

  const authAssertionPreview =
    config.sendAuthAssertion && clientId && config.payerId
      ? generateAuthAssertion(clientId, config.payerId)
      : ''

  const maskedToken = accessToken
    ? `Bearer ${accessToken.slice(0, 12)}…${accessToken.slice(-6)}`
    : 'Bearer <先执行 Auth 获取>'

  const actionUrl = extractActionUrl(response)
  const approveLink = extractApproveLink(response)

  const onSend = async () => {
    if (STEP_HAS_BODY[activeStep]) {
      if (!requestBody || !requestBody.trim()) {
        setStepResult(
          activeStep,
          'error',
          { error: 'Request body 尚未生成（disburse 需先完成 Capture 拿到 capture id，可点「重新生成」）' },
          'request body 未就绪',
        )
        return
      }
      try {
        JSON.parse(requestBody)
      } catch (e) {
        setStepResult(activeStep, 'error', { error: 'Request body 不是合法 JSON：' + String(e) }, 'invalid JSON')
        return
      }
    }
    setStepResult(activeStep, 'running')
    try {
      const r = await runStep(activeStep)
      setStepResult(activeStep, r.ok ? 'success' : 'error', r.data, r.ok ? undefined : `HTTP ${r.status}`, r.debugId)
    } catch (e) {
      setStepResult(activeStep, 'error', { error: String(e) }, String(e))
    }
  }

  const inputCls = 'rounded border border-line bg-white px-2 py-1 font-mono text-sm'
  const readOnlyInputCls = `${inputCls} cursor-not-allowed bg-line/20 text-muted`

  return (
    <div className="flex flex-col gap-3">
      {/* 请求行 */}
      <Card>
        <div className="flex items-center gap-2">
          <Badge tone="ink">{step.method}</Badge>
          <span className="font-mono text-sm">{resolvedPath}</span>
          <StepTips />
        </div>
      </Card>

      {/* 结构化输入 */}
      <Card className="flex flex-col gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">关键参数</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(activeStep === 'createOrder' || activeStep === 'createOrderDelayed') && (
            <>
              <label className="flex flex-col gap-1">金额
                <input className={inputCls} value={config.amount}
                  onChange={(e) => onField({ amount: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">币种
                <input className={inputCls} value={config.currency}
                  onChange={(e) => onField({ currency: e.target.value })} />
              </label>
              <label className="col-span-2 flex flex-col gap-1">Payee Email 
                <input className={readOnlyInputCls} value={config.payeeEmail} disabled readOnly />
              </label>
            </>
          )}
          {activeStep === 'onboarding' && (
            <>
              <label className="flex flex-col gap-1">Tracking ID
                <input className={inputCls} value={config.trackingId}
                  onChange={(e) => onField({ trackingId: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">Return URL
                <input className={inputCls} value={config.returnUrl}
                  onChange={(e) => onField({ returnUrl: e.target.value })} />
              </label>
            </>
          )}
          {/* payer_id + Auth Assertion 开关：对所有走 /common 的步骤可用 */}
          {activeStep !== 'auth' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1">
                  Payer ID (<Link to="/credentials" className="underline">Merchant</Link>)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label="Payer ID 说明" className="inline-flex shrink-0 items-center text-muted hover:text-ink">
                        <Info size={13} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      这是授权给到 PSP 的<b>商户(merchant)</b>的 PayPal Payer ID <br/>
                      我这里使用如下的<b>HK</b>商户: <br/>
                      <ul className="list-disc pl-4">
                        <li>payer_id: <code>CDQG5AS6GD7JXB5T</code></li>
                        <li>email: <code>psp-test-2026-hk@test.com</code></li>
                        <li>pwd: <code>12345678</code></li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </span>
                <input className={readOnlyInputCls} value={config.payerId} disabled readOnly />
              </label>
              <label className="flex flex-col gap-1">
                {/* 与 Payer ID 的标签行等高的占位，让下面的 checkbox 行跟输入框对齐 */}
                <span className="invisible" aria-hidden="true">占位</span>
                <span className="flex items-center gap-2 rounded border border-transparent px-2 py-1">
                  <input type="checkbox" checked={config.sendAuthAssertion}
                    onChange={(e) => updateConfig({ sendAuthAssertion: e.target.checked })} />
                  带 PayPal-Auth-Assertion
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  BN Code（{bnCodeCountry ? `商户国家：${bnCodeCountry}` : '未知国家'}）
                </span>
                <input className={readOnlyInputCls} value={bnCode || '(未设置)'} disabled readOnly />
              </label>
              <label className="flex flex-col gap-1">
                <span className="invisible" aria-hidden="true">占位</span>
                <span className="flex items-center gap-2 rounded border border-transparent px-2 py-1">
                  <input type="checkbox" checked={config.sendBnCode}
                    onChange={(e) => updateConfig({ sendBnCode: e.target.checked })} />
                  带 PayPal-Partner-Attribution-Id
                </span>
              </label>
            </>
          )}
        </div>
      </Card>

      {/* Request body（默认只读，可编辑，实时保存） */}
      {STEP_HAS_BODY[activeStep] && (
        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">Request Body</span>
            <div className="flex gap-2">
              <Button variant="ghost" className="px-2 py-1 text-xs"
                onClick={() => setBodyEditing(activeStep, !editing)}>
                <Pencil size={14} /> {editing ? '完成' : '编辑'}
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={regenerate}>
                <RotateCcw size={14} /> 重新生成
              </Button>
            </div>
          </div>
          {editing ? (
            <textarea
              className="min-h-48 w-full rounded border border-line bg-white p-2 font-mono text-xs"
              value={requestBody ?? ''}
              onChange={(e) => setRequestBody(activeStep, e.target.value)}
            />
          ) : (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
              {requestBody ?? '（尚未生成 —— disburse 需先完成 Capture 拿到 capture id，可点「重新生成」）'}
            </pre>
          )}
        </Card>
      )}

      {/* Headers 回显 */}
      <Card className="flex flex-col gap-1">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Request Headers</div>
        <div className="font-mono text-xs leading-relaxed">
          {activeStep === 'auth' ? (
            <div>Authorization: Basic &lt;clientId:secret 的 base64&gt;</div>
          ) : (
            <>
              <div>
                Authorization: {showToken ? `Bearer ${accessToken || '<先执行 Auth>'}` : maskedToken}
                <button
                  type="button"
                  aria-label={showToken ? '隐藏 token' : '显示 token'}
                  className="ml-1 inline-flex items-center align-middle text-muted hover:text-ink"
                  onClick={() => setShowToken((v) => !v)}
                >
                  {showToken ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <div>Content-Type: application/json</div>
              <div>Prefer: return=representation</div>
              {bnCode && <div>PayPal-Partner-Attribution-Id: {bnCode}</div>}
              {authAssertionPreview && <div className="break-all">PayPal-Auth-Assertion: {authAssertionPreview}</div>}
            </>
          )}
        </div>
      </Card>

      {/* 发送 */}
      <div className="flex items-center gap-3">
        <Button onClick={onSend} disabled={!isConfigured || status === 'running'}>
          <Send size={16} /> 发送
        </Button>
        {!isConfigured && <span className="text-xs text-accent">请先到「凭证」页填 client id/secret</span>}
        {status !== 'idle' && (
          <Badge tone={status === 'success' ? 'ok' : status === 'error' ? 'accent' : 'muted'}>{status}</Badge>
        )}
      </div>

      {/* Response（发送后显示在下方） */}
      {response !== undefined && (
        <Card>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Response</div>
          {actionUrl && (
            <a
              href={actionUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-2 flex items-center gap-1 break-all text-sm text-ink underline hover:text-accent"
            >
              <ExternalLink size={14} className="shrink-0" />
              打开商户授权链接（action_url）
            </a>
          )}
          {approveLink && (
            <a
              href={approveLink}
              target="_blank"
              rel="noreferrer"
              className="mb-2 flex items-center gap-1 break-all text-sm text-ink underline hover:text-accent"
            >
              <ExternalLink size={14} className="shrink-0" />
              打开 Buyer Approve 链接（rel=approve）
            </a>
          )}
          {debugId && (
            <div className="mb-2 break-all font-mono text-xs text-muted">
              paypal-debug-id: <span className="text-ink">{debugId}</span>
            </div>
          )}
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
            {JSON.stringify(response, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  )
}
