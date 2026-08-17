/**
 * PayPal PLB 客户端工厂。
 * createPayPalClient({config, credential}) 返回一组方法：
 *   oauthToken / createLink / listLinks / getLink / updateLink / deleteLink
 * 每个方法都经 compose(withLogging, withErrorNormalization, withAuthHeaders)(baseFetch) 执行，
 * 因此自动带日志、错误归一与鉴权头注入。
 */
import type { PayPalConfig } from '@/config/paypal.config'
import type { PartnerCredential } from '@/config/credentials.config'
import { generatePayPalAuthAssertion } from '@/lib/auth-assertion'
import {
  baseFetch,
  compose,
  withAuthHeaders,
  withErrorNormalization,
  withLogging,
  type ApiRequest,
} from './enhancers'
import type {
  CreatePaymentResourceInput,
  UpdatePaymentResourceInput,
  PaymentResource,
  PaymentResourceList,
} from './types'

export interface PayPalClientDeps {
  config: PayPalConfig
  credential: PartnerCredential
}

interface TokenCache {
  token: string
  expiresAt: number
}

/** List 端点查询参数（对应文档的 page_size / page_token / status） */
export interface ListLinksOptions {
  pageSize?: number
  pageToken?: string
  status?: string
}

/** 幂等键：非安全上下文(crypto 不可用)时退化到时间戳+随机数 */
function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function createPayPalClient({ config, credential }: PayPalClientDeps) {
  let tokenCache: TokenCache | null = null

  // OAuth 走独立管线：只需日志 + 错误归一（用 Basic，不需要 Bearer 注入）
  const oauthPipeline = compose(withLogging, withErrorNormalization)(baseFetch)

  async function oauthToken(): Promise<string> {
    const now = Date.now()
    if (tokenCache && tokenCache.expiresAt > now + 30_000) {
      console.log('[API][oauthToken] cached ✓')
      return tokenCache.token
    }
    const basic = btoa(`${credential.partnerClientId}:${credential.partnerClientSecret}`)
    const res = await oauthPipeline({
      label: 'oauthToken',
      method: 'POST',
      path: config.endpoints.oauthToken,
      url: `${config.apiBase}${config.endpoints.oauthToken}`,
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })
    const data = res.data as { access_token: string; expires_in: number }
    tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 }
    return data.access_token
  }

  // 业务管线鉴权头：
  //   - first-party：只发 Bearer + JSON（商户自有凭证，无需 auth-assertion）
  //   - third-party：额外注入 PayPal-Auth-Assertion(iss=partner, payer_id=merchant) + BN Code
  async function authHeaders(): Promise<Record<string, string>> {
    const token = await oauthToken()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    if (credential.mode === 'third-party' && credential.partnerMerchantId) {
      headers['PayPal-Auth-Assertion'] = generatePayPalAuthAssertion(
        credential.partnerClientId,
        credential.partnerMerchantId,
      )
      headers['PayPal-Partner-Attribution-Id'] = config.bnCode
    }
    return headers
  }

  // 业务管线：withLogging 放在**最内层**（贴近 baseFetch），
  // 这样它打印的是 withAuthHeaders 注入后的最终请求头（能看到 Bearer / Auth-Assertion / BN），
  // 而不是注入前的空头。错误归一在最外层，非 2xx 时抛出。
  const pipeline = compose(
    withErrorNormalization,
    withAuthHeaders(authHeaders),
    withLogging,
  )(baseFetch)

  const resourceUrl = (id?: string) =>
    `${config.apiBase}${config.endpoints.paymentResources}${id ? `/${id}` : ''}`

  // per-call 额外头（如 PayPal-Request-Id）优先级高于 auth 头
  async function run<T>(
    partial: Omit<ApiRequest, 'headers'> & { headers?: Record<string, string> },
  ): Promise<T> {
    const { headers = {}, ...rest } = partial
    const res = await pipeline({ ...rest, headers })
    return res.data as T
  }

  /**
   * 组装 PLB 请求体：补齐 integration_mode/type 默认值，其余字段（reusable /
   * return_url / line_items[...]）直接透传。line_items 已是文档结构，无需再映射。
   */
  function buildResourceBody(
    input: CreatePaymentResourceInput | UpdatePaymentResourceInput,
  ): Record<string, unknown> {
    return {
      integration_mode: input.integration_mode ?? 'LINK',
      type: input.type ?? 'BUY_NOW',
      reusable: input.reusable,
      ...(input.return_url ? { return_url: input.return_url } : {}),
      line_items: input.line_items,
    }
  }

  return {
    oauthToken,

    /** 创建 payment link；带 PayPal-Request-Id 幂等键（重试须复用同一 id） */
    createLink: (input: CreatePaymentResourceInput, idempotencyKey?: string) =>
      run<PaymentResource>({
        label: 'createLink',
        method: 'POST',
        path: config.endpoints.paymentResources,
        url: resourceUrl(),
        headers: { 'PayPal-Request-Id': idempotencyKey ?? requestId() },
        body: buildResourceBody(input),
      }),

    /** 列出 payment resources（支持 page_size / page_token / status 过滤 + 分页） */
    listLinks: (opts: ListLinksOptions = {}) => {
      const qs = new URLSearchParams()
      if (opts.pageSize) qs.set('page_size', String(opts.pageSize))
      if (opts.pageToken) qs.set('page_token', opts.pageToken)
      if (opts.status) qs.set('status', opts.status)
      const query = qs.toString()
      return run<PaymentResourceList>({
        label: 'listLinks',
        method: 'GET',
        path: config.endpoints.paymentResources,
        url: `${resourceUrl()}${query ? `?${query}` : ''}`,
      })
    },

    getLink: (id: string) =>
      run<PaymentResource>({
        label: 'getLink',
        method: 'GET',
        path: config.endpoints.paymentResources,
        url: resourceUrl(id),
      }),

    /** 整体替换 payment resource（PUT）；成功返回 204（body 可能为空） */
    updateLink: (id: string, input: UpdatePaymentResourceInput) =>
      run<PaymentResource | null>({
        label: 'updateLink',
        method: 'PUT',
        path: config.endpoints.paymentResources,
        url: resourceUrl(id),
        body: buildResourceBody(input),
      }),

    deleteLink: (id: string) =>
      run<null>({
        label: 'deleteLink',
        method: 'DELETE',
        path: config.endpoints.paymentResources,
        url: resourceUrl(id),
      }),
  }
}

export type PayPalClient = ReturnType<typeof createPayPalClient>
