/** PLB API 相关类型 */
export interface Money {
  currency_code: string
  value: string
}

export interface CreateLinkInput {
  name: string
  description?: string
  amount: Money
  /** 买家支付成功后 PayPal 重定向回的站内地址 */
  returnUrl?: string
  /** 买家取消支付后 PayPal 重定向回的站内地址 */
  cancelUrl?: string
}

export type UpdateLinkInput = Partial<CreateLinkInput>

/** PLB 返回的 payment resource（schema 未完全公开，宽松建模） */
export interface PaymentResource {
  id: string
  status?: string
  name?: string
  description?: string
  amount?: Money
  links?: Array<{ href: string; rel: string; method?: string }>
  [key: string]: unknown
}

/** 归一后的 API 错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** 从 payment resource 中提取买家可支付的托管 URL */
export function extractPayUrl(res: PaymentResource): string | null {
  if (!res.links?.length) return null
  const byRel = (rel: string) => res.links!.find((l) => l.rel === rel)?.href
  return byRel('pay') ?? byRel('approve') ?? byRel('payer-action') ?? res.links[0].href ?? null
}
