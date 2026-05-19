/**
 * Generates the Paypal-Auth-Assertion header value for 3rd-party (partner) integration.
 * Format: base64({"alg":"none"}).base64({"iss":clientId,"payer_id":merchantId}).
 * This is NOT a secret — it is just base64 encoded, not signed.
 */
export function generatePayPalAuthAssertion(clientId: string, merchantId: string): string {
  const header = 'eyJhbGciOiJub25lIn0=' // base64({"alg":"none"})
  // btoa() only handles Latin-1; encodeURIComponent + unescape handles full Unicode safely
  const json = JSON.stringify({ iss: clientId, payer_id: merchantId })
  const payload = btoa(unescape(encodeURIComponent(json)))
  return `${header}.${payload}.`
}
