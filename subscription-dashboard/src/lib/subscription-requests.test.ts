import { describe, expect, it } from 'vitest'
import { defaultPlanConfig } from './plan-config'
import {
  buildProductBody,
  buildPlanBody,
  buildSubscriptionBody,
  buildReviseBody,
  type PlanBody,
} from './subscription-requests'

describe('buildProductBody', () => {
  it('returns the exact product shape', () => {
    expect(buildProductBody('My Product', 'A description')).toEqual({
      name: 'My Product',
      description: 'A description',
      type: 'SERVICE',
      category: 'SOFTWARE',
    })
  })
})

describe('buildPlanBody', () => {
  it('fixed planType: single REGULAR cycle, no setup_fee, taxes percentage "0"', () => {
    const config = defaultPlanConfig('fixed')
    const body: PlanBody = buildPlanBody({
      productId: 'PROD-1',
      name: 'Plan Name',
      description: 'Plan Desc',
      config,
    })

    expect(body.product_id).toBe('PROD-1')
    expect(body.name).toBe('Plan Name')
    expect(body.description).toBe('Plan Desc')
    expect(body.billing_cycles).toHaveLength(1)
    expect(body.billing_cycles[0]).toEqual({
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: '19.99', currency_code: 'USD' } },
    })
    expect(body.payment_preferences).not.toHaveProperty('setup_fee')
    expect(body.payment_preferences.setup_fee_failure_action).toBe('CONTINUE')
    expect(body.payment_preferences.payment_failure_threshold).toBe(3)
    expect(body.payment_preferences.auto_bill_outstanding).toBe(true)
    expect(body.taxes).toEqual({ percentage: '0', inclusive: false })
  })

  it('trial planType: TRIAL cycle sequence 1, REGULAR cycle sequence 2', () => {
    const config = defaultPlanConfig('trial')
    const body: PlanBody = buildPlanBody({
      productId: 'PROD-2',
      name: 'Trial Plan',
      description: 'Trial Desc',
      config,
    })

    expect(body.billing_cycles).toHaveLength(2)
    expect(body.billing_cycles[0]).toEqual({
      frequency: { interval_unit: 'DAY', interval_count: 14 },
      tenure_type: 'TRIAL',
      sequence: 1,
      total_cycles: 1,
      pricing_scheme: { fixed_price: { value: '0', currency_code: 'USD' } },
    })
    expect(body.billing_cycles[1]).toMatchObject({
      tenure_type: 'REGULAR',
      sequence: 2,
    })
  })

  it('setupFee planType: setup_fee present with string value', () => {
    const config = defaultPlanConfig('setupFee')
    const body: PlanBody = buildPlanBody({
      productId: 'PROD-3',
      name: 'Setup Fee Plan',
      description: 'Desc',
      config,
    })

    expect(body.payment_preferences.setup_fee).toEqual({
      value: '10',
      currency_code: 'USD',
    })
    expect(body.payment_preferences.setup_fee_failure_action).toBe('CONTINUE')
  })
})

describe('buildSubscriptionBody', () => {
  it('returns the correct minimal shape', () => {
    expect(buildSubscriptionBody('P-123')).toEqual({
      plan_id: 'P-123',
      application_context: {
        brand_name: 'Subscription Playground',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: 'https://example.com/return',
        cancel_url: 'https://example.com/cancel',
      },
    })
  })
})

describe('buildReviseBody', () => {
  it('returns the correct minimal shape', () => {
    expect(buildReviseBody('P-456')).toEqual({ plan_id: 'P-456' })
  })
})
