import { beforeEach, describe, expect, it } from 'vitest'
import { useFlowStore, type StepId } from '@/store/flow'
import { STEPS_BY_PHASE, STEPS } from '@/lib/steps'

beforeEach(() => useFlowStore.getState().reset())

describe('StepRail component', () => {
  describe('step data structure', () => {
    it('应该包含主流程的 6 个步骤，以及 DISBURSEMENT MODE 小节的 3 个入口（共 9 条，8 个不重复 id）', () => {
      const allSteps = ['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as StepId[]
      const definedSteps = STEPS.map((s) => s.id)
      expect(definedSteps).toEqual(expect.arrayContaining(allSteps))
      expect(definedSteps.length).toBe(9)
      expect(new Set(definedSteps).size).toBe(8)
    })

    it('步骤应按 phase 分组', () => {
      expect(STEPS_BY_PHASE.AUTH).toContain('auth')
      expect(STEPS_BY_PHASE.ONBOARDING).toContain('onboarding')
      expect(STEPS_BY_PHASE.ORDER).toContain('createOrder')
      expect(STEPS_BY_PHASE.ORDER).toContain('capture')
      expect(STEPS_BY_PHASE.MONEY_MOVE).toContain('disburse')
      expect(STEPS_BY_PHASE.MONEY_MOVE).toContain('refund')
    })

    it('DISBURSEMENT MODE 小节复用 disburse 这个 id（唯一允许重复的 id），其余 id 都不重复', () => {
      const ids = STEPS.map((s) => s.id)
      const counts = ids.reduce<Record<string, number>>((acc, id) => {
        acc[id] = (acc[id] ?? 0) + 1
        return acc
      }, {})
      const duplicated = Object.entries(counts).filter(([, count]) => count > 1)
      expect(duplicated).toEqual([['disburse', 2]])
    })

    it('每个步骤应有 group、title、icon 等必要字段', () => {
      STEPS.forEach((step) => {
        expect(step).toHaveProperty('id')
        expect(step).toHaveProperty('group')
        expect(step).toHaveProperty('order')
        expect(step).toHaveProperty('title')
        expect(step).toHaveProperty('icon')
        expect(step).toHaveProperty('docSection')
        expect(step).toHaveProperty('pathTemplate')
      })
    })
  })

  describe('flow store integration', () => {
    it('activeStep 初始值应为 auth', () => {
      expect(useFlowStore.getState().activeStep).toBe('auth')
    })

    it('setActiveStep 应更新 activeStep', () => {
      useFlowStore.getState().setActiveStep('capture')
      expect(useFlowStore.getState().activeStep).toBe('capture')
    })

    it('stepStatus 初始值应都是 idle', () => {
      const allSteps = ['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund'] as StepId[]
      allSteps.forEach((stepId) => {
        expect(useFlowStore.getState().stepStatus[stepId]).toBe('idle')
      })
    })

    it('setStepResult 应更新指定步骤的状态和响应', () => {
      const mockResponse = { access_token: 'test_token' }
      useFlowStore.getState().setStepResult('auth', 'success', mockResponse)

      expect(useFlowStore.getState().stepStatus.auth).toBe('success')
      expect(useFlowStore.getState().responses.auth).toEqual(mockResponse)
    })

    it('setStepResult 应记录错误信息', () => {
      const errorMsg = 'Invalid credentials'
      useFlowStore.getState().setStepResult('auth', 'error', undefined, errorMsg)

      expect(useFlowStore.getState().stepStatus.auth).toBe('error')
      expect(useFlowStore.getState().errors.auth).toBe(errorMsg)
    })

    it('setStepResult 只更新指定步骤，不影响其他步骤', () => {
      useFlowStore.getState().setStepResult('auth', 'success')
      useFlowStore.getState().setStepResult('capture', 'error', undefined, 'Capture failed')

      expect(useFlowStore.getState().stepStatus.auth).toBe('success')
      expect(useFlowStore.getState().stepStatus.capture).toBe('error')
      expect(useFlowStore.getState().stepStatus.onboarding).toBe('idle')
    })
  })

  describe('flow state transitions', () => {
    it('reset 应恢复初始状态', () => {
      useFlowStore.getState().setActiveStep('capture')
      useFlowStore.getState().setStepResult('auth', 'success', { token: 'test' })
      useFlowStore.getState().setAccessToken('some_token')

      useFlowStore.getState().reset()

      expect(useFlowStore.getState().activeStep).toBe('auth')
      expect(useFlowStore.getState().stepStatus.auth).toBe('idle')
      expect(useFlowStore.getState().accessToken).toBe('')
      expect(useFlowStore.getState().responses.auth).toBeUndefined()
    })

    it('应该支持多个步骤同时 running', () => {
      useFlowStore.getState().setStepResult('auth', 'running')
      useFlowStore.getState().setStepResult('onboarding', 'running')

      expect(useFlowStore.getState().stepStatus.auth).toBe('running')
      expect(useFlowStore.getState().stepStatus.onboarding).toBe('running')
    })
  })

  describe('step detail data', () => {
    it('auth 步骤应包含 API 信息', () => {
      const authStep = STEPS.find((s) => s.id === 'auth')
      expect(authStep).toBeDefined()
      expect(authStep?.title).toBe('Get access token')
      expect(authStep?.icon).toBe('KeyRound')
      expect(authStep?.docSection).toContain('Integration')
    })

    it('capture 步骤应有 orderId 路径参数', () => {
      const captureStep = STEPS.find((s) => s.id === 'capture')
      expect(captureStep?.pathTemplate).toContain('{orderId}')
    })

    it('disburse 步骤应属于 MONEY_MOVE 阶段', () => {
      expect(STEPS_BY_PHASE.MONEY_MOVE).toContain('disburse')
    })
  })

  describe('request body editing', () => {
    it('setRequestBody 应存储请求 body', () => {
      const body = JSON.stringify({ client_id: 'test', client_secret: 'secret' })
      useFlowStore.getState().setRequestBody('auth', body)
      expect(useFlowStore.getState().requestBodies.auth).toBe(body)
    })

    it('setBodyEditing 应切换编辑状态', () => {
      expect(useFlowStore.getState().bodyEditing.auth).toBeUndefined()

      useFlowStore.getState().setBodyEditing('auth', true)
      expect(useFlowStore.getState().bodyEditing.auth).toBe(true)

      useFlowStore.getState().setBodyEditing('auth', false)
      expect(useFlowStore.getState().bodyEditing.auth).toBe(false)
    })

    it('不同步骤的请求 body 应独立', () => {
      useFlowStore.getState().setRequestBody('auth', '{"auth": "body"}')
      useFlowStore.getState().setRequestBody('capture', '{"capture": "body"}')

      expect(useFlowStore.getState().requestBodies.auth).toBe('{"auth": "body"}')
      expect(useFlowStore.getState().requestBodies.capture).toBe('{"capture": "body"}')
    })
  })

  describe('config management', () => {
    it('updateConfig 应更新流程配置', () => {
      useFlowStore.getState().updateConfig({ amount: '200.00', currency: 'USD' })

      expect(useFlowStore.getState().config.amount).toBe('200.00')
      expect(useFlowStore.getState().config.currency).toBe('USD')
    })

    it('部分更新不应影响其他配置', () => {
      const originalEmail = useFlowStore.getState().config.payeeEmail
      useFlowStore.getState().updateConfig({ amount: '300.00' })

      expect(useFlowStore.getState().config.amount).toBe('300.00')
      expect(useFlowStore.getState().config.payeeEmail).toBe(originalEmail)
    })
  })

  describe('step status transitions', () => {
    it('应支持状态从 idle 转到 running', () => {
      expect(useFlowStore.getState().stepStatus.auth).toBe('idle')
      useFlowStore.getState().setStepResult('auth', 'running')
      expect(useFlowStore.getState().stepStatus.auth).toBe('running')
    })

    it('应支持状态从 running 转到 success', () => {
      useFlowStore.getState().setStepResult('auth', 'running')
      useFlowStore.getState().setStepResult('auth', 'success', { token: 'abc' })
      expect(useFlowStore.getState().stepStatus.auth).toBe('success')
      expect(useFlowStore.getState().responses.auth).toEqual({ token: 'abc' })
    })

    it('应支持状态从 running 转到 error', () => {
      useFlowStore.getState().setStepResult('auth', 'running')
      useFlowStore.getState().setStepResult('auth', 'error', undefined, 'Network timeout')
      expect(useFlowStore.getState().stepStatus.auth).toBe('error')
      expect(useFlowStore.getState().errors.auth).toBe('Network timeout')
    })

    it('应支持从 error 重试', () => {
      useFlowStore.getState().setStepResult('auth', 'error', undefined, 'First error')
      useFlowStore.getState().setStepResult('auth', 'running')
      useFlowStore.getState().setStepResult('auth', 'success', { token: 'retry_success' })
      expect(useFlowStore.getState().stepStatus.auth).toBe('success')
    })
  })

  describe('step tokens and IDs', () => {
    it('accessToken 应该被保存和检索', () => {
      const token = 'A21_test_token_12345'
      useFlowStore.getState().setAccessToken(token)
      expect(useFlowStore.getState().accessToken).toBe(token)
    })

    it('orderId 应该被保存', () => {
      const orderId = '5O190127070341028'
      useFlowStore.getState().setOrderId(orderId)
      expect(useFlowStore.getState().orderId).toBe(orderId)
    })

    it('captureId 应该被保存', () => {
      const captureId = '3C679915ML0529639'
      useFlowStore.getState().setCaptureId(captureId)
      expect(useFlowStore.getState().captureId).toBe(captureId)
    })

    it('refundId 应该被保存', () => {
      const refundId = '7UH12345ABCDE'
      useFlowStore.getState().setRefundId(refundId)
      expect(useFlowStore.getState().refundId).toBe(refundId)
    })
  })
})
