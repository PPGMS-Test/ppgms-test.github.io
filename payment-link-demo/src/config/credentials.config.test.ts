import { describe, it, expect } from 'vitest'
import { createCredentialConfig } from './credentials.config'

describe('createCredentialConfig', () => {
  it('exposes at least the shoppaas-test preset', () => {
    const cfg = createCredentialConfig()
    expect(cfg.all().length).toBeGreaterThan(0)
    expect(cfg.byId('shoppaas-test')?.partnerMerchantId).toBe('TVARY8GX789ZA')
  })

  it('default() returns the first preset', () => {
    const cfg = createCredentialConfig()
    expect(cfg.default().id).toBe(cfg.all()[0].id)
  })

  it('byId returns undefined for unknown id', () => {
    expect(createCredentialConfig().byId('nope')).toBeUndefined()
  })
})
