import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyWebhookSignature } from './verify'

// We test only the decision logic — the actual HTTP calls are mocked out.

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns skipped when PAYPAL_CLIENT_ID is missing', async () => {
    const status = await verifyWebhookSignature(
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://...',
        'paypal-transmission-id': 'abc',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        // PAYPAL_CLIENT_ID missing
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when PAYPAL_CLIENT_SECRET is missing', async () => {
    const status = await verifyWebhookSignature(
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://...',
        'paypal-transmission-id': 'abc',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        // PAYPAL_CLIENT_SECRET missing
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
    )
    expect(status).toBe('skipped')
  })

  it('returns skipped when PAYPAL_WEBHOOK_ID is missing', async () => {
    const status = await verifyWebhookSignature(
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://...',
        'paypal-transmission-id': 'abc',
        'paypal-transmission-sig': 'sig',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        // PAYPAL_WEBHOOK_ID missing
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
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
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
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://cert.paypal.com',
        'paypal-transmission-id': 'txn-123',
        'paypal-transmission-sig': 'sig-value',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
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
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://cert.paypal.com',
        'paypal-transmission-id': 'txn-123',
        'paypal-transmission-sig': 'sig-value',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
    )
    expect(status).toBe('failed')
  })

  it('returns error when fetch throws', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error')) as unknown as typeof fetch

    const status = await verifyWebhookSignature(
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://cert.paypal.com',
        'paypal-transmission-id': 'txn-123',
        'paypal-transmission-sig': 'sig-value',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      '{"event_type":"TEST"}',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
    )
    expect(status).toBe('error')
  })

  it('returns error when body is not valid JSON', async () => {
    // Even with all credentials set, unparseable body leads to error
    const status = await verifyWebhookSignature(
      {
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-cert-url': 'https://cert.paypal.com',
        'paypal-transmission-id': 'txn-123',
        'paypal-transmission-sig': 'sig-value',
        'paypal-transmission-time': '2024-01-01T00:00:00Z',
      },
      'not valid json{{{',
      {
        PAYPAL_ENV: 'sandbox',
        PAYPAL_CLIENT_ID: 'client-id',
        PAYPAL_CLIENT_SECRET: 'secret',
        PAYPAL_WEBHOOK_ID: 'webhook-id',
      }
    )
    expect(status).toBe('error')
  })
})