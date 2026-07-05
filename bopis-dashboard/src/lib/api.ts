// ============================================================
// lib/api.ts — 前端 API 调用层
// Frontend API client. All calls go through our Next.js backend
// proxy on Cloudflare Pages (ppgms-test-github-io.pages.dev),
// which then calls the real PayPal API with server credentials.
//
// 架构：浏览器 → 此文件 → Next.js 后端 → PayPal Sandbox API
// Architecture: Browser → api.ts → Next.js backend → PayPal Sandbox
//
// 为什么不直接从浏览器调 PayPal？
// Why not call PayPal directly from the browser?
//   1. PayPal API 需要 Bearer Token（client_secret），不能暴露在前端。
//      PayPal API requires a Bearer Token derived from client_secret — unsafe in browser.
//   2. 跨域 CORS 限制——PayPal API 不允许浏览器直接跨域请求。
//      PayPal API doesn't allow cross-origin requests from browsers.
// ============================================================

import type { StoreAddress } from '@/types'

// 后端代理的 base URL（Cloudflare Pages 上的 Next.js App）。
// Backend base URL — change this to localhost:3000 for local development if needed.
// 本地开发时可改为 'http://localhost:3000'。
const BASE = 'https://ppgms-test-github-io.pages.dev'

// ── 内部 HTTP 工具函数 Internal fetch wrapper ────────────────
/**
 * 所有请求的统一入口，负责：
 * Unified fetch wrapper that handles:
 *   1. 拼接完整 URL（BASE + path）
 *   2. 默认添加 Content-Type: application/json
 *   3. 解析响应 JSON（失败时 fallback 为原始状态文本）
 *   4. 从响应头中提取 PayPal debug-id（用于排查问题）
 *
 * @param path  API 路径，例如 '/api/checkout/bopis/orders/create'
 * @param init  fetch RequestInit 选项（method, body 等）
 * @returns     { data, status, debugId }
 */
async function req(
  path: string,
  init?: RequestInit,
): Promise<{ data: unknown; status: number; debugId?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
    // 注意：展开 init 后 headers 可能被覆盖，此处 init 中若含 headers 字段会合并覆盖。
    // Note: if init contains its own headers they override the default above.
  })

  // 尝试解析 JSON；API 返回非 JSON 时（如 504 Gateway Timeout）fallback 为原始文本。
  // Try to parse JSON; fall back to a raw text object on parse failure (e.g. 504 errors).
  const data = await res.json().catch(() => ({ _raw: `${res.status} ${res.statusText}` }))

  // 后端通过自定义响应头 X-PayPal-Debug-Id 把 PayPal 的 debug ID 透传给前端。
  // Backend forwards the PayPal debug-id via the custom header X-PayPal-Debug-Id.
  // 遇到问题时把这个 ID 提供给 PayPal 支持可快速定位日志。
  // Provide this ID to PayPal support when filing tickets.
  const debugId = res.headers.get('x-paypal-debug-id') ?? undefined

  return { data, status: res.status, debugId }
}

// ── BOPIS 订单创建 Create BOPIS order ───────────────────────
/**
 * 创建单门店 BOPIS 订单（单 purchase_unit，intent=AUTHORIZE）。
 * Creates a single-store BOPIS order with intent=AUTHORIZE (hold funds, don't capture).
 *
 * 后端路由：paypal-backend-api/src/app/api/checkout/bopis/orders/create/route.ts
 * Backend route: paypal-backend-api/.../bopis/orders/create/route.ts
 *
 * 对应 PayPal API：POST /v2/checkout/orders
 * Maps to PayPal API: POST /v2/checkout/orders
 */
