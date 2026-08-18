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

/** line_items[].images[] 中引用一张已上传图片（两步上传第二步：用 asset_id 关联） */
export interface LineItemImage {
  /** 第一步上传返回的资产 id */
  asset_id: string
  /** 每个 line item 有且仅有一张 is_primary=true 的主图 */
  is_primary?: boolean
}

/**
 * 图片资产（moderation）状态，来自内部 spec：
 *  - APPROVED  实时 CSAM 扫描通过，买家端可见
 *  - IN_REVIEW 被内部模型标记进入人工复核，可被引用但买家端暂时抑制
 *  - REJECTED  复核不通过
 *  - DELETED   已删除
 */
export type ImageStatus = 'APPROVED' | 'IN_REVIEW' | 'REJECTED' | 'DELETED' | (string & {})

/** 上传 / 查询单张图片返回的资产信息（207 里成功项 / GET {asset_id} 响应） */
export interface ImageAsset {
  asset_id: string
  status: ImageStatus
  /** 该图已附着到哪个 payment resource；null=已上传但未被任何资源引用 */
  resource_id?: string | null
  /** PayPal 托管的图片 URL（pics.paypal.com/...） */
  url?: string
  width?: number
  height?: number
  file_size?: number
  content_type?: string
  create_time?: string
  [key: string]: unknown
}

/** 207 响应里单张图片失败时的错误项（name/message + 请求内零基下标） */
export interface ImageUploadError {
  name: string
  message?: string
  /** 对应请求数组里的零基位置，用于把结果映射回输入 */
  input_index: number
}

/** POST /payment-resources/images 单个结果：成功(ImageAsset) 或失败(ImageUploadError) */
export type ImageUploadResult = ImageAsset | ImageUploadError

/**
 * POST /payment-resources/images 返回体（207 Multi-Status）。
 * images[] 与传入文件按序对应，逐项独立处理：成功项含 asset_id，失败项含 name/input_index。
 */
export interface ImageUploadResponse {
  images: ImageUploadResult[]
}

/** 判断 207 里某结果项是否为成功（含 asset_id） */
export function isImageUploadSuccess(r: ImageUploadResult): r is ImageAsset {
  return typeof (r as ImageAsset).asset_id === 'string'
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
  /** 商品图片：最多 5 张，有且仅有 1 张 is_primary=true（asset_id 由两步上传第一步获得） */
  images?: LineItemImage[]
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
