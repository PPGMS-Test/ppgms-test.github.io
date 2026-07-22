// src/components/TopBar.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById, CREDENTIAL_PRESETS, DEFAULT_PRESET_ID } from '@/config/credential-presets'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useActivePresetStore.getState().setActivePresetId(DEFAULT_PRESET_ID)
  useCredentialsStore.getState().reset()
})

describe('TopBar component', () => {
  it('应该从 store 读取 isConfigured 状态', () => {
    const store = useCredentialsStore.getState()
    expect(store.isConfigured()).toBe(true) // 初始预填 HKPSP sandbox 凭证
  })

  it('清空凭证后 isConfigured 应返回 false', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('')
    store.setClientSecret('')
    expect(store.isConfigured()).toBe(false)
  })

  it('部分凭证缺失时 isConfigured 应返回 false', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('A21')
    store.setClientSecret('')
    expect(store.isConfigured()).toBe(false)
  })

  it('完整凭证存在时 isConfigured 应返回 true', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('custom_id')
    store.setClientSecret('custom_secret')
    expect(store.isConfigured()).toBe(true)
  })

  it('徽章文案应取自当前激活凭证套的 label', () => {
    expect(getPresetById(useActivePresetStore.getState().activePresetId).label).toBe(CREDENTIAL_PRESETS[0].label)
    useActivePresetStore.getState().setActivePresetId(CREDENTIAL_PRESETS[1].id)
    expect(getPresetById(useActivePresetStore.getState().activePresetId).label).toBe(CREDENTIAL_PRESETS[1].label)
  })
})
