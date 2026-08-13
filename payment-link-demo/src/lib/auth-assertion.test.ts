import { describe, it, expect } from 'vitest'
import { generatePayPalAuthAssertion } from './auth-assertion'

describe('generatePayPalAuthAssertion', () => {
  it('produces header.payload. with alg none and iss/payer_id', () => {
    const jwt = generatePayPalAuthAssertion('CLIENT_X', 'MERCHANT_Y')
    const [header, payload, sig] = jwt.split('.')
    expect(header).toBe('eyJhbGciOiJub25lIn0=')
    expect(sig).toBe('')
    const decoded = JSON.parse(atob(payload))
    expect(decoded).toEqual({ iss: 'CLIENT_X', payer_id: 'MERCHANT_Y' })
  })
})
