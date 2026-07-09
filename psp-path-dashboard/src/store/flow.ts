// 演练台流程状态：串联各步产出 + 每步状态/响应 + 可编辑请求配置。
import { create } from 'zustand'

export type StepId = 'auth' | 'onboarding' | 'createOrder' | 'capture' | 'disburse' | 'refund'
export type StepStatus = 'idle' | 'running' | 'success' | 'error'

export interface FlowConfig {
  amount: string
  currency: string
  payeeEmail: string
  trackingId: string
  returnUrl: string
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
  activeStep: StepId
  // actions
  setActiveStep: (s: StepId) => void
  setAccessToken: (v: string) => void
  setOrderId: (v: string) => void
  setCaptureId: (v: string) => void
  setRefundId: (v: string) => void
  setStepResult: (s: StepId, status: StepStatus, response?: unknown, error?: string) => void
  updateConfig: (patch: Partial<FlowConfig>) => void
  reset: () => void
}

const INITIAL = {
  accessToken: '',
  orderId: '',
  captureId: '',
  refundId: '',
  stepStatus: {
    auth: 'idle', onboarding: 'idle', createOrder: 'idle', capture: 'idle', disburse: 'idle', refund: 'idle',
  } as Record<StepId, StepStatus>,
  responses: {} as Partial<Record<StepId, unknown>>,
  errors: {} as Partial<Record<StepId, string>>,
  config: {
    amount: '160.00',
    currency: 'GBP',
    payeeEmail: '',
    trackingId: 'psp-playground-merchant-1',
    returnUrl: 'https://example.com/return',
  } as FlowConfig,
  activeStep: 'auth' as StepId,
}

export const useFlowStore = create<FlowState>((set) => ({
  ...INITIAL,
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
  reset: () => set(INITIAL),
}))
