// src/pages/CredentialsPage.test.ts
// 本文件不做组件渲染测试（项目未引入 @testing-library/react），
// 而是测试 CredentialsPage 依赖的 store 行为——即 radio 交互实际触发的逻辑。
import { beforeEach, describe, expect, it } from 'vitest'
import { useCredentialsStore } from '@/store/credentials'
import { useActivePresetStore } from '@/store/active-preset'
import { useFlowStore } from '@/store/flow'
import { applyCredentialPreset } from '@/store/apply-preset'
import { CREDENTIAL_PRESETS, DEFAULT_PRESET_ID } from '@/config/credential-presets'

const hkpsp = CREDENTIAL_PRESETS[0]

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  useActivePresetStore.getState().setActivePresetId(DEFAULT_PRESET_ID)
  useCredentialsStore.getState().reset()
  useFlowStore.getState().reset()
})

describe('CredentialsPage', () => {
  it('应该初始化为默认凭证套（HKPSP sandbox）', () => {
    const store = useCredentialsStore.getState()
    expect(store.clientId).toBe(hkpsp.clientId)
    expect(store.clientSecret).toBe(hkpsp.clientSecret)
    expect(store.bnCode).toBe(hkpsp.bnCodes[0].code)
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

  it('bnCode radio 选中某个值后应该写入 store（模拟点击 preset 内某个 bnCode）', () => {
    const store = useCredentialsStore.getState()
    const newBnCode = 'CUSTOM_BN_PSP'
    store.setBnCode(newBnCode)
    expect(useCredentialsStore.getState().bnCode).toBe(newBnCode)
  })

  it('清空所有凭证后应该重置为当前激活套默认值', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('custom')
    store.setClientSecret('secret')
    store.setBnCode('custom_bn')
    store.reset()

    const resetStore = useCredentialsStore.getState()
    expect(resetStore.clientId).toBe(hkpsp.clientId)
    expect(resetStore.clientSecret).toBe(hkpsp.clientSecret)
    expect(resetStore.bnCode).toBe(hkpsp.bnCodes[0].code)
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
  })

  it('basicAuth 应该返回 base64 编码的 clientId:secret', () => {
    const store = useCredentialsStore.getState()
    store.setClientId('myid')
    store.setClientSecret('mysecret')
    expect(useCredentialsStore.getState().basicAuth()).toBe(btoa('myid:mysecret'))
  })

  it('选中凭证套 radio（模拟点击）应通过 applyCredentialPreset 联动 clientId/secret/bnCode', () => {
    const preset2 = CREDENTIAL_PRESETS[1]
    applyCredentialPreset(preset2.id)
    const store = useCredentialsStore.getState()
    expect(store.clientId).toBe(preset2.clientId)
    expect(store.bnCode).toBe(preset2.bnCodes[0].code)
    expect(useActivePresetStore.getState().activePresetId).toBe(preset2.id)
  })

  it('Payee Email 初始值取自当前激活凭证套，且可在本页修改', () => {
    expect(useFlowStore.getState().config.payeeEmail).toBe(hkpsp.payeeEmail)
    useFlowStore.getState().updateConfig({ payeeEmail: 'custom@test.com' })
    expect(useFlowStore.getState().config.payeeEmail).toBe('custom@test.com')
  })

  it('Payer ID 初始值取自当前激活凭证套，且可在本页修改', () => {
    expect(useFlowStore.getState().config.payerId).toBe(hkpsp.payerId)
    useFlowStore.getState().updateConfig({ payerId: 'CUSTOM_PAYER_ID' })
    expect(useFlowStore.getState().config.payerId).toBe('CUSTOM_PAYER_ID')
  })
})
