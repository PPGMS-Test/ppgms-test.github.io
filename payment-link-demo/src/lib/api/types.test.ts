import { describe, it, expect } from 'vitest'
import { extractPayUrl } from './types'
import type { PaymentResource } from './types'

function res(links?: PaymentResource['links']): PaymentResource {
  return { id: 'PR', links }
}

describe('extractPayUrl', () => {
  it('prefers the "pay" rel over everything else', () => {
    expect(
      extractPayUrl(
        res([
          { rel: 'approve', href: 'https://pp/approve' },
          { rel: 'pay', href: 'https://pp/pay' },
          { rel: 'payer-action', href: 'https://pp/payer-action' },
        ]),
      ),
    ).toBe('https://pp/pay')
  })

  it('falls back to "approve" when no "pay"', () => {
    expect(
      extractPayUrl(
        res([
          { rel: 'payer-action', href: 'https://pp/payer-action' },
          { rel: 'approve', href: 'https://pp/approve' },
        ]),
      ),
    ).toBe('https://pp/approve')
  })

  it('falls back to "payer-action" when no "pay"/"approve"', () => {
    expect(
      extractPayUrl(res([{ rel: 'payer-action', href: 'https://pp/payer-action' }])),
    ).toBe('https://pp/payer-action')
  })

  it('falls back to the first link when no known rel matches', () => {
    expect(
      extractPayUrl(res([{ rel: 'self', href: 'https://pp/self' }])),
    ).toBe('https://pp/self')
  })

  it('returns null when links is empty', () => {
    expect(extractPayUrl(res([]))).toBeNull()
  })

  it('returns null when links is absent', () => {
    expect(extractPayUrl(res(undefined))).toBeNull()
  })
})
