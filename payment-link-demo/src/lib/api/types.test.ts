import { describe, it, expect } from 'vitest'
import { extractPayUrl, extractQrCodeUrl, extractNextPageToken } from './types'
import type { PaymentResource, PaymentResourceList } from './types'

describe('extractPayUrl', () => {
  it('prefers the top-level payment_link field', () => {
    const res: PaymentResource = {
      id: 'PLB-1',
      payment_link: 'https://www.sandbox.paypal.com/ncp/payment/PLB-1',
      links: [{ rel: 'payment_link', href: 'https://other/should-not-win' }],
    }
    expect(extractPayUrl(res)).toBe('https://www.sandbox.paypal.com/ncp/payment/PLB-1')
  })

  it('falls back to links[] rel=payment_link when no top-level field', () => {
    const res: PaymentResource = {
      id: 'PLB-2',
      links: [
        { rel: 'self', href: 'https://api/self', method: 'GET' },
        { rel: 'payment_link', href: 'https://www.paypal.com/ncp/payment/PLB-2', method: 'GET' },
      ],
    }
    expect(extractPayUrl(res)).toBe('https://www.paypal.com/ncp/payment/PLB-2')
  })

  it('returns null when neither payment_link nor the rel exists', () => {
    expect(extractPayUrl({ id: 'PLB-3', links: [{ rel: 'self', href: 'https://api/self' }] })).toBeNull()
    expect(extractPayUrl({ id: 'PLB-4', links: [] })).toBeNull()
    expect(extractPayUrl({ id: 'PLB-5' })).toBeNull()
  })
})

describe('extractQrCodeUrl', () => {
  it('prefers the top-level qr_code field', () => {
    const res: PaymentResource = {
      id: 'PLB-Q1',
      qr_code: 'https://www.paypal.com/qrcodes/managed/abc',
      links: [{ rel: 'qr_code', href: 'https://other/should-not-win' }],
    }
    expect(extractQrCodeUrl(res)).toBe('https://www.paypal.com/qrcodes/managed/abc')
  })

  it('falls back to links[] rel=qr_code (or qrcode)', () => {
    expect(
      extractQrCodeUrl({ id: 'PLB-Q2', links: [{ rel: 'qr_code', href: 'https://pp/qr/2', method: 'GET' }] }),
    ).toBe('https://pp/qr/2')
    expect(
      extractQrCodeUrl({ id: 'PLB-Q3', links: [{ rel: 'qrcode', href: 'https://pp/qr/3' }] }),
    ).toBe('https://pp/qr/3')
  })

  it('returns null when no qr code is present', () => {
    expect(extractQrCodeUrl({ id: 'PLB-Q4', payment_link: 'https://pp/ncp/x' })).toBeNull()
  })
})

describe('extractNextPageToken', () => {  it('parses page_token from the rel=next link', () => {
    const list: PaymentResourceList = {
      resources: [],
      links: [
        { rel: 'self', href: 'https://api.paypal.com/v1/checkout/payment-resources?page_size=2' },
        { rel: 'next', href: 'https://api.paypal.com/v1/checkout/payment-resources?page_token=ABC123&page_size=2' },
      ],
    }
    expect(extractNextPageToken(list)).toBe('ABC123')
  })

  it('returns null when there is no next link', () => {
    expect(extractNextPageToken({ resources: [], links: [{ rel: 'self', href: 'https://api/x' }] })).toBeNull()
    expect(extractNextPageToken({ resources: [] })).toBeNull()
  })
})
