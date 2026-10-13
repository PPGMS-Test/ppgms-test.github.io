import { describe, expect, it } from 'vitest'
import { defaultPlanConfig } from './plan-config'

describe('defaultPlanConfig', () => {
  it('fixed: returns regular MONTH/1/19.99/0 and setupFee.amount 0', () => {
    const config = defaultPlanConfig('fixed')
    expect(config.planType).toBe('fixed')
    expect(config.regular).toEqual({
      intervalUnit: 'MONTH',
      intervalCount: 1,
      price: 19.99,
      totalCycles: 0,
    })
    expect(config.setupFee.amount).toBe(0)
  })

  it('trial: returns trial DAY/14/1 cycle with price 0', () => {
    const config = defaultPlanConfig('trial')
    expect(config.planType).toBe('trial')
    expect(config.trial.intervalUnit).toBe('DAY')
    expect(config.trial.intervalCount).toBe(14)
    expect(config.trial.totalCycles).toBe(1)
    expect(config.trial.price).toBe(0)
    expect(config.setupFee.amount).toBe(0)
  })

  it('setupFee: returns setupFee.amount 10 and failureAction CONTINUE', () => {
    const config = defaultPlanConfig('setupFee')
    expect(config.planType).toBe('setupFee')
    expect(config.setupFee.amount).toBe(10)
    expect(config.setupFee.failureAction).toBe('CONTINUE')
  })

  it('regular stage, paymentFailureThreshold, and tax are consistent across all plan types', () => {
    const fixed = defaultPlanConfig('fixed')
    const trial = defaultPlanConfig('trial')
    const setupFee = defaultPlanConfig('setupFee')

    const expectedRegular = {
      intervalUnit: 'MONTH',
      intervalCount: 1,
      price: 19.99,
      totalCycles: 0,
    }

    for (const config of [fixed, trial, setupFee]) {
      expect(config.regular).toEqual(expectedRegular)
      expect(config.paymentFailureThreshold).toBe(3)
      expect(config.tax).toEqual({ percentage: 0, inclusive: false })
    }
  })
})
