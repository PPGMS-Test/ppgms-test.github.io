import { describe, expect, it } from 'vitest'
import { extractActionUrl, extractApproveLink } from './StepDetail'

describe('extractActionUrl', () => {
  it('从 links 数组里取 rel 为 action_url 的 href', () => {
    const response = {
      links: [
        { rel: 'self', href: 'https://api-m.sandbox.paypal.com/v2/customer/partner-referrals/abc' },
        { rel: 'action_url', href: 'https://www.sandbox.paypal.com/bizsignup/partner/entry?referralToken=xyz' },
      ],
    }
    expect(extractActionUrl(response)).toBe(
      'https://www.sandbox.paypal.com/bizsignup/partner/entry?referralToken=xyz',
    )
  })

  it('没有 links 字段时返回 null', () => {
    expect(extractActionUrl({ id: 'ORDER1' })).toBeNull()
  })

  it('links 里没有 action_url 这个 rel 时返回 null', () => {
    const response = { links: [{ rel: 'self', href: 'https://x' }] }
    expect(extractActionUrl(response)).toBeNull()
  })

  it('response 不是对象（undefined/字符串等）时返回 null', () => {
    expect(extractActionUrl(undefined)).toBeNull()
    expect(extractActionUrl('error string')).toBeNull()
  })
})

describe('extractApproveLink', () => {
  it('从 create order 响应的 links 数组里取 rel 为 approve 的 href', () => {
    const response = {
      id: '7TR531468V3380749',
      links: [
        { href: 'https://api.sandbox.paypal.com/v2/checkout/orders/7TR531468V3380749', rel: 'self', method: 'GET' },
        {
          href: 'https://www.sandbox.paypal.com/checkoutnow?token=7TR531468V3380749',
          rel: 'approve',
          method: 'GET',
        },
      ],
    }
    expect(extractApproveLink(response)).toBe(
      'https://www.sandbox.paypal.com/checkoutnow?token=7TR531468V3380749',
    )
  })

  it('没有 approve 这个 rel 时返回 null', () => {
    const response = { links: [{ rel: 'self', href: 'https://x' }] }
    expect(extractApproveLink(response)).toBeNull()
  })

  it('没有 links 字段时返回 null', () => {
    expect(extractApproveLink({ id: 'ORDER1' })).toBeNull()
  })
})
