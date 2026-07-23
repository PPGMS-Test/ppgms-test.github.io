import { describe, it, expect } from 'vitest'
import { STEPS_DETAILED, STEPS_BY_PHASE, FUND_FLOW, STEPS } from '@/lib/steps'

describe('steps.ts', () => {
  it('should have all 8 steps defined in STEPS_DETAILED', () => {
    expect(Object.keys(STEPS_DETAILED)).toHaveLength(8)
    expect(STEPS_DETAILED.auth).toBeDefined()
    expect(STEPS_DETAILED.onboarding).toBeDefined()
    expect(STEPS_DETAILED.createOrder).toBeDefined()
    expect(STEPS_DETAILED.capture).toBeDefined()
    expect(STEPS_DETAILED.disburse).toBeDefined()
    expect(STEPS_DETAILED.refund).toBeDefined()
  })

  it('should have correct phases for each step', () => {
    expect(STEPS_DETAILED.auth.phase).toBe('AUTH')
    expect(STEPS_DETAILED.onboarding.phase).toBe('ONBOARDING')
    expect(STEPS_DETAILED.createOrder.phase).toBe('ORDER')
    expect(STEPS_DETAILED.capture.phase).toBe('ORDER')
    expect(STEPS_DETAILED.disburse.phase).toBe('MONEY_MOVE')
    expect(STEPS_DETAILED.refund.phase).toBe('MONEY_MOVE')
  })

  it('should have STEPS_BY_PHASE correctly populated', () => {
    expect(STEPS_BY_PHASE.AUTH).toEqual(['auth'])
    expect(STEPS_BY_PHASE.ONBOARDING).toEqual(['onboarding'])
    expect(STEPS_BY_PHASE.ORDER).toEqual(['createOrder', 'capture'])
    expect(STEPS_BY_PHASE.MONEY_MOVE).toEqual(['disburse', 'refund'])
  })

  it('should have apiInfo for each step', () => {
    (['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as const).forEach((stepId) => {
      const step = STEPS_DETAILED[stepId]
      expect(step.apiInfo).toBeDefined()
      expect(['POST', 'GET']).toContain(step.apiInfo.method)
      expect(step.apiInfo.endpoint).toBeTruthy()
      expect(step.apiInfo.description).toBeTruthy()
    })
  })

  it('should have payloadFields with required flags', () => {
    (['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as const).forEach((stepId) => {
      const step = STEPS_DETAILED[stepId]
      expect(step.payloadFields.length).toBeGreaterThan(0)
      step.payloadFields.forEach((field) => {
        expect(field.name).toBeTruthy()
        expect(typeof field.required).toBe('boolean')
        expect(field.description).toBeTruthy()
      })
    })
  })

  it('should have responseHighlights with field names', () => {
    (['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as const).forEach((stepId) => {
      const step = STEPS_DETAILED[stepId]
      expect(step.responseHighlights.length).toBeGreaterThan(0)
      step.responseHighlights.forEach((hl) => {
        expect(hl.field).toBeTruthy()
        expect(hl.description).toBeTruthy()
      })
    })
  })

  it('should have fundFlowStage and description for each step', () => {
    (['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as const).forEach((stepId) => {
      const step = STEPS_DETAILED[stepId]
      expect(step.fundFlowStage).toBeTruthy()
      expect(step.description).toBeTruthy()
      expect(step.name).toBeTruthy()
    })
  })

  it('should have FUND_FLOW with 5 segments', () => {
    expect(FUND_FLOW).toHaveLength(5)
    expect(FUND_FLOW[0].label).toBe('Buyer')
    expect(FUND_FLOW[1].label).toBe('PayPal GL')
    expect(FUND_FLOW[2].label).toBe('PSA')
    expect(FUND_FLOW[3].label).toBe('PSP Bank')
    expect(FUND_FLOW[4].label).toBe('Merchant')
  })

  it('should have hex colors for fund flow segments (consumed as inline style, not tailwind classes)', () => {
    FUND_FLOW.forEach((segment) => {
      expect(segment.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(segment.description).toBeTruthy()
    })
  })

  it('should have backward-compatible STEPS array', () => {
    expect(STEPS).toHaveLength(8)
    expect(STEPS[0].id).toBe('auth')
    expect(STEPS[1].id).toBe('onboarding')
    expect(STEPS[2].id).toBe('createOrder')
    expect(STEPS[3].id).toBe('capture')
    expect(STEPS[4].id).toBe('refund')
    expect(STEPS[7].id).toBe('disburse')
  })

  it('should have matching IDs between STEPS_DETAILED and STEPS', () => {
    STEPS.forEach((def) => {
      const detailed = STEPS_DETAILED[def.id]
      expect(detailed).toBeDefined()
      expect(detailed.id).toBe(def.id)
    })
  })

  it('should have docReference for all steps except optional ones', () => {
    (['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as const).forEach((stepId) => {
      const step = STEPS_DETAILED[stepId]
      // All steps should have a doc reference
      expect(step.docReference).toBeTruthy()
      expect(step.docReference).toMatch(/^§/)
    })
  })
})
