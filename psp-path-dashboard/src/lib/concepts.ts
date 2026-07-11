// 概念讲解官内容，取自 enhance-context-page 的 Configuration & Onboarding Guide。
// 每条含标题、正文、对应文档章节、相关步骤、以及可选的「为什么」折叠问答。

import type { StepId } from '@/store/flow'

export interface ConceptQA {
  q: string
  a: string
}

export interface ConceptCard {
  id: string
  title: string
  description: string // 中文讲解（200-300 字）
  relatedSteps: StepId[] // 哪些步骤会涉及这个概念
  docReferences: string[] // "§10"、"§3.2" 等
  relatedConcepts: string[] // 相关概念的 id
  faqs?: Array<{
    question: string
    answer: string
  }>
}

/** @deprecated 保留兼容性，新代码应使用 ConceptCard */
export interface Concept {
  key: string
  title: string
  body: string
  section: string
  faqs?: ConceptQA[]
}

export const CONCEPTS: Record<string, ConceptCard> = {
  // 基础架构
  psa: {
    id: 'psa',
    title: 'PSA（Payment Service Account）',
    description: 'PSA 是 PayPal 为 PSP 创建的一个 Type 5 omnibus 账户，是一个虚拟账户。PSP 从 PayPal 的主账户（GL）收到的所有 capture 款项都会累积到 PSA。\n\nPSA 的一个关键特性是它可以容纳多个下游商户的资金，PSP 可以通过 BN code 等机制精确识别和路由每笔资金。日常运营中，PSP 会在每日 EOD（End of Day）将 PSA 余额扫入自己的真实银行账户（sweep），以便用自己的通道给商户分账。',
    relatedSteps: ['disburse', 'refund'],
    docReferences: ['§4', '§5', '§7'],
    relatedConcepts: ['bnCode', 'sweep'],
    faqs: [
      {
        question: '为什么钱不能直接进商户的真实账户？',
        answer: '因为 PayPal 的 Checkout Orders API 天生是为 PSP 模式设计的，钱必须先进 PSP 的账户（PSA）。这也是 PSP Path 和普通商户直接接入的本质区别。',
      },
      {
        question: 'PSA 和商户虚拟账户有什么区别？',
        answer: 'PSA 是 PSP 自己的 omnibus 账户（一个），商户虚拟账户是每个下游商户各有一个。PSP 通过 Partner Referral API 给商户创建虚拟账户。',
      },
    ],
  },

  bnCode: {
    id: 'bnCode',
    title: 'BN Code（Business Number Code）',
    description: 'BN code 是 PayPal 用来标识商户身份的一个编码方案，PSP 在上传到 PayPal 时需要正确配置。\n\nPSP Path 2.0 引入了 BN code 路由机制：每笔 capture 时可以指定不同的 BN code，这样 PayPal 就知道这笔钱最终要流向哪个商户，便于后续的 disbursement 和对账。\n\n如果 BN code 配置错了，可能导致 PSP 无法精确追踪资金流向，甚至被 PayPal 标记为风险行为。',
    relatedSteps: ['createOrder', 'capture', 'disburse'],
    docReferences: ['§5.2', '§6.1'],
    relatedConcepts: ['psa', 'consent'],
    faqs: [
      {
        question: 'BN code 和 merchant_id 有什么关系？',
        answer: 'BN code 是 PayPal 系统内部的编码标准，merchant_id 是商户虚拟账户的 ID。一个商户可能有多个 BN code 对应不同的业务线。',
      },
    ],
  },

  consent: {
    id: 'consent',
    title: 'Merchant Consent（商户同意）',
    description: 'PSP Path 要求下游商户对"PSP 承担退款和争议风险"这件事给予明确同意。这个同意通常在 Partner Referral 时完成（商户点击返回 URL 后跳转回 onboarding 页）。\n\n从法律角度，Consent 是 PSP 和商户之间的合同证据；从系统角度，它是 PayPal 验证 PSP 有权发起此次 disbursement 的凭证。如果没有 consent，PayPal 可能拒绝 disbursement。',
    relatedSteps: ['onboarding', 'disburse'],
    docReferences: ['§4.3', '§7.1'],
    relatedConcepts: ['psa'],
    faqs: [
      {
        question: '没有 consent 会怎样？',
        answer: 'PayPal 会拒绝 disbursement 请求，返回 403 Forbidden。',
      },
    ],
  },

  elmo: {
    id: 'elmo',
    title: 'ELMO（Enhanced Local Money Offerings）',
    description: 'ELMO 是 PayPal 为特定国家/地区设计的本地支付增强功能，比如某些国家可能要求特殊的账户类型或手续费模式。\n\n如果一个国家启用了 ELMO，PSP 在该国进行 PSP Path 集成时需要遵守 ELMO 的规则（包括配置参数、手续费率、退款政策等）。ELMO 通常在 USET/SEAL 配置工具里体现。',
    relatedSteps: ['auth', 'onboarding'],
    docReferences: ['§10'],
    relatedConcepts: ['uset_seal', 'sweep'],
    faqs: [
      {
        question: '如果国家不支持 ELMO 呢？',
        answer: '那就按标准 PSP Path 流程走，不需要额外的本地特殊配置。',
      },
    ],
  },

  sweep: {
    id: 'sweep',
    title: 'EOD Sweep（日末资金扫入）',
    description: 'Sweep 是一个自动化流程，PayPal 会在每天 UTC 时间的某个固定时刻（通常午夜），自动将 PSP 的 PSA 账户余额全部转入 PSP 注册的真实银行账户。\n\nSweep 的频率和金额可以由 PSP 在 USET/SEAL 工具里配置。这样 PSP 就不用手动操作，资金能自动流入银行账户，之后再通过自己的通道分账给商户。',
    relatedSteps: ['disburse', 'refund'],
    docReferences: ['§7.2', '§10.1'],
    relatedConcepts: ['psa'],
  },

  uset_seal: {
    id: 'uset_seal',
    title: 'USET / SEAL 配置工具',
    description: 'USET 和 SEAL 是 PayPal 提供的两个配置界面，PSP 在这里可以管理多达 11 个偏好设置（preferences），包括：\n\n- Sweep 频率和金额阈值\n- BN code 路由规则\n- 本地支付增强（ELMO）启用状态\n- 手续费率和风险规则\n- 退款和争议处理策略\n\nPSP Path 2.0 的许多变更都需要通过 USET/SEAL 生效。如果配置不对，可能导致资金路由错误或 PayPal 拒绝操作。',
    relatedSteps: ['auth', 'onboarding', 'disburse'],
    docReferences: ['§10'],
    relatedConcepts: ['elmo', 'sweep', 'bnCode'],
    faqs: [
      {
        question: '11 个 preferences 有哪些？',
        answer: '这份文档的 §10 有完整列表，包括 sweep 相关、BN code 相关、退款相关等。',
      },
    ],
  },

  // 演练台特定概念
  delayDisbursement: {
    id: 'delayDisbursement',
    title: 'Delay Disbursement（延期转账）',
    description: 'PSP Path 允许 PSP 在 Disburse Funds 步骤指定一个延期转账日期。这样 PayPal 不会立即把钱转到商户虚拟账户，而是等到指定日期才转。\n\n这个功能在 PSP 需要对账、核实商户信息、或等待某些条件满足时很有用。是 PSP Path 2.0 相比 1.0 的一个改进。',
    relatedSteps: ['disburse'],
    docReferences: ['§6.2', '§9'],
    relatedConcepts: ['psa'],
  },

  captureVsAuth: {
    id: 'captureVsAuth',
    title: 'Capture Intent vs. Auth Intent',
    description: '这份演练台只演示 Capture Intent 流程（下单 → 立即扣钱）。\n\nAuth Intent 是另一种模式：下单时只做 Authorize（冻结钱），之后再发起 Capture（真正扣钱）。Auth Intent 适合需要等待后续条件（如商品发货）再扣钱的场景。\n\nPSP Path 同时支持两种 intent，但本工具为了简洁只实现了 Capture Intent。',
    relatedSteps: ['createOrder', 'capture'],
    docReferences: ['§3.1'],
    relatedConcepts: [],
  },

  migrateScene: {
    id: 'migrateScene',
    title: '迁移场景',
    description: 'PSP Path 支持 3 种迁移场景，从现有的 Connected Path 或自建系统向 PSP Path 2.0 迁移：\n\n1. **Payer Same Path**: PSP 原有的买家关系和 PayPal 账户不变，只改商户端架构\n2. **Payer New Path**: 重新对接 PayPal Checkout，买家用新的支付流程\n3. **Hybrid**: 新旧买家流程并存\n\n迁移期间需要重点关注数据一致性和风险管理。这部分在 Configuration & Onboarding Guide 的 §12 详细说明。',
    relatedSteps: ['auth', 'onboarding', 'createOrder', 'capture'],
    docReferences: ['§12'],
    relatedConcepts: ['psa', 'consent'],
  },
}

/**
 * 按步骤反查相关概念
 */
export function getConceptsByStep(stepId: StepId): ConceptCard[] {
  return Object.values(CONCEPTS).filter((concept) =>
    concept.relatedSteps.includes(stepId)
  )
}

/**
 * 获取概念的相关概念卡片（用于概念卡片右下角的"相关概念"链接）
 */
export function getRelatedConcepts(conceptId: string): ConceptCard[] {
  const concept = CONCEPTS[conceptId]
  if (!concept) return []
  return concept.relatedConcepts
    .map((id) => CONCEPTS[id])
    .filter(Boolean)
}

/** @deprecated 保留兼容性，新代码应使用 getConceptsByStep */
export function conceptsFor(keys: string[]): ConceptCard[] {
  return keys.map((k) => CONCEPTS[k]).filter(Boolean)
}
