// 生成 PayPal-Auth-Assertion 头值：partner 代商户操作时声明代表哪个商户(payer_id)。
// 格式 base64({"alg":"none"}).base64({"iss":clientId,"payer_id":payerId}). —— 仅 base64，非签名，无需保密。
// 移植自 applepay-dashboard/src/lib/auth-assertion.ts。
export function generateAuthAssertion(clientId: string, payerId: string): string {
  const header = 'eyJhbGciOiJub25lIn0=' // base64({"alg":"none"})
  const json = JSON.stringify({ iss: clientId, payer_id: payerId })
  const payload = btoa(unescape(encodeURIComponent(json)))
  return `${header}.${payload}.`
}
