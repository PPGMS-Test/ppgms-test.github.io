import { describe, expect, it } from 'vitest'
import { computeBillingTimeline } from './billing-timeline'
import { defaultPlanConfig, type PlanConfig } from './plan-config'

describe('computeBillingTimeline', () => {
  it('fixed plan: infinite renewal preview caps at 3 regular charges', () => {
    const config = defaultPlanConfig('fixed')
    const timeline = computeBillingTimeline(config)

    const regularCharges = timeline.filter((e) => e.label.startsWith('正式扣款'))
    expect(regularCharges).toHaveLength(3)
    expect(regularCharges.map((e) => e.day)).toEqual([0, 30, 60])
    expect(regularCharges.map((e) => e.amount)).toEqual([19.99, 19.99, 19.99])

    const infoEvent = timeline.find((e) => e.label.includes('无限续费'))
    expect(infoEvent).toBeDefined()
    expect(infoEvent!.day).toBe(60)
    expect(infoEvent!.amount).toBe(0)

    expect(timeline[0]).toEqual({ day: 0, label: '批准订阅', amount: 0 })
    // approval + 3 regular charges + 1 info event, no setup fee, no trial
    expect(timeline).toHaveLength(5)
  })

  it('caps infinite renewal preview at 3 even with a very short interval', () => {
    const config: PlanConfig = {
      ...defaultPlanConfig('fixed'),
      regular: {
        intervalUnit: 'DAY',
        intervalCount: 1,
        price: 5,
        totalCycles: 0,
      },
    }
    const timeline = computeBillingTimeline(config)
    const regularCharges = timeline.filter((e) => e.label.startsWith('正式扣款'))
    expect(regularCharges).toHaveLength(3)
    expect(regularCharges.map((e) => e.day)).toEqual([0, 1, 2])
  })

  it('trial with multiple cycles followed by finite regular cycles', () => {
    const config: PlanConfig = {
      ...defaultPlanConfig('trial'),
      trial: {
        intervalUnit: 'DAY',
        intervalCount: 14,
        totalCycles: 2,
        price: 0,
      },
      regular: {
        intervalUnit: 'MONTH',
        intervalCount: 1,
        price: 19.99,
        totalCycles: 2,
      },
    }
    const timeline = computeBillingTimeline(config)

    const trialCharges = timeline.filter((e) => e.label.startsWith('试用期扣款'))
    expect(trialCharges.map((e) => e.day)).toEqual([0, 14])
    expect(trialCharges.every((e) => e.amount === 0)).toBe(true)

    const regularCharges = timeline.filter((e) => e.label.startsWith('正式扣款'))
    expect(regularCharges.map((e) => e.day)).toEqual([28, 58])

    // finite totalCycles -> no infinite-renewal info event
    expect(timeline.find((e) => e.label.includes('无限续费'))).toBeUndefined()
  })

  it('setup fee event appears on day 0 right after approval, before regular charges', () => {
    const config = defaultPlanConfig('setupFee')
    const timeline = computeBillingTimeline(config)

    expect(timeline[0]).toEqual({ day: 0, label: '批准订阅', amount: 0 })
    const setupFeeEvent = timeline[1]
    expect(setupFeeEvent.day).toBe(0)
    expect(setupFeeEvent.label).toContain('Setup Fee')
    expect(setupFeeEvent.amount).toBe(10)

    const setupFeeIndex = timeline.indexOf(setupFeeEvent)
    const firstRegularIndex = timeline.findIndex((e) => e.label.startsWith('正式扣款'))
    expect(firstRegularIndex).toBeGreaterThan(setupFeeIndex)
  })
})
