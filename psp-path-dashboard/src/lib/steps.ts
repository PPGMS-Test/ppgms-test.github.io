// 6 步定义：分组/名称/图标名/HTTP 预览/文档章节/资金流高亮段/概念 key。
import type { StepId } from '@/store/flow'

export type IconName =
  | 'KeyRound' | 'Store' | 'ShoppingCart' | 'HandCoins' | 'ArrowLeftRight' | 'RefreshCw'
export type FundSegment = 'buyer' | 'gl' | 'psa' | 'psp' | 'seller' | null

export interface StepDef {
  id: StepId
  group: string
  order: number
  title: string
  icon: IconName
  method: 'POST'
  /** 展示用路径模板；{orderId}/{captureId} 运行时替换 */
  pathTemplate: string
  docSection: string
  fundSegment: FundSegment
  conceptKeys: string[]
}

export const STEPS: StepDef[] = [
  { id: 'auth', group: 'AUTH', order: 1, title: 'Get access token', icon: 'KeyRound',
    method: 'POST', pathTemplate: '/v1/oauth2/token', docSection: '§7 Integration', fundSegment: null,
    conceptKeys: ['byok'] },
  { id: 'onboarding', group: 'ONBOARDING', order: 2, title: 'Create Partner Referral', icon: 'Store',
    method: 'POST', pathTemplate: '/v2/customer/partner-referrals', docSection: '§6 Onboarding', fundSegment: null,
    conceptKeys: ['consent', 'delayDisbursement'] },
  { id: 'createOrder', group: 'ORDER', order: 3, title: 'Create Order (CAPTURE intent)', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders', docSection: '§1 Three-Part Model', fundSegment: 'buyer',
    conceptKeys: ['bnCode'] },
  { id: 'capture', group: 'ORDER', order: 4, title: 'Capture Order', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders/{orderId}/capture', docSection: '§1 Three-Part Model', fundSegment: 'gl',
    conceptKeys: ['generalLedger'] },
  { id: 'disburse', group: 'MONEY MOVE', order: 5, title: 'Disburse Funds (referenced payouts)', icon: 'ArrowLeftRight',
    method: 'POST', pathTemplate: '/v1/payments/referenced-payouts-items', docSection: '§10 PSA', fundSegment: 'psa',
    conceptKeys: ['psa', 'elmo'] },
  { id: 'refund', group: 'MONEY MOVE', order: 6, title: 'Refund Payment', icon: 'RefreshCw',
    method: 'POST', pathTemplate: '/v2/payments/captures/{captureId}/refund', docSection: '§4 Risk', fundSegment: 'psp',
    conceptKeys: ['riskLiability'] },
]

export const STEP_GROUPS = ['AUTH', 'ONBOARDING', 'ORDER', 'MONEY MOVE'] as const
