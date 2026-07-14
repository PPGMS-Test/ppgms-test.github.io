import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAccessToken, callCommon, type ApiResult } from './api'
import { useCredentialsStore } from '@/store/credentials'

// Mock fetch global
global.fetch = vi.fn()

describe('api.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset credentials store
    useCredentialsStore.setState({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      bnCode: 'test-bn-code',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('fetchAccessToken', () => {
    it('should fetch access token successfully', async () => {
      const mockToken = 'mock-access-token-abc123'
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ accessToken: mockToken }),
      })

      const result = await fetchAccessToken()

      expect(result).toEqual({
        ok: true,
        status: 200,
        data: { accessToken: mockToken },
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/byok/psp/access-token'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Basic'),
          }),
        }),
      )
    })

    it('should return error response when fetch fails with 401', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })

      const result = await fetchAccessToken()

      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(result.data.error).toBe('Unauthorized')
    })

    it('should handle JSON parse error gracefully', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const result = await fetchAccessToken()

      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      expect(result.data).toEqual({})
    })

    it('should include Basic auth header with base64 encoded credentials', async () => {
      useCredentialsStore.setState({
        clientId: 'myapp',
        clientSecret: 'mysecret',
        bnCode: '',
      })

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ accessToken: 'token' }),
      })

      await fetchAccessToken()

      const callArgs = (global.fetch as any).mock.calls[0][1]
      const authHeader = callArgs.headers.Authorization
      // btoa('myapp:mysecret') === 'bXlhcHA6bXlzZWNyZXQ='
      expect(authHeader).toBe('Basic bXlhcHA6bXlzZWNyZXQ=')
    })
  })

  describe('callCommon', () => {
    it('should extract x-paypal-debug-id response header into debugId', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: (name: string) => (name === 'x-paypal-debug-id' ? 'DBG-123' : null) },
        json: () => Promise.resolve({ id: 'order-123' }),
      })

      const result = await callCommon('/v2/checkout/orders', { token: 'mock-token' })

      expect(result.debugId).toBe('DBG-123')
    })

    it('should leave debugId undefined when response has no debug id header', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: () => Promise.resolve({ id: 'order-123' }),
      })

      const result = await callCommon('/v2/checkout/orders', { token: 'mock-token' })

      expect(result.debugId).toBeUndefined()
    })

    it('should call common endpoint with POST method by default', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: () => Promise.resolve({ id: 'order-123' }),
      })

      const result = await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
        rawBody: '{"intent":"CAPTURE"}',
      })

      expect(result).toEqual({
        ok: true,
        status: 201,
        data: { id: 'order-123' },
      })
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/common'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-target-path': '/v2/checkout/orders',
            'x-target-method': 'POST',
            'Authorization': 'Bearer mock-token',
            'Prefer': 'return=representation',
          }),
          body: '{"intent":"CAPTURE"}',
        }),
      )
    })

    it('should use custom method when specified', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({ status: 'COMPLETED' }),
      })

      await callCommon('/v2/checkout/orders/123', {
        method: 'GET',
        token: 'mock-token',
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.headers['x-target-method']).toBe('GET')
    })

    it('should include bnCode in headers when provided', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
      })

      await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
        bnCode: 'TESTBNCODE123',
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.headers['PayPal-Partner-Attribution-Id']).toBe('TESTBNCODE123')
    })

    it('should include authAssertion in headers when provided', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
      })

      const mockAssertion = 'eyJhbGciOiJub25lIn0.eyJpc3MiOiJjaWQiLCJwYXllcl9pZCI6InAxIn0.'

      await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
        authAssertion: mockAssertion,
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.headers['PayPal-Auth-Assertion']).toBe(mockAssertion)
    })

    it('should not include body when rawBody is undefined', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
      })

      await callCommon('/v2/payments/captures/123/refund', {
        token: 'mock-token',
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.body).toBeUndefined()
    })

    it('should handle API error responses', async () => {
      const errorResponse = {
        name: 'INVALID_REQUEST',
        message: 'Invalid request body',
        details: [{ field: 'amount', value: 'invalid' }],
      }
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: { get: () => null },
        json: () => Promise.resolve(errorResponse),
      })

      const result = await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
        rawBody: '{}',
      })

      expect(result.ok).toBe(false)
      expect(result.status).toBe(400)
      expect(result.data).toEqual(errorResponse)
    })

    it('should handle JSON parse errors in response', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        json: () => Promise.reject(new Error('Invalid JSON')),
      })

      const result = await callCommon('/v2/checkout/orders/123', {
        token: 'mock-token',
      })

      expect(result.ok).toBe(true)
      expect(result.status).toBe(204)
      expect(result.data).toEqual({})
    })

    it('should build correct API base URL for dev environment', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
      })

      await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
      })

      const callUrl = (global.fetch as any).mock.calls[0][0]
      expect(callUrl).toContain('/api/common')
    })

    it('should not include optional headers when not provided', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.resolve({}),
      })

      await callCommon('/v2/checkout/orders', {
        token: 'mock-token',
        // bnCode and authAssertion not provided
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.headers['PayPal-Partner-Attribution-Id']).toBeUndefined()
      expect(callArgs.headers['PayPal-Auth-Assertion']).toBeUndefined()
    })

    it('should include multiple headers correctly for full request', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: { get: () => null },
        json: () => Promise.resolve({ id: 'order-456' }),
      })

      const mockAssertion = 'eyJhbGciOiJub25lIn0.eyJpc3MiOiJjaWQiLCJwYXllcl9pZCI6InAxIn0.'

      const result = await callCommon('/v2/checkout/orders', {
        method: 'POST',
        rawBody: '{"purchase_units":[{"amount":{"currency_code":"USD","value":"100"}}]}',
        token: 'abc123xyz',
        bnCode: 'HKPSP0001',
        authAssertion: mockAssertion,
      })

      const callArgs = (global.fetch as any).mock.calls[0][1]
      expect(callArgs.headers).toEqual({
        'Content-Type': 'application/json',
        'x-target-path': '/v2/checkout/orders',
        'x-target-method': 'POST',
        'Authorization': 'Bearer abc123xyz',
        'Prefer': 'return=representation',
        'PayPal-Partner-Attribution-Id': 'HKPSP0001',
        'PayPal-Auth-Assertion': mockAssertion,
      })
      expect(callArgs.body).toBe('{"purchase_units":[{"amount":{"currency_code":"USD","value":"100"}}]}')
      expect((result.data as any).id).toBe('order-456')
    })
  })

  describe('ApiResult type', () => {
    it('should have correct shape for success response', () => {
      const result: ApiResult<{ id: string }> = {
        ok: true,
        status: 200,
        data: { id: 'test-123' },
      }
      expect(result.ok).toBe(true)
      expect(result.data.id).toBe('test-123')
    })

    it('should have correct shape for error response', () => {
      const result: ApiResult<{ error: string }> = {
        ok: false,
        status: 400,
        data: { error: 'Invalid request' },
      }
      expect(result.ok).toBe(false)
      expect(result.data.error).toBe('Invalid request')
    })
  })
})
