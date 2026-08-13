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
import type { CreateLinkInput, UpdateLinkInput, PaymentResource } from './types'

export interface PayPalClientDeps {
  config: PayPalConfig
  credential: PartnerCredential
}

interface TokenCache {
  token: string
  expiresAt: number
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

  // 业务管线：注入 Bearer + Auth-Assertion + BN + JSON content-type
  async function authHeaders(): Promise<Record<string, string>> {
    const token = await oauthToken()
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Auth-Assertion': generatePayPalAuthAssertion(
        credential.partnerClientId,
        credential.partnerMerchantId,
      ),
      'PayPal-Partner-Attribution-Id': config.bnCode,
    }
  }

  const pipeline = compose(
    withLogging,
    withErrorNormalization,
    withAuthHeaders(authHeaders),
  )(baseFetch)

  const resourceUrl = (id?: string) =>
    `${config.apiBase}${config.endpoints.paymentResources}${id ? `/${id}` : ''}`

  async function run<T>(partial: Omit<ApiRequest, 'headers'>): Promise<T> {
    const res = await pipeline({ ...partial, headers: {} })
    return res.data as T
  }

  return {
    oauthToken,

    createLink: (input: CreateLinkInput) =>
      run<PaymentResource>({
        label: 'createLink',
        method: 'POST',
        path: config.endpoints.paymentResources,
        url: resourceUrl(),
        body: input,
      }),

    listLinks: () =>
      run<{ items?: PaymentResource[] } & Record<string, unknown>>({
        label: 'listLinks',
        method: 'GET',
        path: config.endpoints.paymentResources,
        url: resourceUrl(),
      }),

    getLink: (id: string) =>
      run<PaymentResource>({
        label: 'getLink',
        method: 'GET',
        path: config.endpoints.paymentResources,
        url: resourceUrl(id),
      }),

    updateLink: (id: string, input: UpdateLinkInput) =>
      run<PaymentResource>({
        label: 'updateLink',
        method: 'PUT',
        path: config.endpoints.paymentResources,
        url: resourceUrl(id),
        body: input,
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
