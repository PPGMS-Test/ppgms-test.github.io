// PayPal JS SDK dynamic loader

export type ApplePayCDNVersion = 'v1' | '1.latest'

const APPLE_PAY_CDN: Record<ApplePayCDNVersion, string> = {
  v1: 'https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js',
  '1.latest': 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js',
}

const PAYPAL_SCRIPT_ID = 'paypal-js-sdk'
const APPLE_PAY_SCRIPT_ID = 'apple-pay-sdk'

export function loadPayPalSDK(clientId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    document.getElementById(PAYPAL_SCRIPT_ID)?.remove()

    const script = document.createElement('script')
    script.id = PAYPAL_SCRIPT_ID
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&buyer-country=US&currency=USD&components=applepay,buttons`
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK failed to load'))
    document.head.appendChild(script)
  })
}

export function loadApplePaySDK(version: ApplePayCDNVersion): Promise<void> {
  return new Promise((resolve, reject) => {
    // Once 1.latest is loaded it mutates window state — reload page to switch versions
    if (document.getElementById(APPLE_PAY_SCRIPT_ID)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = APPLE_PAY_SCRIPT_ID
    script.src = APPLE_PAY_CDN[version]
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Apple Pay SDK failed to load'))
    document.head.appendChild(script)
  })
}

export function isApplePaySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'ApplePaySession' in window &&
    window.ApplePaySession.supportsVersion(4) &&
    window.ApplePaySession.canMakePayments()
  )
}

export async function getApplePaySDKConfig(): Promise<PayPalApplepayConfig> {
  return window.paypal.Applepay().config()
}
