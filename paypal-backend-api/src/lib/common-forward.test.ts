import { describe, expect, it } from 'vitest'
import { resolveTargetUrl, pickForwardHeaders, FORWARD_HEADERS } from './common-forward'
import { PAYPAL_SANDBOX_BASE } from './paypal-rest'

describe('resolveTargetUrl', () => {
  it('合法 path 拼成 sandbox 完整 URL', () => {
    expect(resolveTargetUrl('/v2/checkout/orders')).toEqual({
      url: `${PAYPAL_SANDBOX_BASE}/v2/checkout/orders`,
    })
  })
  it('拒绝完整 URL（防 SSRF）', () => {
    expect('error' in resolveTargetUrl('https://evil.com/x')).toBe(true)
  })
  it('拒绝协议相对 //host', () => {
    expect('error' in resolveTargetUrl('//evil.com/x')).toBe(true)
  })
  it('拒绝不以 / 开头', () => {
    expect('error' in resolveTargetUrl('v2/checkout/orders')).toBe(true)
  })
  it('拒绝空值', () => {
    expect('error' in resolveTargetUrl(null)).toBe(true)
  })

  // SSRF 回归：以下 path 都能通过校验，但拼进 URL 后 host 必须仍是 sandbox，不能被换成 evil.com。
  it.each([
    '/\\evil.com',
    '/@evil.com',
    '/../../@evil.com',
    '/%2f%2fevil.com',
    '/http:evil.com',
  ])('通过校验的可疑 path 解析后 host 仍是 sandbox: %s', (path) => {
    const result = resolveTargetUrl(path)
    expect('url' in result).toBe(true)
    if ('url' in result) {
      expect(new URL(result.url).host).toBe(new URL(PAYPAL_SANDBOX_BASE).host)
    }
  })
})

describe('pickForwardHeaders', () => {
  it('只挑白名单头，丢弃控制头/其它头', () => {
    const h = new Headers({
      authorization: 'Bearer T',
      'content-type': 'application/json',
      prefer: 'return=representation',
      'paypal-partner-attribution-id': 'HKPSP',
      'paypal-auth-assertion': 'a.b.',
      'x-target-path': '/v2/checkout/orders',
      host: 'localhost',
    })
    const out = pickForwardHeaders(h)
    expect(out.authorization).toBe('Bearer T')
    expect(out['paypal-partner-attribution-id']).toBe('HKPSP')
    expect(out['paypal-auth-assertion']).toBe('a.b.')
    expect(out['x-target-path']).toBeUndefined()
    expect(out.host).toBeUndefined()
  })
  it('FORWARD_HEADERS 含 auth assertion 与 attribution id', () => {
    expect(FORWARD_HEADERS).toContain('paypal-auth-assertion')
    expect(FORWARD_HEADERS).toContain('paypal-partner-attribution-id')
  })
})
