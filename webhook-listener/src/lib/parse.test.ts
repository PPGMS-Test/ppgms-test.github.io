import { describe, it, expect } from 'vitest'
import { parseWebhookBody } from './parse'

describe('parseWebhookBody', () => {
  it('parses valid JSON with both event_type and resource_type', () => {
    const body = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        resource_type: 'capture',
      },
    })
    const result = parseWebhookBody(body)
    expect(result.event_type).toBe('PAYMENT.CAPTURE.COMPLETED')
    expect(result.resource_type).toBe('capture')
  })

  it('returns null for missing fields', () => {
    const body = JSON.stringify({ foo: 'bar' })
    const result = parseWebhookBody(body)
    expect(result.event_type).toBeNull()
    expect(result.resource_type).toBeNull()
  })

  it('returns null for non-JSON body', () => {
    const result = parseWebhookBody('not json at all')
    expect(result.event_type).toBeNull()
    expect(result.resource_type).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseWebhookBody('')
    expect(result.event_type).toBeNull()
    expect(result.resource_type).toBeNull()
  })

  it('handles event_type as non-string (should be null)', () => {
    const body = JSON.stringify({ event_type: 123 })
    const result = parseWebhookBody(body)
    expect(result.event_type).toBeNull()
  })

  it('handles resource without resource_type', () => {
    const body = JSON.stringify({ event_type: 'TEST', resource: { id: 'abc' } })
    const result = parseWebhookBody(body)
    expect(result.event_type).toBe('TEST')
    expect(result.resource_type).toBeNull()
  })
})