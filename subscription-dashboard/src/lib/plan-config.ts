export type PlanType = 'fixed' | 'trial' | 'setupFee'
export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
export type FailureAction = 'CONTINUE' | 'CANCEL'

export interface PlanConfig {
  planType: PlanType
  trial: {
    intervalUnit: IntervalUnit
    intervalCount: number // 1-30
    totalCycles: number // 1-5
    price: number // 0-50 USD, 0 = free trial
  }
  regular: {
    intervalUnit: IntervalUnit
    intervalCount: number
    price: number // 1-500 USD
    totalCycles: number // 0-24, 0 = infinite renewal
  }
  setupFee: {
    amount: number // 0-100
    failureAction: FailureAction
  }
  paymentFailureThreshold: number // 1-5
  tax: {
    percentage: number // 0-20
    inclusive: boolean
  }
}

export function defaultPlanConfig(planType: PlanType): PlanConfig {
  return {
    planType,
    trial: {
      intervalUnit: 'DAY',
      intervalCount: 14,
      totalCycles: 1,
      price: 0,
    },
    regular: {
      intervalUnit: 'MONTH',
      intervalCount: 1,
      price: 19.99,
      totalCycles: 0,
    },
    setupFee: {
      amount: planType === 'setupFee' ? 10 : 0,
      failureAction: 'CONTINUE',
    },
    paymentFailureThreshold: 3,
    tax: {
      percentage: 0,
      inclusive: false,
    },
  }
}
