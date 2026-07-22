import { beforeEach, describe, expect, it } from 'vitest'
import { applyCredentialPreset } from './apply-preset'
import { useActivePresetStore } from './active-preset'
import { useCredentialsStore } from './credentials'
import { useFlowStore } from './flow'
import { CREDENTIAL_PRESETS, DEFAULT_PRESET_ID } from '@/config/credential-presets'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useActivePresetStore.getState().setActivePresetId(DEFAULT_PRESET_ID)
  useCredentialsStore.getState().reset()
  useFlowStore.getState().reset()
})

describe('applyCredentialPreset', () => {
  it('切换到 preset-2 后，三个 store 的相关字段都同步更新', () => {
    const preset2 = CREDENTIAL_PRESETS[1]
    applyCredentialPreset(preset2.id)

    expect(useActivePresetStore.getState().activePresetId).toBe(preset2.id)
    expect(useCredentialsStore.getState().clientId).toBe(preset2.clientId)
    expect(useCredentialsStore.getState().clientSecret).toBe(preset2.clientSecret)
    expect(useCredentialsStore.getState().bnCode).toBe(preset2.bnCodes[0].code)
    expect(useFlowStore.getState().config.payerId).toBe(preset2.payerId)
    expect(useFlowStore.getState().config.payeeEmail).toBe(preset2.payeeEmail)
  })

  it('传入不存在的 id 时回退到第一套', () => {
    applyCredentialPreset('not-exist')
    expect(useCredentialsStore.getState().clientId).toBe(CREDENTIAL_PRESETS[0].clientId)
  })
})
