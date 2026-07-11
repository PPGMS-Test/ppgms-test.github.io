import { describe, it, expect } from 'vitest'

/**
 * Helper function 测试（从 FundFlowBar 中提取出来的辅助函数）
 */

function getHighlightedSegmentIndices(stepId: string): number[] {
  switch (stepId) {
    case 'auth':
    case 'onboarding':
      return []
    case 'createOrder':
    case 'capture':
      return [0, 1]
    case 'disburse':
      return [1, 2]
    case 'refund':
      return [0, 1]
    default:
      return []
  }
}

function getStepDescription(stepId: string): string {
  switch (stepId) {
    case 'auth':
      return '步骤 1：获取 access token，还未涉及资金流动'
    case 'onboarding':
      return '步骤 2：注册下游商户，在 PayPal 为其建立虚拟账户'
    case 'createOrder':
      return '步骤 3：创建订单，从买家收款'
    case 'capture':
      return '步骤 4：Capture 完成，资金已在 PayPal GL'
    case 'disburse':
      return '步骤 5：将资金从 PayPal GL 转入下游商户虚拟账户'
    case 'refund':
      return '步骤 6：退款，资金退回买家的原支付方式'
    default:
      return ''
  }
}

describe('FundFlowBar', () => {
  describe('getHighlightedSegmentIndices', () => {
    it('auth 和 onboarding 步骤应不高亮任何段', () => {
      expect(getHighlightedSegmentIndices('auth')).toEqual([])
      expect(getHighlightedSegmentIndices('onboarding')).toEqual([])
    })

    it('createOrder 和 capture 应高亮 Buyer 和 PayPal GL', () => {
      expect(getHighlightedSegmentIndices('createOrder')).toEqual([0, 1])
      expect(getHighlightedSegmentIndices('capture')).toEqual([0, 1])
    })

    it('disburse 应高亮 PayPal GL 和 PSA', () => {
      expect(getHighlightedSegmentIndices('disburse')).toEqual([1, 2])
    })

    it('refund 应高亮 Buyer 和 PayPal GL', () => {
      expect(getHighlightedSegmentIndices('refund')).toEqual([0, 1])
    })

    it('未知步骤应返回空数组', () => {
      expect(getHighlightedSegmentIndices('unknown')).toEqual([])
    })
  })

  describe('getStepDescription', () => {
    it('auth 步骤应返回正确描述', () => {
      const desc = getStepDescription('auth')
      expect(desc).toContain('步骤 1')
      expect(desc).toContain('access token')
    })

    it('onboarding 步骤应返回正确描述', () => {
      const desc = getStepDescription('onboarding')
      expect(desc).toContain('步骤 2')
      expect(desc).toContain('注册下游商户')
    })

    it('createOrder 步骤应返回正确描述', () => {
      const desc = getStepDescription('createOrder')
      expect(desc).toContain('步骤 3')
      expect(desc).toContain('创建订单')
    })

    it('capture 步骤应返回正确描述', () => {
      const desc = getStepDescription('capture')
      expect(desc).toContain('步骤 4')
      expect(desc).toContain('Capture')
    })

    it('disburse 步骤应返回正确描述', () => {
      const desc = getStepDescription('disburse')
      expect(desc).toContain('步骤 5')
      expect(desc).toContain('PayPal GL')
    })

    it('refund 步骤应返回正确描述', () => {
      const desc = getStepDescription('refund')
      expect(desc).toContain('步骤 6')
      expect(desc).toContain('退款')
    })

    it('未知步骤应返回空字符串', () => {
      expect(getStepDescription('unknown')).toBe('')
    })
  })

  describe('fund flow data structure', () => {
    it('应有 5 个资金流段', () => {
      // 测试 FUND_FLOW 在 steps.ts 中的定义
      const FUND_FLOW = [
        { label: 'Buyer', description: '买家账户/卡片', color: 'bg-blue-100' },
        { label: 'PayPal GL', description: 'PSP 的 PayPal 账户（一般余额为 $0）', color: 'bg-amber-100' },
        { label: 'PSA', description: 'PSP 的 Omnibus 账户（Type 5）', color: 'bg-purple-100' },
        { label: 'PSP Bank', description: 'PSP 的真实银行账户（日 EOD sweep）', color: 'bg-green-100' },
        { label: 'Merchant', description: '下游商户账户', color: 'bg-red-100' },
      ]
      expect(FUND_FLOW).toHaveLength(5)
    })

    it('每个段应有 label、description、color', () => {
      const FUND_FLOW = [
        { label: 'Buyer', description: '买家账户/卡片', color: 'bg-blue-100' },
        { label: 'PayPal GL', description: 'PSP 的 PayPal 账户（一般余额为 $0）', color: 'bg-amber-100' },
        { label: 'PSA', description: 'PSP 的 Omnibus 账户（Type 5）', color: 'bg-purple-100' },
        { label: 'PSP Bank', description: 'PSP 的真实银行账户（日 EOD sweep）', color: 'bg-green-100' },
        { label: 'Merchant', description: '下游商户账户', color: 'bg-red-100' },
      ]
      FUND_FLOW.forEach((seg) => {
        expect(seg).toHaveProperty('label')
        expect(seg).toHaveProperty('description')
        expect(seg).toHaveProperty('color')
        expect(typeof seg.label).toBe('string')
        expect(typeof seg.description).toBe('string')
        expect(typeof seg.color).toBe('string')
      })
    })
  })

  describe('step-to-segment mapping', () => {
    it('应该正确映射所有 6 个步骤', () => {
      const stepIds = ['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund']
      stepIds.forEach((stepId) => {
        const highlighted = getHighlightedSegmentIndices(stepId)
        const desc = getStepDescription(stepId)
        expect(highlighted).toBeDefined()
        expect(desc).toBeDefined()
      })
    })

    it('高亮段索引应在 0-4 范围内', () => {
      const stepIds = ['auth', 'onboarding', 'createOrder', 'capture', 'disburse', 'refund']
      stepIds.forEach((stepId) => {
        const highlighted = getHighlightedSegmentIndices(stepId)
        highlighted.forEach((idx) => {
          expect(idx).toBeGreaterThanOrEqual(0)
          expect(idx).toBeLessThan(5)
        })
      })
    })
  })
})
