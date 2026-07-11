import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from '@/store/credentials'
import { DEFAULT_CREDENTIALS } from '@/config/default-credentials'

beforeEach(() => {
  // Clear sessionStorage completely
  sessionStorage.clear()
  // Reset store to initial state
  const store = useCredentialsStore.getState()
  store.reset()
})

describe('CredentialsPage', () => {
  it('应该初始化为默认凭证（HKPSP sandbox）', () => {
    const store = useCredentialsStore.getState()
    expect(store.clientId).toBe(DEFAULT_CREDENTIALS.clientId)
    expect(store.clientSecret).toBe(DEFAULT_CREDENTIALS.clientSecret)
    expect(store.bnCode).toBe(DEFAULT_CREDENTIALS.bnCode)
    expect(store.isConfigured()).toBe(true)
  })

  it('应该支持修改 clientId', () => {
    const store = useCredentialsStore.getState()
    const newId = 'A21CUSTOM123'
    store.setClientId(newId)
    expect(useCredentialsStore.getState().clientId).toBe(newId)
  })

  it('应该支持修改 clientSecret', () => {
    const store = useCredentialsStore.getState()
    const newSecret = 'EC_CUSTOM_SECRET_XYZ'
    store.setClientSecret(newSecret)
    expect(useCredentialsStore.getState().clientSecret).toBe(newSecret)
  })

  it('应该支持修改 BN Code', () => {
    const store = useCredentialsStore.getState()
    const newBnCode = 'CUSTOM_BN_PSP'
    store.setBnCode(newBnCode)
    expect(useCredentialsStore.getState().bnCode).toBe(newBnCode)
  })

  it('清空所有凭证后应该重置为默认值', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('custom')
    store.setClientSecret('secret')
    store.setBnCode('custom_bn')
    store.reset()

    const resetStore = useCredentialsStore.getState()
    expect(resetStore.clientId).toBe(DEFAULT_CREDENTIALS.clientId)
    expect(resetStore.clientSecret).toBe(DEFAULT_CREDENTIALS.clientSecret)
    expect(resetStore.bnCode).toBe(DEFAULT_CREDENTIALS.bnCode)
  })

  it('修改后的值应该存储在 sessionStorage', () => {
    const store = useCredentialsStore.getState()
    const testId = 'TEST_CLIENT_ID_123'
    const testSecret = 'TEST_SECRET_456'

    store.setClientId(testId)
    store.setClientSecret(testSecret)

    const stored = sessionStorage.getItem('psp-credentials')
    expect(stored).toBeTruthy()
    expect(stored).toContain(testId)
    expect(stored).toContain(testSecret)
  })

  it('isConfigured 应该在 clientId 和 clientSecret 都存在时返回 true', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('A21')
    store.setClientSecret('EC')
    expect(useCredentialsStore.getState().isConfigured()).toBe(true)

    store.setClientId('')
    expect(useCredentialsStore.getState().isConfigured()).toBe(false)

    store.setClientId('A21')
    store.setClientSecret('')
    expect(useCredentialsStore.getState().isConfigured()).toBe(false)
  })

  it('basicAuth 应该返回 base64 编码的 clientId:secret', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('myid')
    store.setClientSecret('mysecret')
    expect(useCredentialsStore.getState().basicAuth()).toBe(btoa('myid:mysecret'))
  })
})
