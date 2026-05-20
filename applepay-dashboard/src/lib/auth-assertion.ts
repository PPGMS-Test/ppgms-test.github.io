/**
 * 生成 PayPal Auth Assertion 请求头值，用于三方（Partner）集成场景。
 *
 * 作用：
 *   Partner 代商户发起 API 请求时，需要在请求头附上 `PayPal-Auth-Assertion`，
 *   向 PayPal 声明本次操作代表哪个商户（merchantId）。
 *
 * 格式：base64({"alg":"none"}).base64({"iss":clientId,"payer_id":merchantId}).
 * 注意：此值仅为 base64 编码，并非加密签名，不属于需要保密的信息。
 *
 * 被使用处：
 *   - src/lib/api.ts — credentialHeaders() 在 mode==='partner' 时调用此函数并注入请求头
 *
 * @param clientId   Partner 的 Client ID（即 iss 字段）
 * @param merchantId 被授权商户的 PayPal Merchant ID（payer_id 字段）
 */
export function generatePayPalAuthAssertion(clientId: string, merchantId: string): string {
  const header = 'eyJhbGciOiJub25lIn0=' // base64({"alg":"none"})
  // btoa() only handles Latin-1; encodeURIComponent + unescape handles full Unicode safely
  const json = JSON.stringify({ iss: clientId, payer_id: merchantId })
  const payload = btoa(unescape(encodeURIComponent(json)))
  return `${header}.${payload}.`
}
