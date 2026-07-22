// src/store/credentials.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from './credentials'
import { useActivePresetStore } from './active-preset'
import { CREDENTIAL_PRESETS, DEFAULT_PRESET_ID } from '@/config/credential-presets'

const hkpsp = CREDENTIAL_PRESETS[0]

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useActivePresetStore.getState().setActivePresetId(DEFAULT_PRESET_ID)
  useCredentialsStore.getState().reset()
})

describe('credentials store', () => {
  it('默认预填当前激活套（HKPSP）凭证，初始即已配置', () => {
    expect(useCredentialsStore.getState().clientId).toBe(hkpsp.clientId)
    expect(useCredentialsStore.getState().bnCode).toBe(hkpsp.bnCodes[0].code)
    expect(useCredentialsStore.getState().isConfigured()).toBe(true)
  })
  it('清空 clientId/secret 后视为未配置', () => {
    useCredentialsStore.getState().setClientId('')
    useCredentialsStore.getState().setClientSecret('')
    expect(useCredentialsStore.getState().isConfigured()).toBe(false)
  })
  it('设置 clientId/secret 后视为已配置', () => {
    useCredentialsStore.getState().setClientId('cid')
    useCredentialsStore.getState().setClientSecret('csec')
    expect(useCredentialsStore.getState().isConfigured()).toBe(true)
  })
  it('持久化到 sessionStorage', () => {
    useCredentialsStore.getState().setClientId('cid')
    expect(sessionStorage.getItem('psp-credentials')).toContain('cid')
  })
  it('basicAuth 生成 base64(clientId:secret)', () => {
    useCredentialsStore.getState().setClientId('a')
    useCredentialsStore.getState().setClientSecret('b')
    expect(useCredentialsStore.getState().basicAuth()).toBe(btoa('a:b'))
  })
  it('applyPreset 用指定套的 clientId/secret/首个 bnCode 覆盖当前值', () => {
    const preset2 = CREDENTIAL_PRESETS[1]
    useCredentialsStore.getState().applyPreset(preset2)
    expect(useCredentialsStore.getState().clientId).toBe(preset2.clientId)
    expect(useCredentialsStore.getState().clientSecret).toBe(preset2.clientSecret)
    expect(useCredentialsStore.getState().bnCode).toBe(preset2.bnCodes[0].code)
  })
  it('reset 恢复为当前激活套的默认值', () => {
    useActivePresetStore.getState().setActivePresetId(CREDENTIAL_PRESETS[1].id)
    useCredentialsStore.getState().setClientId('custom')
    useCredentialsStore.getState().reset()
    expect(useCredentialsStore.getState().clientId).toBe(CREDENTIAL_PRESETS[1].clientId)
  })
})
