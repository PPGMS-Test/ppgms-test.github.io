import { beforeEach, describe, expect, it } from 'vitest'
import { useActivePresetStore } from './active-preset'
import { DEFAULT_PRESET_ID } from '@/config/credential-presets'

beforeEach(() => {
  localStorage.clear()
  useActivePresetStore.getState().setActivePresetId(DEFAULT_PRESET_ID)
})

describe('active preset store', () => {
  it('初始值为 DEFAULT_PRESET_ID', () => {
    expect(useActivePresetStore.getState().activePresetId).toBe(DEFAULT_PRESET_ID)
  })

  it('setActivePresetId 更新当前选中套', () => {
    useActivePresetStore.getState().setActivePresetId('preset-2')
    expect(useActivePresetStore.getState().activePresetId).toBe('preset-2')
  })

  it('持久化到 localStorage', () => {
    useActivePresetStore.getState().setActivePresetId('preset-2')
    expect(localStorage.getItem('psp-active-preset')).toContain('preset-2')
  })
})