export async function createBopisOrder(params: {
  amount: string          // 字符串金额，例如 "75.00"（PayPal 要求字符串格式）
  storeName: string       // 显示在 PayPal 收款页的门店名
  storeAddress: StoreAddress
  pickupCode: string      // 内部提货码，存入 custom_id 字段
}) {
  return req('/api/checkout/bopis/orders/create', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── 多门店 BOPIS 订单创建 Multi-unit BOPIS order ─────────────
/**
 * 创建多 purchase_unit 的 BOPIS 订单（实验 B，研究用）。
 * Creates a multi-PU BOPIS order for research purposes (Experiment B).
 *
 * ⚠️ 重要发现 Key finding:
 *   PayPal 不支持多 PU 订单使用 intent=AUTHORIZE，只支持 intent=CAPTURE。
 *   PayPal rejects intent=AUTHORIZE for multi-PU orders — only CAPTURE is allowed.
 *   这意味着多门店场景无法使用"先冻结后提货"的 BOPIS 流程。
 *   This means multi-store BOPIS cannot use the auth+capture flow.
 *
 * 后端路由：paypal-backend-api/.../bopis/orders/create-multi/route.ts
 */
export async function createBopisOrderMultiUnit(params: {
  units: Array<{
    amount: string
    storeName: string
    storeAddress: StoreAddress
    referenceId: string   // 用于区分各 PU，授权后通过此 ID 找到对应的 authorizationId
  }>
}) {
  return req('/api/checkout/bopis/orders/create-multi', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ── 授权订单 Authorize order ─────────────────────────────────
/**
 * 买家在 PayPal 页面批准后，调用此接口冻结资金（不扣款）。
 * After buyer approves in PayPal, call this to freeze funds without charging.
 *
 * 返回值中包含 authorizationId，后续 capture / void 需要用到。
 * Response contains authorizationId — required for capture and void calls.
 *
 * 对应 PayPal API：POST /v2/checkout/orders/{orderId}/authorize
 * 请求体为空（Content-Type: application/json 仍需发送，否则 PayPal 返回 HTTP 415）。
 * Request body is empty but Content-Type header is still required to avoid HTTP 415.
 */
export async function authorizeOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/authorize`, { method: 'POST' })
}

// ── 捕获授权 Capture authorization ──────────────────────────
/**
 * 买家到店验证取货后，调用此接口正式扣款。
 * Called when buyer picks up the item — charges the previously authorized amount.
 *
 * amount 参数：
 *   - 不传 or 空：PayPal 自动扣全额授权金额（Full Capture）
 *   - 传入具体金额：仅扣指定金额（Partial Capture），剩余冻结额需另行 capture 或 void
 *   - Omit/empty: captures the full authorized amount
 *   - Provide amount string: partial capture; remaining funds stay frozen until captured or voided
 *
 * finalCapture 参数：标记为最终 capture（释放剩余冻结额）。
 *   - finalCapture: mark this as the final capture (releases any remaining hold)
 *
 * 对应 PayPal API：POST /v2/payments/authorizations/{authorizationId}/capture
 */
export async function captureAuthorization(authId: string, amount?: string, finalCapture?: boolean) {
  const bodyObj: Record<string, unknown> = {}
  if (amount) bodyObj.amount = amount
  if (finalCapture !== undefined) bodyObj.final_capture = finalCapture
  return req(`/api/payments/authorizations/${authId}/capture`, {
    method: 'POST',
    // amount 有值时带入 body；没有时传空对象（body 不能为 null，否则 Content-Length 问题）
    body: JSON.stringify(Object.keys(bodyObj).length ? bodyObj : {}),
  })
}

// ── 作废授权 Void authorization ──────────────────────────────
/**
 * 释放冻结资金，不扣款（例如买家超时未取货、订单取消）。
 * Releases frozen funds without charging — used for order cancellations or expired pickups.
 *
 * PayPal 返回 HTTP 204 No Content（无 body）。
 * 后端会将 204 映射为 200 并附加 { status: 'VOIDED' } 占位 body，
 * 以避免 Edge Runtime 丢失 response 的问题。
 * PayPal returns 204 No Content; backend remaps it to 200 + { status: 'VOIDED' }
 * because Edge Runtime may drop the bodyless response.
 *
 * 对应 PayPal API：POST /v2/payments/authorizations/{authorizationId}/void
 */
export async function voidAuthorization(authId: string) {
  return req(`/api/payments/authorizations/${authId}/void`, { method: 'POST' })
}

// ── 查询订单详情 Get order details ───────────────────────────
/**
 * 获取完整订单信息，包括 purchase_units[].shipping 地址、payments 状态等。
 * Fetches full order details including shipping addresses and payment status.
 *
 * 常用于步骤完成后验证字段是否符合预期（例如 shipping 地址是否固定、
 * finalCapture 字段的值）。
 * Useful for verifying fields after a flow completes (e.g. shipping address,
 * finalCapture flag behavior in sandbox).
 *
 * 对应 PayPal API：GET /v2/checkout/orders/{orderId}
 */
export async function getOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}`, { method: 'GET' })
}

// ── 多门店 CAPTURE 订单创建 Multi-store CAPTURE order ────────
/**
 * 创建 5 门店 BOPIS 订单（5 purchase_unit，intent=CAPTURE）。
 * Creates a 5-store BOPIS order with intent=CAPTURE.
 * 数据全部硬编码在后端，无需传参。
 * All PU data is hardcoded in the backend — no parameters needed.
 *
 * 后端路由：paypal-backend-api/.../bopis/orders/create-multi-capture/route.ts
 */
export async function createBopisOrderMultiCapture() {
  return req('/api/checkout/bopis/orders/create-multi-capture', { method: 'POST' })
}

// ── 捕获整个订单 Capture entire order ───────────────────────
/**
 * 捕获 intent=CAPTURE 订单中的所有 purchase_unit（一次性扣款）。
 * Captures all purchase units in a CAPTURE-intent order in a single call.
 *
 * 与 captureAuthorization 的区别：
 *   - captureAuthorization: AUTHORIZE flow 专用，针对单个 authorizationId
 *   - captureOrder: CAPTURE flow 专用，针对整个 orderId
 *
 * 对应 PayPal API：POST /v2/checkout/orders/{orderId}/capture
 * 后端路由：paypal-backend-api/.../checkout/orders/[orderId]/capture/route.ts
 */
export async function captureOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/capture`, { method: 'POST' })
}

// ── 重新授权 Reauthorize authorization ────────────────────────
/**
 * 重新授权冻结资金，用于扩展已过期或即将过期的授权。
 * Reauthorizes a previously authorized payment, extending the hold period.
 *
 * amount 参数：
 *   - 不传：保持原授权金额
 *   - 传入新金额：更新授权额度
 *   - Omit: keeps the original amount
 *   - Provide amount: updates the authorization amount
 *
 * 对应 PayPal API：POST /v2/payments/authorizations/{authorizationId}/reauthorize
 */
export async function reauthorizeAuthorization(authId: string, amount?: string) {
  return req(`/api/payments/authorizations/${authId}/reauthorize`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}

// ── 创建 AS2 BOPIS 订单 Create AS2 BOPIS order ───────────────
/**
 * 创建 AS2 认证的 BOPIS 订单（单 purchase_unit，intent=AUTHORIZE）。
 * Creates an AS2-authenticated BOPIS order with intent=AUTHORIZE.
 *
 * amount 参数：订单金额，默认 '200.00'。
 *   - amount: order amount, defaults to '200.00'
 *
 * 后端路由：paypal-backend-api/.../bopis/orders/create-as2/route.ts
 * 对应 PayPal API：POST /v2/checkout/orders
 */
export async function createBopisOrderAS2(amount = '200.00') {
  return req('/api/checkout/bopis/orders/create-as2', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  })
}

// ── 保存 AS2 订单 Save AS2 order ─────────────────────────────
/**
 * 显式保存订单进入 AS2 模式（配合 processing_instruction=ORDER_SAVED_EXPLICITLY）。
 * Explicitly saves the order into AS2 mode.
 *
 * 必须在买家批准后、第一次 authorize 之前调用。
 * Must be called after buyer approval but before the first authorize.
 *
 * 对应 PayPal API：POST /v2/checkout/orders/{orderId}/save
 */
export async function saveOrder(orderId: string) {
  return req(`/api/checkout/orders/${orderId}/save`, { method: 'POST' })
}

// ── 指定金额授权 Authorize order with custom amount ──────────
/**
 * 对已创建订单进行指定金额的授权。
 * Authorizes an existing order with a specified amount.
 *
 * amount 参数：
 *   - 不传：使用订单原金额
 *   - 传入具体金额：进行部分授权
 *   - Omit: authorizes the full order amount
 *   - Provide amount: authorizes only that amount (partial authorization)
 *
 * 对应 PayPal API：POST /v2/checkout/orders/{orderId}/authorize
 * 后端路由：paypal-backend-api/.../checkout/orders/[orderId]/authorize-amount/route.ts
 */
export async function authorizeOrderAmount(orderId: string, amount?: string) {
  return req(`/api/checkout/orders/${orderId}/authorize-amount`, {
    method: 'POST',
    body: JSON.stringify(amount ? { amount } : {}),
  })
}

// ── 获取 Sandbox Client Token ────────────────────────────────
/**
 * 获取浏览器安全的 Client Token，用于初始化 PayPal Web SDK v6。
 * Fetches a browser-safe client token to initialize the PayPal v6 Web SDK.
 *
 * 与 Bearer Token 不同，Client Token 可以暴露在前端，
 * 但仅用于 SDK 初始化，不能直接调用 PayPal API。
 * Unlike Bearer Tokens, client tokens are safe to expose in the browser —
 * they're only used to initialize the SDK, not to call PayPal APIs.
 *
 * 后端路由：paypal-backend-api/.../auth/sandbox-client-token/route.ts
 * 返回格式：{ accessToken: string, ... }
 */
export async function getSandboxClientToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/sandbox-client-token`, {
    headers: { 'Content-Type': 'application/json' },
  })
  const data = (await res.json()) as { accessToken?: string }
  if (!data.accessToken) throw new Error('Failed to get client token')
  return data.accessToken
}
