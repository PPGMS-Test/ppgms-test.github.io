import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  compose,
  withAuthHeaders,
  withErrorNormalization,
  withLogging,
  type RequestFn,
  type ApiRequest,
} from './enhancers'
import { ApiError } from './types'

const req: ApiRequest = {
  label: 'test',
  method: 'GET',
  path: '/x',
  url: 'https://api/x',
  headers: {},
}

describe('compose', () => {
  it('applies enhancers left-to-right (outermost first)', async () => {
    const order: string[] = []
    const mk = (tag: string) => (next: RequestFn): RequestFn => async (r) => {
      order.push(`in:${tag}`)
      const res = await next(r)
      order.push(`out:${tag}`)
      return res
    }
    const base: RequestFn = async () => ({ status: 200, ok: true, data: null })
    await compose(mk('a'), mk('b'))(base)(req)
    expect(order).toEqual(['in:a', 'in:b', 'out:b', 'out:a'])
  })
})

describe('withAuthHeaders', () => {
  it('merges resolved auth headers under request headers', async () => {
    const seen: Record<string, string>[] = []
    const base: RequestFn = async (r) => {
      seen.push(r.headers)
      return { status: 200, ok: true, data: null }
    }
    const enh = withAuthHeaders(async () => ({ Authorization: 'Bearer T' }))
    await enh(base)({ ...req, headers: { 'X-Custom': '1' } })
    expect(seen[0]).toEqual({ Authorization: 'Bearer T', 'X-Custom': '1' })
  })
})

describe('withErrorNormalization', () => {
  it('throws ApiError on non-ok using PayPal error fields', async () => {
    const base: RequestFn = async () => ({ status: 403, ok: false, data: { message: 'nope' } })
    await expect(withErrorNormalization(base)(req)).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'nope',
    })
  })

  it('passes through ok responses', async () => {
    const base: RequestFn = async () => ({ status: 200, ok: true, data: { id: '1' } })
    const res = await withErrorNormalization(base)(req)
    expect(res.data).toEqual({ id: '1' })
  })
})

describe('withLogging', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('logs and returns the response unchanged', async () => {
    const base: RequestFn = async () => ({ status: 200, ok: true, data: 'x' })
    const res = await withLogging(base)(req)
    expect(res.data).toBe('x')
    expect(console.log).toHaveBeenCalled()
  })
})
