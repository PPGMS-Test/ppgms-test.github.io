/**
 * 可组合的请求增强层（装饰器模式）。
 * 每个 Enhancer 包裹下一个 RequestFn；compose 由外到内串联。
 * 顺序建议：withLogging → withErrorNormalization → withAuthHeaders → baseFetch。
 */
import { ApiError } from './types'

export interface ApiRequest {
  /** 日志标签，如 'createLink' */
  label: string
  method: string
  path: string
  url: string
  headers: Record<string, string>
  body?: unknown
}

export interface ApiResponse<T = unknown> {
  status: number
  ok: boolean
  data: T
}

export type RequestFn = (req: ApiRequest) => Promise<ApiResponse>
export type Enhancer = (next: RequestFn) => RequestFn

/** 由外到内组合：compose(a, b)(base) === a(b(base)) */
export function compose(...enhancers: Enhancer[]): Enhancer {
  return (next) => enhancers.reduceRight((acc, e) => e(acc), next)
}

/** 底层执行器：真正发 fetch，解析 JSON（失败则回退文本） */
export const baseFetch: RequestFn = async (req) => {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body:
      req.body === undefined
        ? undefined
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, ok: res.ok, data }
}

/** 隐藏敏感头再打印 */
function redact(headers: Record<string, string>): Record<string, string> {
  const clone = { ...headers }
  if (clone.Authorization) clone.Authorization = clone.Authorization.replace(/(Basic |Bearer ).+/, '$1***')
  if (clone['PayPal-Auth-Assertion']) clone['PayPal-Auth-Assertion'] = clone['PayPal-Auth-Assertion'].slice(0, 16) + '…'
  return clone
}

/**
 * 解码 PayPal-Auth-Assertion 的 payload（第二段 base64）供排查用。
 * assertion 结构为 `<header>.<payload>.`（alg:none，无签名），payload 内是 {iss, payer_id}。
 * 解不出就返回 null。
 */
function decodeAssertion(assertion: string): { iss?: string; payer_id?: string } | null {
  try {
    const payload = assertion.split('.')[1]
    if (!payload) return null
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

/** 对象转格式化 JSON 字符串便于 console 查看；字符串/原始值原样返回 */
function pretty(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

/** 分步打印每次调用的 method/url/headers/body/status/response */
export const withLogging: Enhancer = (next) => async (req) => {
  const tag = `[API][${req.label}]`
  console.log(`${tag}[1] ${req.method} ${req.url}`)
  console.log(`${tag}[2] headers`, pretty(redact(req.headers)))
  // 把 auth-assertion 解码出来：三方模式能看到 iss(partner)/payer_id(merchant)；
  // 一方模式(及 oauth 调用)该头不存在，打印 "(none)"
  const assertion = req.headers['PayPal-Auth-Assertion']
  console.log(`${tag}[2b] auth-assertion`, assertion ? pretty(decodeAssertion(assertion) ?? '(undecodable)') : '(none)')
  if (req.body !== undefined) console.log(`${tag}[3] body`, pretty(req.body))
  const res = await next(req)
  if (res.ok) {
    console.log(`${tag}[4] HTTP ${res.status} ✓`, pretty(res.data))
  } else {
    const debugId = (res.data as Record<string, unknown> | null)?.debug_id
    console.error(`${tag}[4] HTTP ${res.status} ✗`, pretty(res.data))
    if (debugId) console.error(`${tag}[4] debug_id:`, debugId)
  }
  return res
}

/** 非 2xx 时按 PayPal 错误体归一并抛 ApiError（携带 debug_id） */
export const withErrorNormalization: Enhancer = (next) => async (req) => {
  const res = await next(req)
  if (!res.ok) {
    const d = (res.data ?? {}) as Record<string, unknown>
    const msg =
      (d.message as string) ??
      (d.error_description as string) ??
      (d.error as string) ??
      (d.name as string) ??
      `Request failed: ${res.status}`
    throw new ApiError(msg, res.status, res.data, d.debug_id as string | undefined)
  }
  return res
}

/** 注入异步解析出的鉴权头（Bearer + Auth-Assertion + BN 等），请求自带头优先 */
export function withAuthHeaders(getHeaders: () => Promise<Record<string, string>>): Enhancer {
  return (next) => async (req) => {
    const auth = await getHeaders()
    return next({ ...req, headers: { ...auth, ...req.headers } })
  }
}
