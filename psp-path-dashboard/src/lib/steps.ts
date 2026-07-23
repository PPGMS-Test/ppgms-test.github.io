// 6 步定义：分组/名称/图标名/HTTP 预览/文档章节/资金流高亮段/概念 key。
import type { StepId } from '@/store/flow'

export type IconName =
  | 'KeyRound' | 'Store' | 'ShoppingCart' | 'HandCoins' | 'ArrowLeftRight' | 'RefreshCw'
export type FundSegment = 'buyer' | 'gl' | 'psa' | 'psp' | 'seller' | null
export type StepPhase = 'AUTH' | 'ONBOARDING' | 'ORDER' | 'MONEY_MOVE'

export interface PayloadField {
  name: string
  required: boolean
  description: string
}

export interface ResponseHighlight {
  field: string
  description: string
  nextStepUsage?: string
}

export interface ApiInfo {
  method: 'POST' | 'GET'
  endpoint: string
  description: string
}

export interface Step {
  id: StepId
  name: string
  phase: StepPhase
  description: string
  fundFlowStage: string
  apiInfo: ApiInfo
  payloadFields: PayloadField[]
  responseHighlights: ResponseHighlight[]
  docReference?: string
}

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

export const STEPS_DETAILED: Record<StepId, Step> = {
  auth: {
    id: 'auth',
    name: 'Get Access Token',
    phase: 'AUTH',
    description: '使用 client_id 和 client_secret 换取 OAuth access token，这是后续所有 API 调用的凭证。',
    fundFlowStage: 'Buyer（等待）',
    apiInfo: {
      method: 'POST',
      endpoint: '/psp/access-token',
      description: '向 PayPal 服务获取有效期为 1 小时的 access token',
    },
    payloadFields: [
      {
        name: 'client_id',
        required: true,
        description: 'PSP 的 client ID',
      },
      {
        name: 'client_secret',
        required: true,
        description: 'PSP 的 client secret',
      },
    ],
    responseHighlights: [
      {
        field: 'access_token',
        description: '有效的 OAuth token',
        nextStepUsage: '步骤 2~6 都需要这个 token',
      },
      {
        field: 'expires_in',
        description: 'Token 有效期（秒）',
      },
    ],
    docReference: '§2.1',
  },

  onboarding: {
    id: 'onboarding',
    name: 'Partner Referral (Onboarding)',
    phase: 'ONBOARDING',
    description: 'PSP 把自己的下游商户在 PayPal 注册（onboard），PayPal 为这个商户建立一个虚拟账户，准备接收 PSP 转过来的资金。返回的 merchant_id 就是这个虚拟账户的标识。',
    fundFlowStage: 'PayPal GL（建立商户虚拟账户）',
    apiInfo: {
      method: 'POST',
      endpoint: '/psp/partner-referrals',
      description: '在 PayPal 注册下游商户，返回 merchant_id 供后续使用',
    },
    payloadFields: [
      {
        name: 'trackingId',
        required: true,
        description: '本次 onboarding 的唯一追踪 ID（防重复）',
      },
      {
        name: 'returnUrl',
        required: true,
        description: '商户完成 onboarding 后的返回 URL',
      },
      {
        name: 'merchantName',
        required: true,
        description: '商户在 PayPal 上的名称',
      },
      {
        name: 'email',
        required: true,
        description: '商户邮箱',
      },
    ],
    responseHighlights: [
      {
        field: 'merchant_id',
        description: 'PayPal 分配给这个商户的虚拟账户 ID',
        nextStepUsage: '步骤 5（Disburse）需要这个 ID',
      },
      {
        field: 'processing_status',
        description: 'Onboarding 状态（通常 APPROVED）',
      },
    ],
    docReference: '§4 & §5',
  },

  createOrder: {
    id: 'createOrder',
    name: 'Create Order',
    phase: 'ORDER',
    description: '创建一笔订单，指定买家、商品、金额、货币。这个订单还没有真正扣钱，只是在 PayPal 系统内建立一条记录。',
    fundFlowStage: 'Buyer → PayPal GL（记录待支付）',
    apiInfo: {
      method: 'POST',
      endpoint: '/orders',
      description: 'PayPal Checkout Orders API，创建订单',
    },
    payloadFields: [
      {
        name: 'intent',
        required: true,
        description: '必须是 CAPTURE（本演练台只支持 Capture Intent）',
      },
      {
        name: 'purchase_units',
        required: true,
        description: '订单详情数组，包含商品、金额、货币',
      },
    ],
    responseHighlights: [
      {
        field: 'id',
        description: '订单 ID',
        nextStepUsage: '步骤 4（Capture）需要这个 ID',
      },
      {
        field: 'status',
        description: '订单状态（通常 CREATED）',
      },
    ],
    docReference: '§3.1',
  },

  capture: {
    id: 'capture',
    name: 'Capture Payment',
    phase: 'ORDER',
    description: '真正扣钱。PayPal 从买家账户/卡片收款，钱进到 PSP 关联的 PayPal GL 账户（PSA），余额保持 $0（因为每日 EOD 会 sweep 到 PSP 银行账户）。',
    fundFlowStage: 'Buyer → PayPal GL（钱进来了）',
    apiInfo: {
      method: 'POST',
      endpoint: '/orders/{orderId}/capture',
      description: '确认支付，真正从买家扣钱',
    },
    payloadFields: [
      {
        name: 'orderId',
        required: true,
        description: '步骤 3 返回的订单 ID',
      },
    ],
    responseHighlights: [
      {
        field: 'capture_id',
        description: 'Capture 交易 ID',
        nextStepUsage: '步骤 5（Disburse）和步骤 6（Refund）需要这个 ID',
      },
      {
        field: 'amount.value',
        description: '实际收款金额',
      },
    ],
    docReference: '§3.1 & §6',
  },

  disburse: {
    id: 'disburse',
    name: 'Disburse Funds',
    phase: 'MONEY_MOVE',
    description: 'PSP 从 PayPal GL 账户把钱转到下游商户的虚拟账户。这笔钱可以立即转，也可以延期转（如果配置了 delay disbursement）。转账后，PSP 后续会用自己的通道从虚拟账户提现并打给真实商户。',
    fundFlowStage: 'PayPal GL → PSA（PSP 的 omnibus 账户）',
    apiInfo: {
      method: 'POST',
      endpoint: '/psp/referenced-payouts-items',
      description: '指定 capture_id 和商户 ID，触发转账',
    },
    payloadFields: [
      {
        name: 'captureId',
        required: true,
        description: '步骤 4 返回的 capture ID',
      },
      {
        name: 'merchantId',
        required: true,
        description: '步骤 2 返回的商户虚拟账户 ID',
      },
      {
        name: 'amount',
        required: true,
        description: '要转账的金额（通常和 capture 金额一致，也可部分转）',
      },
      {
        name: 'currency',
        required: true,
        description: '货币代码（USD、EUR 等）',
      },
      {
        name: 'disbursalDate',
        required: false,
        description: '延期转账日期（YYYY-MM-DD 格式），不填则立即转',
      },
    ],
    responseHighlights: [
      {
        field: 'payout_item_id',
        description: '本次转账的 ID',
        nextStepUsage: '可用于查询转账状态',
      },
      {
        field: 'status',
        description: '转账状态（APPROVED、PENDING 等）',
      },
    ],
    docReference: '§6 & §7',
  },

  refund: {
    id: 'refund',
    name: 'Refund',
    phase: 'MONEY_MOVE',
    description: '如果买家退货或要求退款，PSP 可以通过这个 API 退款。退款会回到买家的原支付方式，PSP 承担此次转账的手续费。',
    fundFlowStage: 'PayPal GL → Buyer（钱回去）',
    apiInfo: {
      method: 'POST',
      endpoint: '/psp/captures/{captureId}/refund',
      description: '对一笔 capture 进行全额或部分退款',
    },
    payloadFields: [
      {
        name: 'captureId',
        required: true,
        description: '步骤 4 返回的 capture ID',
      },
      {
        name: 'amount',
        required: false,
        description: '退款金额，不填则全额退款',
      },
      {
        name: 'currency',
        required: false,
        description: '货币代码',
      },
      {
        name: 'reason',
        required: false,
        description: '退款原因代码',
      },
      {
        name: 'noteToPayer',
        required: false,
        description: '给买家的备注',
      },
    ],
    responseHighlights: [
      {
        field: 'refund_id',
        description: '退款交易 ID',
      },
      {
        field: 'status',
        description: '退款状态（COMPLETED 表示成功）',
      },
    ],
    docReference: '§8',
  },

  createOrderDelayed: {
    id: 'createOrderDelayed',
    name: 'Create Order (Delayed Disbursement)',
    phase: 'ORDER',
    description: '和 Create Order 一样，但 purchase_units[].payment_instruction.disbursement_mode 设为 DELAYED，capture 后资金不会自动结算，需要后续显式调用 referenced-payouts-items 才会放款。',
    fundFlowStage: 'Buyer → PayPal GL（记录待支付，标记延迟放款）',
    apiInfo: {
      method: 'POST',
      endpoint: '/orders',
      description: 'PayPal Checkout Orders API，创建订单并声明 disbursement_mode=DELAYED',
    },
    payloadFields: [
      {
        name: 'intent',
        required: true,
        description: '必须是 CAPTURE',
      },
      {
        name: 'purchase_units[].payment_instruction.disbursement_mode',
        required: true,
        description: '固定为 DELAYED，声明这笔资金要延迟放款',
      },
    ],
    responseHighlights: [
      {
        field: 'id',
        description: '订单 ID',
        nextStepUsage: '本小节的 Capture Order 需要这个 ID',
      },
      {
        field: 'status',
        description: '订单状态（通常 CREATED）',
      },
    ],
    docReference: '§3.1 & §6',
  },

  captureDelayed: {
    id: 'captureDelayed',
    name: 'Capture Order',
    phase: 'ORDER',
    description: '跟主流程的 Capture Payment 是同一个 API 调用，只是入口放在 DISBURSEMENT MODE 小节里，方便配合上面的 Create Order (Delayed Disbursement) 一起测试。',
    fundFlowStage: 'Buyer → PayPal GL（钱进来了，标记延迟放款）',
    apiInfo: {
      method: 'POST',
      endpoint: '/orders/{orderId}/capture',
      description: '确认支付，真正从买家扣钱',
    },
    payloadFields: [
      {
        name: 'orderId',
        required: true,
        description: '上面 Create Order (Delayed Disbursement) 返回的订单 ID',
      },
    ],
    responseHighlights: [
      {
        field: 'capture_id',
        description: 'Capture 交易 ID',
        nextStepUsage: '本小节的 Disburse Funds 需要这个 ID',
      },
      {
        field: 'amount.value',
        description: '实际收款金额',
      },
    ],
    docReference: '§3.1 & §6',
  },
}

