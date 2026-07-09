// 概念讲解官内容，取自 enhance-context-page 的 Configuration & Onboarding Guide。
// 每条含标题、正文、对应文档章节，以及可选的「为什么」折叠问答。
export interface ConceptQA {
  q: string
  a: string
}
export interface Concept {
  key: string
  title: string
  body: string
  section: string
  faqs?: ConceptQA[]
}

export const CONCEPTS: Record<string, Concept> = {
  byok: {
    key: 'byok',
    title: 'BYOK 与 access token',
    body: 'PSP 用自己的 sandbox client id/secret 通过 client_credentials 换取 OAuth access_token。演练台第 1 步换到 token 后，后续每步都带着它调用——完全对齐 Postman collection 的 "1 - Auth" 步骤。',
    section: '§7 Integration Overview',
    faqs: [{ q: '为什么要单独一步换 token？', a: '真实集成里 token 有有效期、需复用；把它作为显式第一步能看清"凭证→令牌→调用"的关系。' }],
  },
  consent: {
    key: 'consent',
    title: 'Merchant Consent（授权同意）',
    body: 'Onboarding 时通过 Partner Referral 生成商户授权链接。商户点击授予 PSP 代其发起支付/退款、访问信息、延迟放款等权限（features 列表）。legal_consents 里的 SHARE_DATA_CONSENT 即数据共享同意。',
    section: '§11 Merchant Consent – Permission Grant',
    faqs: [{ q: '为什么需要 Consent？', a: 'PSP 是第三方（THIRD_PARTY 集成），代商户操作资金，必须先拿到商户明确授权。' }],
  },
  delayDisbursement: {
    key: 'delayDisbursement',
    title: 'DELAY_FUNDS_DISBURSEMENT（延迟放款）',
    body: 'Partner Referral 的 features 里包含 DELAY_FUNDS_DISBURSEMENT，表示放款不随 capture 立即发生，而是由 PSP 之后通过 referenced-payouts 主动发起。这是 PSP Path 资金聚合的关键。',
    section: '§7 / §3 Evolution',
  },
  bnCode: {
    key: 'bnCode',
    title: 'BN Code（PayPal-Partner-Attribution-Id）',
    body: 'BN code 通过 PayPal-Partner-Attribution-Id 请求头带上，PSP Path 2.0 用它做结算账户路由（取代 1.0 的按币种路由），把这笔资金正确导向对应的 PSA。',
    section: '§10.1 BN Code Validation Rules',
    faqs: [{ q: 'BN code 干嘛用？', a: '2.0 用 BN code 决定钱结算到哪个 PSA；1.0 只能按币种路由，容易出错。' }],
  },
  generalLedger: {
    key: 'generalLedger',
    title: '商户 General Ledger（GL）',
    body: 'Capture 成功后，钱先落到商户的 PayPal General Ledger，但商户余额保持 $0——因为 PSP Path 下资金会被划走给 PSP，商户不直接从 PayPal 提现。',
    section: '§1 How It Works',
  },
  psa: {
    key: 'psa',
    title: 'PSA — Partner Settlement Account',
    body: 'PSA 是 PSP 的 Type 5 omnibus（综合）账户。referenced-payouts 触发后，PayPal 把钱从商户 GL 划到 PSA；每日 EOD sweep 再把 PSA 的钱打到 PSP 的银行/FBO 账户。',
    section: '§10 Partner Settlement Account',
    faqs: [{ q: '为什么钱先到 PSA 而不是直接给商户？', a: 'PSP 要聚合所有子商户的资金，用自己的通道统一结算给卖家——这正是 PSP Path 的价值。' }],
  },
  elmo: {
    key: 'elmo',
    title: 'ELMO（2.0 组件）',
    body: 'ELMO 是 PSP Path 2.0 引入的组件，负责在放款链路里做映射/编排，配合 BN code 路由。它可回滚，有 sandbox / production 状态区分。',
    section: '§9 The Role of ELMO in 2.0',
  },
  riskLiability: {
    key: 'riskLiability',
    title: '风险归属（Partner Liable for Risk）',
    body: '与 Connected Path 最大的不同：PSP Path 下退款、争议、拒付、冲正全部由 PSP 承担（Partner Liable for Risk 标记）。PayPal 只负责买家侧风险与商户 KYC/KYB。',
    section: '§4 Risk & Compliance Responsibilities',
    faqs: [{ q: 'Refund 的钱从哪出？', a: '2.0 修复了 1.0 的 bug：退款正确地从 PSA 出，而不是错误地扣商户余额。' }],
  },
}

export function conceptsFor(keys: string[]): Concept[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean)
}
