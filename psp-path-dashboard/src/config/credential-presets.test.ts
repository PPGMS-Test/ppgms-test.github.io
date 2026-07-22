import { describe, expect, it } from 'vitest'
import { CREDENTIAL_PRESETS, DEFAULT_PRESET_ID, getBnCodeCountry, getPresetById } from './credential-presets'

describe('credential-presets', () => {
  it('至少包含 2 套凭证，首套是 hkpsp', () => {
    expect(CREDENTIAL_PRESETS.length).toBeGreaterThanOrEqual(2)
    expect(CREDENTIAL_PRESETS[0].id).toBe('hkpsp')
  })

  it('DEFAULT_PRESET_ID 指向第一套', () => {
    expect(DEFAULT_PRESET_ID).toBe(CREDENTIAL_PRESETS[0].id)
  })

  it('每套凭证都带非空 bnCodes 列表，且每个 bnCode 都带 country', () => {
    for (const preset of CREDENTIAL_PRESETS) {
      expect(preset.bnCodes.length).toBeGreaterThan(0)
      for (const bnCode of preset.bnCodes) {
        expect(bnCode.code).toBeTruthy()
        expect(bnCode.country).toBeTruthy()
      }
    }
  })

  it('getPresetById 能按 id 查到对应套', () => {
    const second = CREDENTIAL_PRESETS[1]
    expect(getPresetById(second.id)).toEqual(second)
  })

  it('getPresetById 查不到时回退到第一套', () => {
    expect(getPresetById('not-exist-id')).toEqual(CREDENTIAL_PRESETS[0])
  })

  it('getBnCodeCountry 按 code 查到对应国家', () => {
    const preset = CREDENTIAL_PRESETS[1]
    expect(getBnCodeCountry(preset, preset.bnCodes[0].code)).toBe(preset.bnCodes[0].country)
    expect(getBnCodeCountry(preset, preset.bnCodes[1].code)).toBe(preset.bnCodes[1].country)
  })

  it('getBnCodeCountry 查不到时返回 undefined', () => {
    expect(getBnCodeCountry(CREDENTIAL_PRESETS[0], 'not-a-real-code')).toBeUndefined()
  })
})
