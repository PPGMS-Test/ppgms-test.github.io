import { describe, it, expect, vi } from 'vitest'

// Must mock @/lib/db before importing auth.ts
vi.mock('@/lib/db', () => ({
  getDB: vi.fn(() => {
    throw new Error('getDB should not be called from password tests')
  }),
}))

import { createPasswordHash, verifyPassword } from './auth'

describe('auth — password hashing', () => {
  it('creates hash and salt, and verifies correct password', async () => {
    const { hash, salt } = await createPasswordHash('my-secret-password')
    expect(hash).toBeTruthy()
    expect(salt).toBeTruthy()
    expect(hash).not.toBe('my-secret-password')

    const valid = await verifyPassword('my-secret-password', hash, salt)
    expect(valid).toBe(true)
  })

  it('rejects incorrect password', async () => {
    const { hash, salt } = await createPasswordHash('correct-password')
    const valid = await verifyPassword('wrong-password', hash, salt)
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password (different salts)', async () => {
    const result1 = await createPasswordHash('same-password')
    const result2 = await createPasswordHash('same-password')
    expect(result1.hash).not.toBe(result2.hash)
    expect(result1.salt).not.toBe(result2.salt)

    // Both should verify correctly
    const valid1 = await verifyPassword('same-password', result1.hash, result1.salt)
    const valid2 = await verifyPassword('same-password', result2.hash, result2.salt)
    expect(valid1).toBe(true)
    expect(valid2).toBe(true)
  })
})