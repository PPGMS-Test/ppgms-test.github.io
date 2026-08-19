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
export const PUBLIC_BASE_URL = 'https://ppgms-test.github.io/__6__-API/payment-link-demo/'

/**
 * 图片两步上传功能的**默认开关**。
 *
 * PLB 图片 API（POST/GET/DELETE /v1/checkout/payment-resources/images + line_items[].images[]）
 * 是 PayPal 内部 Q1 2026 「Advanced Commerce」路线图上的能力，目前处于 Architect Review / HLD·LLD·Spike
 * 阶段，受 feature flag(ADR-IMG-016) 门控，**尚未部署到公开的 api-m.sandbox.paypal.com**（直接调用返回 404）。
 *
 * 因此默认关闭：公开 sandbox 上 demo 照常建 link，不受影响。
 * 在开了该 flag 的内部环境里，把此项设为 true（或用 UI 上的全局开关打开），即可启用完整两步上传。
 * 开启后上传仍是 best-effort：接口不可用时只记录并跳过图片，不会挡住建 link。
 */
export const IMAGES_FEATURE_DEFAULT = false

/** 本地回环 host（这些 host 不能作 PayPal return_url） */
export function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
}
