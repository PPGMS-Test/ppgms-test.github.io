import { beforeEach, describe, expect, it } from 'vitest'
import { useFlowStore } from './flow'

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
