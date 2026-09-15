import { describe, it, expect } from 'vitest'
import { tokenizeJson, type JsonToken } from './json-highlight'

const has = (tokens: JsonToken[], text: string, type: JsonToken['type']) =>
  tokens.some((t) => t.text === text && t.type === type)

describe('tokenizeJson', () => {
  it('classifies keys, strings, numbers, booleans, and null', () => {
    const tokens = tokenizeJson({ id: 'CAP-1', n: 42, ok: true, empty: null })

    expect(has(tokens, '"id"', 'key')).toBe(true)
    expect(has(tokens, '"CAP-1"', 'string')).toBe(true)
    expect(has(tokens, '42', 'number')).toBe(true)
    expect(has(tokens, 'true', 'boolean')).toBe(true)
    expect(has(tokens, 'null', 'null')).toBe(true)
  })

  it('does not classify a quoted value as a key when no colon follows', () => {
    const tokens = tokenizeJson(['plain-string'])
    expect(has(tokens, '"plain-string"', 'string')).toBe(true)
    expect(tokens.some((t) => t.type === 'key')).toBe(false)
  })

  it('round-trips: concatenated token text equals the pretty JSON', () => {
    const value = { a: [1, 'x', false], b: { c: null } }
    const tokens = tokenizeJson(value)
    expect(tokens.map((t) => t.text).join('')).toBe(JSON.stringify(value, null, 2))
  })

  it('does not mis-tokenize keyword/number-like substrings inside a string value', () => {
    const tokens = tokenizeJson({ note: 'a 42 true "quoted" null' })
    // the whole value stays one string token; no stray number/boolean/null tokens from inside it
    expect(has(tokens, '"a 42 true \\"quoted\\" null"', 'string')).toBe(true)
    expect(tokens.some((t) => t.type === 'number')).toBe(false)
    expect(tokens.some((t) => t.type === 'boolean')).toBe(false)
    expect(tokens.some((t) => t.type === 'null')).toBe(false)
  })

  it('classifies negative and exponent numbers', () => {
    const tokens = tokenizeJson({ neg: -12, exp: -1.5e-10 })
    expect(has(tokens, '-12', 'number')).toBe(true)
    expect(has(tokens, '-1.5e-10', 'number')).toBe(true)
  })
})
