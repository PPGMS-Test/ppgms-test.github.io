import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from '@/store/credentials'
import { DEFAULT_CREDENTIALS } from '@/config/default-credentials'

beforeEach(() => {
  sessionStorage.clear()
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

    store.setClientId('')
    store.setClientSecret('EC')
    expect(store.isConfigured()).toBe(false)
  })

  it('完整凭证存在时 isConfigured 应返回 true', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('custom_id')
    store.setClientSecret('custom_secret')
    expect(store.isConfigured()).toBe(true)
  })
})
