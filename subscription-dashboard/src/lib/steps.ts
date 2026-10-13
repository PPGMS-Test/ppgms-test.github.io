export type StepId = 'auth' | 'createProduct' | 'createPlan' | 'createSubscription' | 'approval'

export interface StepDef {
  id: StepId
  order: number // 1-based
  title: string
  docSection: string // human-readable reference to the relevant knowledge-doc section, e.g. "一、核心层级关系：Product → Plan → Subscription"
}

export const STEPS: StepDef[] = [
  {
    id: 'auth',
    order: 1,
    title: '获取 Access Token',
    docSection: '后端一次性准备：OAuth client_credentials',
  },
  {
    id: 'createProduct',
    order: 2,
    title: '创建 Product',
    docSection: '一、核心层级关系：Product → Plan → Subscription',
  },
  {
    id: 'createPlan',
    order: 3,
    title: '创建 Plan（计费规则）',
    docSection: '二、计费相关的所有细节（在 Plan 层定义）',
  },
  {
    id: 'createSubscription',
    order: 4,
    title: '创建 Subscription',
    docSection: '九、订阅生命周期管理',
  },
  {
    id: 'approval',
    order: 5,
    title: '买家审批（JS SDK v6）',
    docSection: '四、Android 和 iOS 的 SDK 集成 / Web 集成方式（JS SDK v6）',
  },
]
