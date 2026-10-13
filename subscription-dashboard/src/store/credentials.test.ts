import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from './credentials'

beforeEach(() => {
  sessionStorage.clear()
  useCredentialsStore.getState().reset()
})

describe('credentials store', () => {
  it('初始为空，视为未配置', () => {
    expect(useCredentialsStore.getState().clientId).toBe('')
    expect(useCredentialsStore.getState().isConfigured()).toBe(false)
  })

  it('设置 clientId/secret 后视为已配置', () => {
    useCredentialsStore.getState().setClientId('cid')
    useCredentialsStore.getState().setClientSecret('csec')
    expect(useCredentialsStore.getState().isConfigured()).toBe(true)
  })

  it('持久化到 sessionStorage', () => {
    useCredentialsStore.getState().setClientId('cid')
    expect(sessionStorage.getItem('subscription-credentials')).toContain('cid')
  })

  it('basicAuth 生成 base64(clientId:secret)', () => {
    useCredentialsStore.getState().setClientId('a')
    useCredentialsStore.getState().setClientSecret('b')
    expect(useCredentialsStore.getState().basicAuth()).toBe(btoa('a:b'))
  })

  it('reset 清空凭证', () => {
    useCredentialsStore.getState().setClientId('x')
    useCredentialsStore.getState().reset()
    expect(useCredentialsStore.getState().clientId).toBe('')
  })
})