/**
 * 按 phase 分组的步骤，给 StepRail 用
 */
export const STEPS_BY_PHASE: Record<StepPhase, StepId[]> = {
  AUTH: ['auth'],
  ONBOARDING: ['onboarding'],
  ORDER: ['createOrder', 'capture'],
  MONEY_MOVE: ['disburse', 'refund'],
}

/**
 * 资金流条的段落定义
 */
export interface FundFlowSegment {
  label: string
  description: string
  color: string
}

export const FUND_FLOW: FundFlowSegment[] = [
  {
    label: 'Buyer',
    description: '买家账户/卡片',
    color: '#5B8DEF',
  },
  {
    label: 'PayPal GL',
    description: 'PSP 的 PayPal 账户（一般余额为 $0）',
    color: '#F0A93C',
  },
  {
    label: 'PSA',
    description: 'PSP 的 Omnibus 账户（Type 5）',
    color: '#A78BFA',
  },
  {
    label: 'PSP Bank',
    description: 'PSP 的真实银行账户（日 EOD sweep）',
    color: '#34D399',
  },
  {
    label: 'Merchant',
    description: '下游商户账户',
    color: '#FB923C',
  },
]

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
  { id: 'refund', group: 'REFUND', order: 5, title: 'Refund Payment', icon: 'RefreshCw',
    method: 'POST', pathTemplate: '/v2/payments/captures/{captureId}/refund', docSection: '§4 Risk', fundSegment: 'psp',
    conceptKeys: ['riskLiability'] },
  // DISBURSEMENT MODE 小节：createOrder/capture 各复制一份变体（共享同一份 orderId/captureId），
  // Disburse Funds 唯一的入口就放在这里（原来 MONEY MOVE 下的那份已挪走，不再重复出现）。
  { id: 'createOrderDelayed', group: 'DISBURSEMENT MODE', order: 6, title: 'Create Order (Delayed Disbursement)', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders', docSection: '§1 Three-Part Model', fundSegment: 'buyer',
    conceptKeys: ['bnCode', 'delayDisbursement'] },
  { id: 'captureDelayed', group: 'DISBURSEMENT MODE', order: 7, title: 'Capture Order', icon: 'ShoppingCart',
    method: 'POST', pathTemplate: '/v2/checkout/orders/{orderId}/capture', docSection: '§1 Three-Part Model', fundSegment: 'gl',
    conceptKeys: ['generalLedger'] },
  { id: 'disburse', group: 'DISBURSEMENT MODE', order: 8, title: 'Disburse Funds (referenced payouts)', icon: 'ArrowLeftRight',
    method: 'POST', pathTemplate: '/v1/payments/referenced-payouts-items', docSection: '§10 PSA', fundSegment: 'psa',
    conceptKeys: ['psa', 'elmo'] },
]

export const STEP_GROUPS = ['AUTH', 'ONBOARDING', 'ORDER', 'REFUND', 'DISBURSEMENT MODE'] as const
