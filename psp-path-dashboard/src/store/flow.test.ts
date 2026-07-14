import { beforeEach, describe, expect, it } from 'vitest'
import { useFlowStore, generateTrackingId } from './flow'
import { DEFAULT_PAYER_ID } from '@/config/default-credentials'

beforeEach(() => useFlowStore.getState().reset())

describe('flow store', () => {
  it('初始所有产出为空、步骤 idle', () => {
    const s = useFlowStore.getState()
    expect(s.accessToken).toBe('')
    expect(s.orderId).toBe('')
    expect(s.stepStatus.auth).toBe('idle')
  })
  it('setStepResult 写入状态与响应', () => {
    useFlowStore.getState().setStepResult('auth', 'success', { accessToken: 'T' })
    expect(useFlowStore.getState().stepStatus.auth).toBe('success')
    expect(useFlowStore.getState().responses.auth).toEqual({ accessToken: 'T' })
  })
  it('产出串联：设置 orderId 供后续读取', () => {
    useFlowStore.getState().setOrderId('ORD1')
    useFlowStore.getState().setCaptureId('CAP1')
    expect(useFlowStore.getState().orderId).toBe('ORD1')
    expect(useFlowStore.getState().captureId).toBe('CAP1')
  })
  it('reset 清空一切', () => {
    useFlowStore.getState().setOrderId('X')
    useFlowStore.getState().reset()
    expect(useFlowStore.getState().orderId).toBe('')
  })
})

describe('flow store v2 扩展', () => {
  it('config 新增 payerId 默认值与 authAssertionEnabled=false', () => {
    const s = useFlowStore.getState()
    expect(s.config.payerId).toBe(DEFAULT_PAYER_ID)
    expect(s.config.authAssertionEnabled).toBe(false)
  })
  it('setRequestBody / setBodyEditing 读写', () => {
    useFlowStore.getState().setRequestBody('createOrder', '{"a":1}')
    useFlowStore.getState().setBodyEditing('createOrder', true)
    expect(useFlowStore.getState().requestBodies.createOrder).toBe('{"a":1}')
    expect(useFlowStore.getState().bodyEditing.createOrder).toBe(true)
  })
  it('reset 清空 requestBodies/bodyEditing 与新 config', () => {
    useFlowStore.getState().setRequestBody('refund', '{}')
    useFlowStore.getState().updateConfig({ authAssertionEnabled: true })
    useFlowStore.getState().reset()
    expect(useFlowStore.getState().requestBodies.refund).toBeUndefined()
    expect(useFlowStore.getState().config.authAssertionEnabled).toBe(false)
  })
  it('generateTrackingId 每次调用都不同，且带固定前缀', () => {
    const a = generateTrackingId()
    const b = generateTrackingId()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^psp-playground-/)
  })
  it('reset 后 trackingId 会换成新的，不复用旧值', () => {
    const before = useFlowStore.getState().config.trackingId
    useFlowStore.getState().reset()
    const after = useFlowStore.getState().config.trackingId
    expect(after).not.toBe(before)
    expect(after).toMatch(/^psp-playground-/)
  })
})
