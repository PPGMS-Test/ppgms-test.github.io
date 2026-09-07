import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyWebhookSignature } from './verify'

// We test only the decision logic — the actual HTTP calls are mocked out.

const validCredentials = {
  env: 'sandbox' as const,
  clientId: 'client-id',
  clientSecret: 'secret',
  webhookId: 'webhook-id',
}

const validHeaders = {
  'paypal-auth-algo': 'SHA256withRSA',
  'paypal-cert-url': 'https://cert.paypal.com',
  'paypal-transmission-id': 'txn-123',
  'paypal-transmission-sig': 'sig-value',
  'paypal-transmission-time': '2024-01-01T00:00:00Z',
}

const validBody = '{"event_type":"TEST"}'

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns skipped when credentials is null', async () => {
    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      null
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when clientId is missing', async () => {
    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      {
        env: 'sandbox',
        clientId: '',
        clientSecret: 'secret',
        webhookId: 'webhook-id',
      }
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when clientSecret is missing', async () => {
    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      {
        env: 'sandbox',
        clientId: 'client-id',
        clientSecret: '',
        webhookId: 'webhook-id',
      }
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when webhookId is missing', async () => {
    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      {
        env: 'sandbox',
        clientId: 'client-id',
        clientSecret: 'secret',
        webhookId: '',
      }
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when PayPal verification headers are missing', async () => {
    const status = await verifyWebhookSignature(
      {
        // Only some headers present
        'paypal-auth-algo': 'SHA256withRSA',
      },
      validBody,
      validCredentials
    )
    expect(status).toBe('skipped')
  })

  it('returns verified when PayPal responds with SUCCESS', async () => {
    // Mock fetch for oath + verify
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
        })
      ) as unknown as typeof fetch

    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      validCredentials
    )
    expect(status).toBe('verified')
  })

  it('returns failed when PayPal responds with non-SUCCESS status', async () => {
    global.fetch = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'mock-token' }),
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ verification_status: 'FAILURE' }),
        })
      ) as unknown as typeof fetch

    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      validCredentials
    )
    expect(status).toBe('failed')
  })

  it('returns error when fetch throws', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch

    const status = await verifyWebhookSignature(
      validHeaders,
      validBody,
      validCredentials
    )
    expect(status).toBe('error')
  })

  it('returns error when body is not valid JSON', async () => {
    // Even with all credentials set, unparseable body leads to error
    const status = await verifyWebhookSignature(
      validHeaders,
      'not valid json{{{',
      validCredentials
    )
    expect(status).toBe('error')
  })
})