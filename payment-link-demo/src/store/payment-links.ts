/**
 * 已创建的 payment link 记录（持久化到 localStorage），使买家前台能看到商户刚建的 link。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PaymentLinkRecord {
  /** 本地记录 id */
  id: string
  productId: string
  /** PLB payment resource id */
  resourceId: string
  /** 买家可支付的托管 URL */
  payUrl: string
  /**
   * PLB 侧资源状态。对商户（API 调用者）而言 payment link 只有一个状态：ACTIVE
   * ——能查到即 ACTIVE（被付款 N 次也不变），被 DELETE 后就查不到。由 create/refresh/getLink 同步。
   */
  resourceStatus?: string
  /** 展示名（下单商品名，便于 UI 与 API 导入的记录统一展示） */
  name?: string
  reusable?: string
  /** 创建时使用的呈现方式（LINK / QR_CODE），用于 UI 区分展示 */
  integrationMode?: string
  /** QR_CODE 模式下服务端返回的 QR 图片 URL（若有） */
  qrCodeUrl?: string
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
