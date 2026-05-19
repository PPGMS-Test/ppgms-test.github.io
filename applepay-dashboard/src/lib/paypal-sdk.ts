// PayPal JS SDK dynamic loader

export type ApplePayCDNVersion = 'v1' | '1.latest'

const APPLE_PAY_CDN: Record<ApplePayCDNVersion, string> = {
  v1: 'https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js',
  '1.latest': 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js',
}

const PAYPAL_SCRIPT_ID = 'paypal-js-sdk'
const APPLE_PAY_SCRIPT_ID = 'apple-pay-sdk'

import { PAYMENT_CURRENCY } from '@/scenarios/types'

export function loadPayPalSDK(clientId: string, currency = PAYMENT_CURRENCY): Promise<void> {
  return new Promise((resolve, reject) => {
    // Remove old script and clear window.paypal so the reload starts clean.
    // Without this, the old Applepay() instance may linger in closures.
    document.getElementById(PAYPAL_SCRIPT_ID)?.remove()
    if ('paypal' in window) {
      // @ts-expect-error — intentionally clearing stale SDK instance before reload
      delete window.paypal
    }

    const script = document.createElement('script')
    script.id = PAYPAL_SCRIPT_ID
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&buyer-country=US&currency=${currency}&components=applepay,buttons`
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('PayPal SDK failed to load'))
    document.head.appendChild(script)
  })
}

export function loadApplePaySDK(version: ApplePayCDNVersion): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(APPLE_PAY_SCRIPT_ID) as HTMLScriptElement | null

    if (existing) {
      // Apple Pay SDK mutates window state and cannot be safely reloaded mid-session.
      if (existing.src === APPLE_PAY_CDN[version]) {
        resolve() // same version already loaded — ok
      } else {
        reject(
          new Error(`Apple Pay CDN 版本已切换为 ${version}，请刷新页面后重新初始化。`),
        )
      }
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
