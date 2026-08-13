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
  return clone
}

/** 分步打印每次调用的 method/url/headers/body/status/response */
export const withLogging: Enhancer = (next) => async (req) => {
  const tag = `[API][${req.label}]`
  console.log(`${tag}[1] ${req.method} ${req.url}`)
  console.log(`${tag}[2] headers`, redact(req.headers))
  if (req.body !== undefined) console.log(`${tag}[3] body`, req.body)
  const res = await next(req)
  if (res.ok) console.log(`${tag}[4] HTTP ${res.status} ✓`, res.data)
  else console.error(`${tag}[4] HTTP ${res.status} ✗`, res.data)
  return res
}

/** 非 2xx 时按 PayPal 错误体归一并抛 ApiError */
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
    throw new ApiError(msg, res.status, res.data)
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
