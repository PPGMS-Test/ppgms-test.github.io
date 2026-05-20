/**
 * PayPal JS SDK 与 Apple Pay SDK 的动态加载工具函数。
 *
 * 作用：
 *   在运行时按需向 document.head 插入 <script> 标签，加载：
 *   1. PayPal JS SDK（含 applepay + buttons 组件）
 *   2. Apple Pay JS SDK（从 Apple CDN 加载，支持 v1 / 1.latest 两个版本）
 *   并提供设备 Apple Pay 支持检测和 SDK 配置获取工具。
 *
 * 被使用处：
 *   - src/hooks/usePaymentFlow.ts — initialize() 中串行调用 loadPayPalSDK / loadApplePaySDK，
 *     随后调用 isApplePaySupported() 和 getApplePaySDKConfig() 完成初始化
 */

/** Apple Pay CDN 版本选项，1.latest 为推荐版本，v1 仅限 Safari */
export type ApplePayCDNVersion = 'v1' | '1.latest'

/** 各版本对应的 Apple Pay SDK CDN 地址 */
const APPLE_PAY_CDN: Record<ApplePayCDNVersion, string> = {
  v1: 'https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js',
  '1.latest': 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js',
}

/** PayPal JS SDK script 标签的 DOM id，用于重载时定位并移除旧脚本 */
const PAYPAL_SCRIPT_ID = 'paypal-js-sdk'
/** Apple Pay SDK script 标签的 DOM id，用于判断是否已加载及版本检查 */
const APPLE_PAY_SCRIPT_ID = 'apple-pay-sdk'

import { PAYMENT_CURRENCY } from '@/scenarios/types'

/**
 * 动态加载 PayPal JS SDK。
 * 每次调用前会移除旧脚本并清除 window.paypal，确保 SDK 从全新状态加载，
 * 避免旧的 Applepay() 实例在闭包中残留。
 */
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

/**
 * 动态加载 Apple Pay JS SDK（来自 Apple CDN）。
 * Apple Pay SDK 会修改 window 全局状态且无法安全重载，因此：
 * - 若已加载相同版本则直接 resolve
 * - 若版本切换则 reject，提示用户刷新页面
 */
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

/**
 * 检测当前设备和浏览器是否支持 Apple Pay。
 * 要求：window.ApplePaySession 存在、支持版本 4 且 canMakePayments() 为真。
 * 非 Safari / 非 Apple 设备会返回 false。
 */
export function isApplePaySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'ApplePaySession' in window &&
    window.ApplePaySession.supportsVersion(4) &&
    window.ApplePaySession.canMakePayments()
  )
}

/**
 * 从已加载的 PayPal SDK 获取 Apple Pay 配置（含 isEligible、merchantIdentifier 等）。
 * 须在 loadPayPalSDK() 完成后调用，否则 window.paypal 不存在会抛错。
 */
export async function getApplePaySDKConfig(): Promise<PayPalApplepayConfig> {
  return window.paypal.Applepay().config()
}
