import { beforeEach, describe, expect, it } from 'vitest'
import { useFlowStore } from './flow'

beforeEach(() => {
  useFlowStore.getState().reset()
})

describe('flow store', () => {
  it('初始 activeStep 为 auth，所有步骤状态为 idle', () => {
    const state = useFlowStore.getState()
    expect(state.activeStep).toBe('auth')
    expect(state.stepStatus.createPlan).toBe('idle')
  })

  it('setPlanType 切换类型时重置 planConfig 为该类型默认值', () => {
    useFlowStore.getState().updatePlanConfig({ paymentFailureThreshold: 5 })
    useFlowStore.getState().setPlanType('setupFee')
    const state = useFlowStore.getState()
    expect(state.planType).toBe('setupFee')
    expect(state.planConfig.setupFee.amount).toBe(10)
    expect(state.planConfig.paymentFailureThreshold).toBe(3)
  })

  it('updatePlanConfig 合并式更新', () => {
    useFlowStore.getState().updatePlanConfig({ paymentFailureThreshold: 5 })
    expect(useFlowStore.getState().planConfig.paymentFailureThreshold).toBe(5)
    expect(useFlowStore.getState().planConfig.regular.price).toBe(19.99)
  })

  it('setStepResult 更新状态、响应、错误、debugId', () => {
    useFlowStore.getState().setStepResult('createProduct', 'success', { id: 'PROD-1' }, undefined, 'debug-1')
    const state = useFlowStore.getState()
    expect(state.stepStatus.createProduct).toBe('success')
    expect(state.responses.createProduct).toEqual({ id: 'PROD-1' })
    expect(state.debugIds.createProduct).toBe('debug-1')
  })

  it('setStepResult 成功后应清空上一次失败遗留的 error/debugId（重发请求场景）', () => {
    useFlowStore.getState().setStepResult('createProduct', 'error', { message: 'boom' }, 'Failed to fetch', 'debug-err')
    useFlowStore.getState().setStepResult('createProduct', 'success', { id: 'PROD-1' }, undefined, undefined)
    const state = useFlowStore.getState()
    expect(state.stepStatus.createProduct).toBe('success')
    expect(state.errors.createProduct).toBeUndefined()
    expect(state.debugIds.createProduct).toBeUndefined()
  })

  it('reset 恢复初始状态', () => {
    useFlowStore.getState().setAccessToken('tok')
    useFlowStore.getState().setPlanType('trial')
    useFlowStore.getState().reset()
    const state = useFlowStore.getState()
    expect(state.accessToken).toBe('')
    expect(state.planType).toBe('fixed')
  })
})
