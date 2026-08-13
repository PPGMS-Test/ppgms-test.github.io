/**
 * 生成 PayPal-Auth-Assertion 头值，用于三方（Partner）代商户调用。
 * 格式：base64({"alg":"none"}).base64({"iss":clientId,"payer_id":merchantId}).
 * 仅 base64 编码，非加密签名。
 */
export function generatePayPalAuthAssertion(clientId: string, merchantId: string): string {
  const header = 'eyJhbGciOiJub25lIn0=' // base64({"alg":"none"})
  const json = JSON.stringify({ iss: clientId, payer_id: merchantId })
  const payload = btoa(unescape(encodeURIComponent(json)))
  return `${header}.${payload}.`
}
