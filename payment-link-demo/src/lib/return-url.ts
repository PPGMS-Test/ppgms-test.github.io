/**
 * 回流地址工具。
 *
 * 两条约束（均已对 sandbox 实测）：
 *  1) PLB 的 return_url **不接受 localhost**（http/https 都会 422 INVALID_URL_FORMAT），
 *     只接受公网地址；公网 https + query 参数则完全 OK，return_url 本身也可省略(不传也 201)。
 *  2) 本站是 HashRouter，return 页在 `#/return`；但 return_url 里带 `#` 片段并非问题，
 *     真正问题是 host。为兼容 GitHub Pages(SPA 无 server 端路由)，我们用**普通 query 参数**：
 *       <base>?paylink=<recordId>&status=paid
 *     app 启动时(App.tsx)读取该 query，转发到 HashRouter 的 `/return` 并清掉 search。
 *
 * 策略：
 *  - 配了 PUBLIC_BASE_URL → 用它（即使本地开发也能指向公网 app 测回流）。
 *  - 没配且当前是 localhost → 返回 null（调用方省略 return_url，创建仍成功，只是不回流）。
 *  - 没配但已在公网 → 用当前 origin+pathname。
 *
 * PLB 仅支持 return_url，不发送 cancel_url。
 */
import { PUBLIC_BASE_URL, isLoopbackHost } from '@/config/app.config'

export const RETURN_LINK_PARAM = 'paylink'
export const RETURN_STATUS_PARAM = 'status'

/** 规整 base：去掉末尾多余的 `/`，统一由本函数拼 query */
function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '') + '/'
}

/**
 * 构造给 PLB 的 return_url。若当前处于 localhost 且未配置 PUBLIC_BASE_URL，
 * 返回 null（PayPal 会拒绝 localhost）——调用方据此省略 return_url。
 */
export function buildReturnUrl(recordId: string): string | null {
  const configured = PUBLIC_BASE_URL.trim()
  let base: string
  if (configured) {
    base = normalizeBase(configured)
  } else if (isLoopbackHost(window.location.hostname)) {
    return null
  } else {
    base = normalizeBase(`${window.location.origin}${window.location.pathname}`)
  }
  const qs = new URLSearchParams({ [RETURN_LINK_PARAM]: recordId, [RETURN_STATUS_PARAM]: 'paid' })
  return `${base}?${qs.toString()}`
}

/** 当前环境下 return_url 是否会被省略（用于 UI 提示） */
export function isReturnUrlOmitted(): boolean {
  return !PUBLIC_BASE_URL.trim() && isLoopbackHost(window.location.hostname)
}
