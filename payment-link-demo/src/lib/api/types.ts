/**
 * PLB (Payment Links & Buttons) API 类型。
 * 依据官方文档 `POST/GET/PUT/DELETE /v1/checkout/payment-resources` 的 schema 建模，
 * 字段命名与请求/响应体保持一致（snake_case），便于直接序列化上送。
 */
export type IntegrationMode = 'LINK'
export type LinkType = 'BUY_NOW'
/** SINGLE = 一次性链接；MULTIPLE = 可重复使用 */
export type Reusable = 'SINGLE' | 'MULTIPLE'
/** 税费/运费/折扣/手续费的计费方式 */
export type AmountType = 'PERCENTAGE' | 'FLAT'

export interface Money {
  currency_code: string
  value: string
}

export interface Tax {
  name?: string
  type: AmountType
  value: string
}

export interface Shipping {
  type: AmountType
  value: string
  /** 每多一件加收的运费 */
  additional_unit_value?: string
}

export interface Discount {
  type: AmountType
  value: string
}

export interface Handling {
  type: AmountType
  value: string
}

export interface CustomerNote {
  label: string
  required: boolean
}

export interface VariantOption {
  label: string
  /** 仅主维度(primary)的选项需要带单价 */
  unit_amount?: Money
}

export interface VariantDimension {
  name: string
  /** 是否为主维度（主维度的 option 携带价格） */
  primary: boolean
  options: VariantOption[]
}

export interface Variants {
  /** 最多 3 个维度，每维度最多 10 个选项 */
  dimensions: VariantDimension[]
}

export interface AdjustableQuantity {
  /** 创建时文档用 { maximum }；响应有时回 { enabled, min_quantity, max_quantity }，宽松建模 */
  maximum?: number
  enabled?: boolean
  min_quantity?: number
  max_quantity?: number
}

export interface LineItem {
  name: string
  /** 产品 SKU，1–50 字符 */
  product_id?: string
  description?: string
  unit_amount: Money
  taxes?: Tax[]
  shipping?: Shipping[]
  discounts?: Discount[]
  handling?: Handling[]
  collect_shipping_address?: boolean
  customer_notes?: CustomerNote[]
  variants?: Variants
  adjustable_quantity?: AdjustableQuantity
}

/** 创建/更新 payment resource 的请求体（PUT 为整体替换，结构相同） */
export interface CreatePaymentResourceInput {
  /** 默认 LINK */
  integration_mode?: IntegrationMode
  /** 默认 BUY_NOW */
  type?: LinkType
  reusable: Reusable
  /** 买家支付成功后 PayPal 重定向回的地址（PLB 仅支持 return_url，无 cancel_url） */
  return_url?: string
  line_items: LineItem[]
}

export type UpdatePaymentResourceInput = CreatePaymentResourceInput

export interface HateoasLink {
  href: string
  rel: string
  method?: string
}

/** PLB 返回的 payment resource */
export interface PaymentResource {
  id: string
  integration_mode?: string
  type?: string
  reusable?: string
  return_url?: string
  status?: string
  create_time?: string
  update_time?: string
  /** 买家可支付的托管页 URL（.../ncp/payment/PLB-xxx） */
  payment_link?: string
  line_items?: LineItem[]
  links?: HateoasLink[]
  [key: string]: unknown
}

/** List 端点返回体：resources 数组 + 分页 links（rel=self/next） */
export interface PaymentResourceList {
  resources: PaymentResource[]
  links?: HateoasLink[]
}

/** 归一后的 API 错误（携带 PayPal debug_id 便于排障） */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
    public debugId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 从 payment resource 中提取买家可支付的托管 URL。
 * 优先 top-level payment_link，其次 links[] 里 rel=payment_link。
 */
export function extractPayUrl(res: PaymentResource): string | null {
  if (typeof res.payment_link === 'string' && res.payment_link) return res.payment_link
  const byRel = res.links?.find((l) => l.rel === 'payment_link')?.href
  return byRel ?? null
}

/** 从 List 响应的 rel=next 链接里解析下一页 page_token（无则返回 null） */
export function extractNextPageToken(list: PaymentResourceList): string | null {
  const next = list.links?.find((l) => l.rel === 'next')?.href
  if (!next) return null
  try {
    return new URL(next).searchParams.get('page_token')
  } catch {
    // 相对/异常 URL：退化到正则
    const m = /[?&]page_token=([^&]+)/.exec(next)
    return m ? decodeURIComponent(m[1]) : null
  }
}
