import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from './credentials'

beforeEach(() => {
  sessionStorage.clear()
  useCredentialsStore.getState().reset()
})

describe('credentials store', () => {
  it('初始未配置', () => {
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
})
