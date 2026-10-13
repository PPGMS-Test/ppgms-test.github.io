import type { IntervalUnit, PlanConfig } from './plan-config'

const CURRENCY_CODE = 'USD'

const APPLICATION_CONTEXT_DEFAULTS = {
  brand_name: 'Subscription Playground',
  shipping_preference: 'NO_SHIPPING' as const,
  user_action: 'SUBSCRIBE_NOW' as const,
  return_url: 'https://example.com/return',
  cancel_url: 'https://example.com/cancel',
}

export interface ProductBody {
  name: string
  description: string
  type: 'SERVICE'
  category: 'SOFTWARE'
}

export function buildProductBody(name: string, description: string): ProductBody {
  return {
    name,
    description,
    type: 'SERVICE',
    category: 'SOFTWARE',
  }
}

export interface PlanBodyInput {
  productId: string
  name: string
  description: string
  config: PlanConfig
}

export interface BillingCycle {
  frequency: {
    interval_unit: IntervalUnit
    interval_count: number
  }
  tenure_type: 'TRIAL' | 'REGULAR'
  sequence: number
  total_cycles: number
  pricing_scheme: {
    fixed_price: {
      value: string
      currency_code: string
    }
  }
}

export interface PaymentPreferences {
  auto_bill_outstanding: boolean
  setup_fee?: {
    value: string
    currency_code: string
  }
  setup_fee_failure_action: string
  payment_failure_threshold: number
}

export interface PlanBody {
  product_id: string
  name: string
  description: string
  billing_cycles: BillingCycle[]
  payment_preferences: PaymentPreferences
  taxes: {
    percentage: string
    inclusive: boolean
  }
}

function buildBillingCycle(params: {
  intervalUnit: IntervalUnit
  intervalCount: number
  tenureType: 'TRIAL' | 'REGULAR'
  sequence: number
  totalCycles: number
  price: number
}): BillingCycle {
  return {
    frequency: { interval_unit: params.intervalUnit, interval_count: params.intervalCount },
    tenure_type: params.tenureType,
    sequence: params.sequence,
    total_cycles: params.totalCycles,
    pricing_scheme: { fixed_price: { value: String(params.price), currency_code: CURRENCY_CODE } },
  }
}

export function buildPlanBody(input: PlanBodyInput): PlanBody {
  const { productId, name, description, config } = input
  const hasTrial = config.planType === 'trial'

  const billingCycles: BillingCycle[] = []

  if (hasTrial) {
    billingCycles.push(
      buildBillingCycle({
        intervalUnit: config.trial.intervalUnit,
        intervalCount: config.trial.intervalCount,
        tenureType: 'TRIAL',
        sequence: 1,
        totalCycles: config.trial.totalCycles,
        price: config.trial.price,
      })
    )
  }

  billingCycles.push(
    buildBillingCycle({
      intervalUnit: config.regular.intervalUnit,
      intervalCount: config.regular.intervalCount,
      tenureType: 'REGULAR',
      sequence: hasTrial ? 2 : 1,
      totalCycles: config.regular.totalCycles,
      price: config.regular.price,
    })
  )

  const paymentPreferences: PaymentPreferences = {
    auto_bill_outstanding: true,
    setup_fee_failure_action: config.setupFee.failureAction,
    payment_failure_threshold: config.paymentFailureThreshold,
  }

  if (config.setupFee.amount !== 0) {
    paymentPreferences.setup_fee = {
      value: String(config.setupFee.amount),
      currency_code: CURRENCY_CODE,
    }
  }

  return {
    product_id: productId,
    name,
    description,
    billing_cycles: billingCycles,
    payment_preferences: paymentPreferences,
    taxes: {
      percentage: String(config.tax.percentage),
      inclusive: config.tax.inclusive,
    },
  }
}

export interface SubscriptionBody {
  plan_id: string
  application_context: {
    brand_name: string
    shipping_preference: 'NO_SHIPPING'
    user_action: 'SUBSCRIBE_NOW'
    return_url: string
    cancel_url: string
  }
}

export function buildSubscriptionBody(planId: string): SubscriptionBody {
  return {
    plan_id: planId,
    application_context: {
      ...APPLICATION_CONTEXT_DEFAULTS,
    },
  }
}

export interface ReviseBody {
  plan_id: string
}

export function buildReviseBody(newPlanId: string): ReviseBody {
  return { plan_id: newPlanId }
}
