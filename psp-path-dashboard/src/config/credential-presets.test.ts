import { describe, expect, it } from 'vitest'
import { CREDENTIAL_PRESETS, DEFAULT_PRESET_ID, getPresetById } from './credential-presets'

describe('credential-presets', () => {
  it('至少包含 2 套凭证，首套是 hkpsp', () => {
    expect(CREDENTIAL_PRESETS.length).toBeGreaterThanOrEqual(2)
    expect(CREDENTIAL_PRESETS[0].id).toBe('hkpsp')
  })

  it('DEFAULT_PRESET_ID 指向第一套', () => {
    expect(DEFAULT_PRESET_ID).toBe(CREDENTIAL_PRESETS[0].id)
  })

  it('每套凭证都带非空 bnCodes 列表', () => {
    for (const preset of CREDENTIAL_PRESETS) {
      expect(preset.bnCodes.length).toBeGreaterThan(0)
    }
  })

  it('getPresetById 能按 id 查到对应套', () => {
    const second = CREDENTIAL_PRESETS[1]
    expect(getPresetById(second.id)).toEqual(second)
  })

  it('getPresetById 查不到时回退到第一套', () => {
    expect(getPresetById('not-exist-id')).toEqual(CREDENTIAL_PRESETS[0])
  })
})
