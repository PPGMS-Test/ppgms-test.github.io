import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildPartnerReferralBody,
  buildPspOrderBody,
  createPartnerReferral,
  createPspOrder,
  capturePspOrder,
  createReferencedPayout,
  refundCapture,
  parseBearerToken,
} from './psp'
import { PayPalAuthError, PAYPAL_SANDBOX_BASE } from './paypal-rest'

function mockFetchOnce(status = 200, json: unknown = { ok: true }) {
  const spy = vi.fn().mockResolvedValue({
    status,
    json: () => Promise.resolve(json),
  } as Response)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('parseBearerToken', () => {
  it('提取 Bearer token', () => {
    const req = new Request('http://x', { headers: { authorization: 'Bearer abc.def' } })
    expect(parseBearerToken(req)).toBe('abc.def')
  })
  it('缺失时抛 PayPalAuthError', () => {
    const req = new Request('http://x')
    expect(() => parseBearerToken(req)).toThrow(PayPalAuthError)
  })
})

describe('body 模板', () => {
  it('partner referral 含 DELAY_FUNDS_DISBURSEMENT 与 tracking_id', () => {
    const body = buildPartnerReferralBody('trk-1', 'https://ret')
    expect(body.tracking_id).toBe('trk-1')
    const features = body.operations[0].api_integration_preference.rest_api_integration
      .third_party_details.features
    expect(features).toContain('DELAY_FUNDS_DISBURSEMENT')
    expect(body.partner_configuration_override.return_url).toBe('https://ret')
  })
  it('order body 带 payee email 与金额', () => {
    const body = buildPspOrderBody({ amount: '160.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'r1' })
    expect(body.intent).toBe('CAPTURE')
    expect(body.purchase_units[0].payee.email_address).toBe('m@x.com')
    expect(body.purchase_units[0].amount.value).toBe('160.00')
  })
})

describe('PSP fetch 封装', () => {
  it('createPspOrder 带 Bearer + BN code header 打 orders 接口', async () => {
    const spy = mockFetchOnce(201, { id: 'ORDER1' })
    const { status, data } = await createPspOrder('tok', { amount: '1.00', currency: 'GBP', payeeEmail: 'm@x.com', referenceId: 'r', bnCode: 'BN123' })
    expect(status).toBe(201)
    expect((data as { id: string }).id).toBe('ORDER1')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`)
    expect((init as RequestInit).method).toBe('POST')
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok')
    expect(headers['PayPal-Partner-Attribution-Id']).toBe('BN123')
  })

  it('capturePspOrder 打 capture 接口并带 BN code', async () => {
    const spy = mockFetchOnce(201, { id: 'ORDER1', status: 'COMPLETED' })
    await capturePspOrder('tok', 'ORDER1', 'BN123')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/checkout/orders/ORDER1/capture`)
    expect(((init as RequestInit).headers as Record<string, string>)['PayPal-Partner-Attribution-Id']).toBe('BN123')
  })

  it('createReferencedPayout 用 capture_id 组 TRANSACTION_ID body', async () => {
    const spy = mockFetchOnce(200, { items: [] })
    await createReferencedPayout('tok', 'CAP99')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v1/payments/referenced-payouts-items`)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ reference_type: 'TRANSACTION_ID', reference_id: 'CAP99' })
  })

  it('refundCapture 打 refund 接口', async () => {
    const spy = mockFetchOnce(201, { id: 'REF1', status: 'COMPLETED' })
    await refundCapture('tok', 'CAP99')
    const [url] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/payments/captures/CAP99/refund`)
  })

  it('createPartnerReferral 打 partner-referrals 接口', async () => {
    const spy = mockFetchOnce(201, { links: [] })
    await createPartnerReferral('tok', 'trk-1', 'https://ret')
    const [url] = spy.mock.calls[0]
    expect(url).toBe(`${PAYPAL_SANDBOX_BASE}/v2/customer/partner-referrals`)
  })
})
