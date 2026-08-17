/**
 * App 级配置（非 PayPal API 配置）。全部 hardcode，不用 env。
 *
 * PUBLIC_BASE_URL：给 PLB return_url 用的**公网** base。
 *   PayPal 拒绝 localhost 作 return_url(422 INVALID_URL_FORMAT)，公网 https 才行。
 *   - 留空('')：本地 localhost 运行时会**省略 return_url**(创建照样成功，只是支付后不自动回流站内)。
 *   - 填公网地址(部署地址 / ngrok 隧道，形如 'https://yourhost.example.com/')：
 *     return_url 用它拼接，买家支付成功后能回流到该地址的 app 并标记 paid。
 *   末尾带不带 `/` 都可，buildReturnUrl 会规整。
 */
export const PUBLIC_BASE_URL = ''

/** 本地回环 host（这些 host 不能作 PayPal return_url） */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}
