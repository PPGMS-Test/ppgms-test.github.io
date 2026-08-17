import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPayPalClient } from './client'
import { createPayPalConfig } from '@/config/paypal.config'
import type { PartnerCredential } from '@/config/credentials.config'
import { ApiError } from './types'
import type { CreatePaymentResourceInput } from './types'

const credential: PartnerCredential = {
  id: 'x', label: 'x', environment: 'sandbox',
  partnerClientId: 'CID', partnerClientSecret: 'SEC', partnerMerchantId: 'MID',
}

const minimalInput: CreatePaymentResourceInput = {
  reusable: 'MULTIPLE',
  line_items: [{ name: 'Tote', unit_amount: { currency_code: 'USD', value: '160.00' } }],
}

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let i = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses[Math.min(i++, responses.length - 1)]
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => JSON.stringify(r.body) } as Response
  }))
  return calls
}

describe('createPayPalClient', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('createLink first fetches oauth token then POSTs to payment-resources with auth headers', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 201, body: { id: 'PLB-1', payment_link: 'https://pp/ncp/payment/PLB-1' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    const res = await client.createLink(minimalInput)

    expect(res.id).toBe('PLB-1')
    expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token')
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources')
    expect(calls[1].init.method).toBe('POST')
    const headers = calls[1].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer TOK')
    expect(headers['PayPal-Auth-Assertion']).toMatch(/^eyJhbGciOiJub25lIn0=\./)
    expect(headers['PayPal-Partner-Attribution-Id']).toBeTruthy()
    // 幂等键必须随每个 POST 一起发出
    expect(headers['PayPal-Request-Id']).toBeTruthy()
  })

  it('createLink sends the documented PLB body shape (integration_mode/type/reusable/line_items)', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 201, body: { id: 'PLB-2', payment_link: 'https://pp/ncp/payment/PLB-2' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.createLink({
      reusable: 'SINGLE',
      return_url: 'https://shop.test/#/return?link=abc&status=paid',
      line_items: [
        {
          name: 'Headphones',
          product_id: 'SKU-1',
          unit_amount: { currency_code: 'USD', value: '199.99' },
          taxes: [{ name: 'Sales Tax', type: 'PERCENTAGE', value: '8.25' }],
          collect_shipping_address: true,
        },
      ],
    })
    const body = JSON.parse(calls[1].init.body as string)
    expect(body.integration_mode).toBe('LINK')
    expect(body.type).toBe('BUY_NOW')
    expect(body.reusable).toBe('SINGLE')
    expect(body.return_url).toBe('https://shop.test/#/return?link=abc&status=paid')
    expect(body.line_items[0].name).toBe('Headphones')
    expect(body.line_items[0].unit_amount).toEqual({ currency_code: 'USD', value: '199.99' })
    expect(body.line_items[0].taxes[0]).toEqual({ name: 'Sales Tax', type: 'PERCENTAGE', value: '8.25' })
    // 旧的 application_context/cancel_url 不应出现
    expect(body.application_context).toBeUndefined()
  })

  it('createLink reuses a caller-supplied idempotency key (for retries)', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 201, body: { id: 'PLB-3' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.createLink(minimalInput, 'fixed-key-123')
    const headers = calls[1].init.headers as Record<string, string>
    expect(headers['PayPal-Request-Id']).toBe('fixed-key-123')
  })

  it('listLinks builds page_size/page_token/status query params', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { resources: [] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.listLinks({ pageSize: 2, pageToken: 'TKN', status: 'ACTIVE' })
    expect(calls[1].init.method).toBe('GET')
    const url = new URL(calls[1].url)
    expect(url.pathname).toBe('/v1/checkout/payment-resources')
    expect(url.searchParams.get('page_size')).toBe('2')
    expect(url.searchParams.get('page_token')).toBe('TKN')
    expect(url.searchParams.get('status')).toBe('ACTIVE')
  })

  it('listLinks with no options hits the bare collection endpoint', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { resources: [] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.listLinks()
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources')
  })

  it('getLink/updateLink/deleteLink hit the item endpoint with id and right method', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { id: 'PLB-9' } },
      { status: 204, body: null },
      { status: 204, body: null },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.getLink('PLB-9')
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources/PLB-9')
    expect(calls[1].init.method).toBe('GET')

    await client.updateLink('PLB-9', minimalInput)
    expect(calls[2].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources/PLB-9')
    expect(calls[2].init.method).toBe('PUT')

    await client.deleteLink('PLB-9')
    expect(calls[3].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources/PLB-9')
    expect(calls[3].init.method).toBe('DELETE')
  })

  it('reuses the cached token across two calls (oauth fetched only once)', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { resources: [] } },
      { status: 200, body: { resources: [] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.listLinks()
    await client.listLinks()

    const oauthUrl = 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
    expect(calls.filter((c) => c.url === oauthUrl)).toHaveLength(1)
    expect(calls.filter((c) => c.url.endsWith('/payment-resources'))).toHaveLength(2)
  })

  it('rejects with ApiError carrying .status and .debugId on a non-2xx response', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 403, body: { message: 'denied', debug_id: 'dbg-123' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await expect(client.createLink(minimalInput)).rejects.toMatchObject({ status: 403, debugId: 'dbg-123' })
  })

  it('rejects with an ApiError instance', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 422, body: { message: 'bad' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await expect(client.createLink(minimalInput)).rejects.toBeInstanceOf(ApiError)
  })
})
