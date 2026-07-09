import { describe, expect, it } from 'vitest'
import { generateAuthAssertion } from './auth-assertion'

describe('generateAuthAssertion', () => {
  it('生成三段式 JWT（第三段签名为空）', () => {
    const jwt = generateAuthAssertion('CID', 'PAYER1')
    const parts = jwt.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[2]).toBe('')
  })
  it('payload 解码出 iss 与 payer_id', () => {
    const jwt = generateAuthAssertion('CID', 'PAYER1')
    const payload = JSON.parse(atob(jwt.split('.')[1]))
    expect(payload).toEqual({ iss: 'CID', payer_id: 'PAYER1' })
  })
})
