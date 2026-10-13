import type { PlanConfig } from './plan-config'

export function buildProductBody(name: string, description: string): object {
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

export function buildPlanBody(input: PlanBodyInput): object {
  const { productId, name, description, config } = input
  const hasTrial = config.planType === 'trial'

  const billingCycles: object[] = []

  if (hasTrial) {
    billingCycles.push({
      frequency: {
        interval_unit: config.trial.intervalUnit,
        interval_count: config.trial.intervalCount,
      },
      tenure_type: 'TRIAL',
      sequence: 1,
      total_cycles: config.trial.totalCycles,
      pricing_scheme: {
        fixed_price: {
          value: String(config.trial.price),
          currency_code: 'USD',
        },
      },
    })
  }

  billingCycles.push({
    frequency: {
      interval_unit: config.regular.intervalUnit,
      interval_count: config.regular.intervalCount,
    },
    tenure_type: 'REGULAR',
    sequence: hasTrial ? 2 : 1,
    total_cycles: config.regular.totalCycles,
    pricing_scheme: {
      fixed_price: {
        value: String(config.regular.price),
        currency_code: 'USD',
      },
    },
  })

  const paymentPreferences: Record<string, unknown> = {
    auto_bill_outstanding: true,
  }

  if (config.setupFee.amount !== 0) {
    paymentPreferences.setup_fee = {
      value: String(config.setupFee.amount),
      currency_code: 'USD',
    }
  }

  paymentPreferences.setup_fee_failure_action = config.setupFee.failureAction
  paymentPreferences.payment_failure_threshold = config.paymentFailureThreshold

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

export function buildSubscriptionBody(planId: string): object {
  return {
    plan_id: planId,
    application_context: {
      brand_name: 'Subscription Playground',
      shipping_preference: 'NO_SHIPPING',
      user_action: 'SUBSCRIBE_NOW',
      return_url: 'https://example.com/return',
      cancel_url: 'https://example.com/cancel',
    },
  }
}

export function buildReviseBody(newPlanId: string): object {
  return { plan_id: newPlanId }
}
