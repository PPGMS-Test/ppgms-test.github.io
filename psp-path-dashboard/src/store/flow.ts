// 演练台流程状态：串联各步产出 + 每步状态/响应 + 可编辑请求配置。
import { create } from 'zustand'
import { DEFAULT_PAYEE_EMAIL, DEFAULT_PAYER_ID } from '@/config/default-credentials'

export type StepId = 'auth' | 'onboarding' | 'createOrder' | 'capture' | 'disburse' | 'refund'
export type StepStatus = 'idle' | 'running' | 'success' | 'error'

export interface FlowConfig {
  amount: string
  currency: string
  payeeEmail: string
  trackingId: string
  returnUrl: string
  payerId: string
  authAssertionEnabled: boolean
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
  setStepResult: (s: StepId, status: StepStatus, response?: unknown, error?: string) => void
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
  return {
    amount: '160.00',
    currency: 'GBP',
    payeeEmail: DEFAULT_PAYEE_EMAIL,
    trackingId: generateTrackingId(),
    returnUrl: 'https://example.com/return',
    payerId: DEFAULT_PAYER_ID,
    authAssertionEnabled: false,
  }
}

const INITIAL_STATE = {
  accessToken: '',
  orderId: '',
  captureId: '',
  refundId: '',
  stepStatus: {
    auth: 'idle', onboarding: 'idle', createOrder: 'idle', capture: 'idle', disburse: 'idle', refund: 'idle',
  } as Record<StepId, StepStatus>,
  responses: {} as Partial<Record<StepId, unknown>>,
  errors: {} as Partial<Record<StepId, string>>,
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
  setStepResult: (s, status, response, error) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [s]: status },
      responses: response !== undefined ? { ...state.responses, [s]: response } : state.responses,
      errors: error !== undefined ? { ...state.errors, [s]: error } : state.errors,
    })),
  updateConfig: (patch) => set((state) => ({ config: { ...state.config, ...patch } })),
  setRequestBody: (s, raw) =>
    set((state) => ({ requestBodies: { ...state.requestBodies, [s]: raw } })),
  setBodyEditing: (s, on) =>
    set((state) => ({ bodyEditing: { ...state.bodyEditing, [s]: on } })),
  reset: () => set({ ...INITIAL_STATE, config: createInitialConfig() }),
}))
