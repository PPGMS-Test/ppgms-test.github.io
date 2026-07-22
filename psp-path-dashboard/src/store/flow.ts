// 演练台流程状态：串联各步产出 + 每步状态/响应 + 可编辑请求配置。
import { create } from 'zustand'
import { getPresetById } from '@/config/credential-presets'
import { useActivePresetStore } from './active-preset'

export type StepId =
  | 'auth'
  | 'onboarding'
  | 'createOrder'
  | 'capture'
  | 'disburse'
  | 'refund'
  // DISBURSEMENT MODE 小节：createOrder/capture 的变体，共享同一份 orderId/captureId，
  // 唯一区别是 createOrderDelayed 会带 payment_instruction.disbursement_mode=DELAYED。
  | 'createOrderDelayed'
  | 'captureDelayed'
export type StepStatus = 'idle' | 'running' | 'success' | 'error'

export interface FlowConfig {
  amount: string
  currency: string
  payeeEmail: string
  trackingId: string
  returnUrl: string
  payerId: string
  /** 是否要在请求里带 PayPal-Auth-Assertion 头；还需要 payerId 非空才会真正发送 */
  sendAuthAssertion: boolean
  /** 是否要在请求里带 PayPal-Partner-Attribution-Id（BN Code）头，默认 true；关闭用于测试不传 bnCode 的场景 */
  sendBnCode: boolean
}

interface FlowState {
  // 串联产出
  accessToken: string
  orderId: string
  captureId: string
  refundId: string
  // 每步状态与原始响应
  stepStatus: Record<StepId, StepStatus>
  responses: Partial<Record<StepId, unknown>>
  errors: Partial<Record<StepId, string>>
  /** PayPal 响应的 paypal-debug-id，跟 PayPal 支持排查问题时要用到 */
  debugIds: Partial<Record<StepId, string>>
  // 可编辑配置
  config: FlowConfig
  requestBodies: Partial<Record<StepId, string>>
  bodyEditing: Partial<Record<StepId, boolean>>
  activeStep: StepId
  // actions
  setActiveStep: (s: StepId) => void
  setAccessToken: (v: string) => void
  setOrderId: (v: string) => void
  setCaptureId: (v: string) => void
  setRefundId: (v: string) => void
  setStepResult: (s: StepId, status: StepStatus, response?: unknown, error?: string, debugId?: string) => void
  updateConfig: (patch: Partial<FlowConfig>) => void
  setRequestBody: (s: StepId, raw: string) => void
  setBodyEditing: (s: StepId, on: boolean) => void
  reset: () => void
}

// Onboarding 的 tracking_id 每次都要唯一，否则重复调用会被 PayPal 当成同一个 referral。
export function generateTrackingId(): string {
  return `psp-playground-${crypto.randomUUID()}`
}

function createInitialConfig(): FlowConfig {
  const preset = getPresetById(useActivePresetStore.getState().activePresetId)
  return {
    amount: '160.00',
    currency: 'GBP',
    payeeEmail: preset.payeeEmail,
    trackingId: generateTrackingId(),
    returnUrl: 'https://example.com/return',
    payerId: preset.payerId,
    sendAuthAssertion: false,
    sendBnCode: true,
  }
}

const INITIAL_STATE = {
  accessToken: '',
  orderId: '',
  captureId: '',
  refundId: '',
  stepStatus: {
    auth: 'idle', onboarding: 'idle', createOrder: 'idle', capture: 'idle', disburse: 'idle', refund: 'idle',
    createOrderDelayed: 'idle', captureDelayed: 'idle',
  } as Record<StepId, StepStatus>,
  responses: {} as Partial<Record<StepId, unknown>>,
  errors: {} as Partial<Record<StepId, string>>,
  debugIds: {} as Partial<Record<StepId, string>>,
  requestBodies: {} as Partial<Record<StepId, string>>,
  bodyEditing: {} as Partial<Record<StepId, boolean>>,
  activeStep: 'auth' as StepId,
}

export const useFlowStore = create<FlowState>((set) => ({
  ...INITIAL_STATE,
  config: createInitialConfig(),
  setActiveStep: (activeStep) => set({ activeStep }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setOrderId: (orderId) => set({ orderId }),
  setCaptureId: (captureId) => set({ captureId }),
  setRefundId: (refundId) => set({ refundId }),
  setStepResult: (s, status, response, error, debugId) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [s]: status },
      responses: response !== undefined ? { ...state.responses, [s]: response } : state.responses,
      errors: error !== undefined ? { ...state.errors, [s]: error } : state.errors,
      debugIds: debugId !== undefined ? { ...state.debugIds, [s]: debugId } : state.debugIds,
    })),
  updateConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setRequestBody: (s, raw) =>
    set((state) => ({ requestBodies: { ...state.requestBodies, [s]: raw } })),
  setBodyEditing: (s, on) =>
    set((state) => ({ bodyEditing: { ...state.bodyEditing, [s]: on } })),
  reset: () => set({ ...INITIAL_STATE, config: createInitialConfig() }),
}))
