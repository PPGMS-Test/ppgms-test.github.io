/**
 * 已创建的 payment link 记录（持久化到 localStorage），使买家前台能看到商户刚建的 link。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LinkStatus = 'live' | 'paid' | 'expired'

export interface PaymentLinkRecord {
  /** 本地记录 id */
  id: string
  productId: string
  /** PLB payment resource id */
  resourceId: string
  /** 买家可支付的托管 URL */
  payUrl: string
  /** 本地生命周期覆盖：live=已创建 / paid=回流标记已支付 / expired */
  status: LinkStatus
  /** PLB 侧资源状态（如 ACTIVE），由 refresh/getLink 同步，独立于本地 status */
  resourceStatus?: string
  /** 展示名（下单商品名，便于 UI 与 API 导入的记录统一展示） */
  name?: string
  reusable?: string
  amount: string
  currency: string
  createdAt: number
  /** 原始响应，便于查看 */
  raw?: unknown
}

interface PaymentLinksState {
  links: PaymentLinkRecord[]
  add: (record: PaymentLinkRecord) => void
  update: (id: string, patch: Partial<PaymentLinkRecord>) => void
  remove: (id: string) => void
  byProduct: (productId: string) => PaymentLinkRecord[]
}

export const usePaymentLinksStore = create<PaymentLinksState>()(
  persist(
    (set, get) => ({
      links: [],
      add: (record) => set((s) => ({ links: [record, ...s.links] })),
      update: (id, patch) =>
        set((s) => ({ links: s.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      remove: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),
      byProduct: (productId) => get().links.filter((l) => l.productId === productId),
    }),
    { name: 'paylink-demo-links' },
  ),
)
