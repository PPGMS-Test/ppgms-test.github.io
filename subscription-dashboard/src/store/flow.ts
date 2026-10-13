import { create } from 'zustand'
import { defaultPlanConfig, type PlanConfig, type PlanType } from '@/lib/plan-config'
import type { StepId } from '@/lib/steps'

export type StepStatus = 'idle' | 'running' | 'success' | 'error'

interface FlowState {
  accessToken: string
  productId: string
  planId: string
  subscriptionId: string
  subscriptionStatus: string
  planType: PlanType
  planConfig: PlanConfig
  stepStatus: Record<StepId, StepStatus>
  responses: Partial<Record<StepId, unknown>>
  errors: Partial<Record<StepId, string>>
  debugIds: Partial<Record<StepId, string>>
  activeStep: StepId
  setActiveStep: (s: StepId) => void
  setAccessToken: (v: string) => void
  setProductId: (v: string) => void
  setPlanId: (v: string) => void
  setSubscriptionId: (v: string) => void
  setSubscriptionStatus: (v: string) => void
  setPlanType: (t: PlanType) => void
  updatePlanConfig: (patch: Partial<PlanConfig>) => void
  setStepResult: (s: StepId, status: StepStatus, response?: unknown, error?: string, debugId?: string) => void
  reset: () => void
}

const INITIAL_STATE = {
  accessToken: '',
  productId: '',
  planId: '',
  subscriptionId: '',
  subscriptionStatus: '',
  planType: 'fixed' as PlanType,
  stepStatus: {
    auth: 'idle',
    createProduct: 'idle',
    createPlan: 'idle',
    createSubscription: 'idle',
    approval: 'idle',
  } as Record<StepId, StepStatus>,
  responses: {} as Partial<Record<StepId, unknown>>,
  errors: {} as Partial<Record<StepId, string>>,
  debugIds: {} as Partial<Record<StepId, string>>,
  activeStep: 'auth' as StepId,
}

export const useFlowStore = create<FlowState>((set) => ({
  ...INITIAL_STATE,
  planConfig: defaultPlanConfig('fixed'),
  setActiveStep: (activeStep) => set({ activeStep }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setProductId: (productId) => set({ productId }),
  setPlanId: (planId) => set({ planId }),
  setSubscriptionId: (subscriptionId) => set({ subscriptionId }),
  setSubscriptionStatus: (subscriptionStatus) => set({ subscriptionStatus }),
  setPlanType: (planType) => set({ planType, planConfig: defaultPlanConfig(planType) }),
  updatePlanConfig: (patch) => set((state) => ({ planConfig: { ...state.planConfig, ...patch } })),
  setStepResult: (s, status, response, error, debugId) =>
    set((state) => ({
      stepStatus: { ...state.stepStatus, [s]: status },
      responses: response !== undefined ? { ...state.responses, [s]: response } : state.responses,
      errors: error !== undefined ? { ...state.errors, [s]: error } : state.errors,
      debugIds: debugId !== undefined ? { ...state.debugIds, [s]: debugId } : state.debugIds,
    })),
  reset: () => set({ ...INITIAL_STATE, planConfig: defaultPlanConfig('fixed') }),
}))
