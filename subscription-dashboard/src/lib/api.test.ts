import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAccessToken, callCommon } from './api'
import { useCredentialsStore } from '@/store/credentials'

const originalFetch = global.fetch

beforeEach(() => {
  sessionStorage.clear()
  useCredentialsStore.setState({ clientId: 'cid', clientSecret: 'csec' })
})

afterEach(() => {
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchAccessToken', () => {
  it('成功时返回 ok=true 和 accessToken', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ accessToken: 'tok123' }),
    }) as unknown as typeof fetch

    const result = await fetchAccessToken()
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.data.accessToken).toBe('tok123')
  })

  it('用 clientId:clientSecret 的 base64 作为 Basic auth header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await fetchAccessToken()

    const [, init] = fetchMock.mock.calls[0]
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${btoa('cid:csec')}`)
  })

  it('401 时返回 ok=false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ error: 'invalid_client' }),
    }) as unknown as typeof fetch

    const result = await fetchAccessToken()
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
  })

  it('响应体不是合法 JSON 时不抛错，data 为空对象', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        throw new Error('bad json')
      },
    }) as unknown as typeof fetch

    const result = await fetchAccessToken()
    expect(result.data).toEqual({})
  })
})

describe('callCommon', () => {
  it('默认用 POST，并从响应头提取 debugId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'x-paypal-debug-id': 'debug-1' }),
      json: async () => ({ id: 'PROD-1' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await callCommon('/v1/catalogs/products', { token: 'tok', rawBody: '{"name":"x"}' })

    expect(result.ok).toBe(true)
    expect(result.debugId).toBe('debug-1')
    expect(result.data).toEqual({ id: 'PROD-1' })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers['x-target-path']).toBe('/v1/catalogs/products')
    expect(init.headers['x-target-method']).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(init.body).toBe('{"name":"x"}')
  })

  it('支持自定义 method（如 GET 查询状态）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ status: 'ACTIVE' }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await callCommon('/v1/billing/subscriptions/SUB-1', { token: 'tok', method: 'GET' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['x-target-method']).toBe('GET')
  })

  it('不传 rawBody 时请求体省略（如 capture 步骤）', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await callCommon('/v1/billing/subscriptions/SUB-1/capture', { token: 'tok' })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
  })

  it('错误响应（如 404）ok=false，仍解析 data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      json: async () => ({ name: 'RESOURCE_NOT_FOUND' }),
    }) as unknown as typeof fetch

    const result = await callCommon('/v1/billing/subscriptions/NOPE', { token: 'tok', method: 'GET' })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(404)
    expect(result.data).toEqual({ name: 'RESOURCE_NOT_FOUND' })
  })

  it('响应体不是合法 JSON 时不抛错，data 为空对象', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        throw new Error('bad json')
      },
    }) as unknown as typeof fetch

    const result = await callCommon('/v1/catalogs/products', { token: 'tok' })
    expect(result.data).toEqual({})
  })
})
