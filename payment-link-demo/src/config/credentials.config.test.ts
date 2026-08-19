import { describe, it, expect } from 'vitest'
import { createCredentialConfig } from './credentials.config'

describe('createCredentialConfig', () => {
  it('exposes the partner-v6 third-party preset', () => {
    const cfg = createCredentialConfig()
    expect(cfg.all().length).toBeGreaterThan(0)
    expect(cfg.byId('partner-v6')?.partnerMerchantId).toBe('2Z793HCNQFCS4')
  })

  it('default() returns the first preset', () => {
    const cfg = createCredentialConfig()
    expect(cfg.default().id).toBe(cfg.all()[0].id)
  })

  it('byId returns undefined for unknown id', () => {
    expect(createCredentialConfig().byId('nope')).toBeUndefined()
  })
})
