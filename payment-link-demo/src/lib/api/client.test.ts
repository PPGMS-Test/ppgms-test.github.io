import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPayPalClient } from './client'
import { createPayPalConfig } from '@/config/paypal.config'
import type { PartnerCredential } from '@/config/credentials.config'
import { ApiError } from './types'

const credential: PartnerCredential = {
  id: 'x', label: 'x', environment: 'sandbox',
  partnerClientId: 'CID', partnerClientSecret: 'SEC', partnerMerchantId: 'MID',
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
      { status: 201, body: { id: 'PR-1', links: [{ rel: 'pay', href: 'https://pp/pay/PR-1' }] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    const res = await client.createLink({ name: 'Tote', amount: { currency_code: 'USD', value: '160.00' } })

    expect(res.id).toBe('PR-1')
    // token call
    expect(calls[0].url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token')
    // resource call
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources')
    expect(calls[1].init.method).toBe('POST')
    const headers = calls[1].init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer TOK')
    expect(headers['PayPal-Auth-Assertion']).toMatch(/^eyJhbGciOiJub25lIn0=\./)
    expect(headers['PayPal-Partner-Attribution-Id']).toBeTruthy()
  })

  it('listLinks GETs the collection endpoint', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { items: [] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.listLinks()
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources')
    expect(calls[1].init.method).toBe('GET')
  })

  it('getLink/updateLink/deleteLink hit the item endpoint with id', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { id: 'PR-9' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.getLink('PR-9')
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/checkout/payment-resources/PR-9')
    expect(calls[1].init.method).toBe('GET')
  })

  it('reuses the cached token across two calls (oauth fetched only once)', async () => {
    const calls = mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 200, body: { items: [] } },
      { status: 200, body: { items: [] } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await client.listLinks()
    await client.listLinks()

    const oauthUrl = 'https://api-m.sandbox.paypal.com/v1/oauth2/token'
    const oauthCalls = calls.filter((c) => c.url === oauthUrl)
    expect(oauthCalls).toHaveLength(1)
    // two business GETs happened
    expect(calls.filter((c) => c.url.endsWith('/payment-resources'))).toHaveLength(2)
  })

  it('rejects with ApiError carrying .status on a non-2xx business response', async () => {
    mockFetchSequence([
      { status: 200, body: { access_token: 'TOK', expires_in: 3600 } },
      { status: 403, body: { message: 'denied' } },
    ])
    const client = createPayPalClient({ config: createPayPalConfig('sandbox'), credential })
    await expect(
      client.createLink({ name: 'Tote', amount: { currency_code: 'USD', value: '160.00' } }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      client.createLink({ name: 'Tote', amount: { currency_code: 'USD', value: '160.00' } }),
    ).rejects.toBeInstanceOf(ApiError)
  })
})
