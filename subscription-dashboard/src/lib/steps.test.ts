import { describe, expect, it } from 'vitest'
import { STEPS } from './steps'

describe('STEPS', () => {
  it('has exactly 5 entries, sorted by order (1-based index + 1)', () => {
    expect(STEPS).toHaveLength(5)
    STEPS.forEach((step, index) => {
      expect(step.order).toBe(index + 1)
    })
  })

  it('has unique ids for every step', () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length)
  })
})
