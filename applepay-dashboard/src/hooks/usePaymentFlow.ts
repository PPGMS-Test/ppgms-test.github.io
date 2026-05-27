/**
 * 支付流程状态机 Hook。
 *
 * 作用：
 *   管理从"空闲"到"加载 SDK → 就绪 → 支付中 → 成功/失败"的完整状态流转，
 *   对外暴露 initialize / startPayment / startRecurringPayment / reset 四个操作，
 *   以及 status / error / result / sdkConfig 四个状态字段。
 *
 * 被使用处：
 *   - src/App.tsx — 唯一调用方，解构所有返回值驱动 UI 渲染与交互
 *
 * 状态流转：
 *   idle → (initialize) → loading → ready
 *                                 → error（SDK 加载失败 / 不支持 Apple Pay）
 *   ready → (startPayment / startRecurringPayment) → processing → success
 *                                                              → error（支付失败）
 *   任意状态 → (reset) → idle
 */
import { useState, useCallback } from 'react'
import { getActiveCredentials, useCredentialsStore } from '@/store/credentials'
import { extractVaultInfo } from '@/lib/api'
import {
  loadPayPalSDK,
  loadApplePaySDK,
  isApplePaySupported,
  getApplePaySDKConfig,
} from '@/lib/paypal-sdk'
import { createApplePaySession } from '@/lib/apple-pay'
import type { ApplePayScenario } from '@/scenarios/types'
import type { ApplePayCDNVersion } from '@/lib/paypal-sdk'

/**
 * 支付流程各阶段状态：
 * idle=初始 | loading=加载SDK | ready=就绪可支付 | processing=支付中 | success=成功 | error=失败
 */
export type PaymentStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error'

/** 支付成功后的结果，包含 PayPal 交易 ID 和完整 capture 响应体 */
export interface PaymentResult {
  transactionId: string
  captureData: unknown
}

/** 每次 initialize / startPayment 调用时传入的配置 */
export interface PaymentFlowConfig {
  scenario: ApplePayScenario
  amount: string
  /** 仅 one-time-vault / recurring-vault 场景使用 */
  vaultId?: string
  cdnVersion: ApplePayCDNVersion
}

/** 将任意类型的错误转换为可展示的字符串，无法识别时返回 fallback */
function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return fallback
  }
}

export function usePaymentFlow() {
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [sdkConfig, setSdkConfig] = useState<PayPalApplepayConfig | null>(null)

  /**
   * 初始化 SDK：按顺序加载 PayPal SDK → Apple Pay SDK → 检测支持性 → 获取配置。
   * recurring-vault 场景不需要 Apple Pay，直接置为 ready。
   */
  const initialize = useCallback(async (config: PaymentFlowConfig) => {
    setStatus('loading')
    setError(null)
    setResult(null)
    setSdkConfig(null)

    try {
      // recurring-vault uses the backend API only — no PayPal JS SDK or Apple Pay needed
      if (config.scenario === 'recurring-vault') {
        setStatus('ready')
        return
      }

      const { clientId } = getActiveCredentials()
      console.log('[usePaymentFlow] initialize — scenario:', config.scenario, '| cdnVersion:', config.cdnVersion, '| clientId:', clientId)
      await loadPayPalSDK(clientId)
      await loadApplePaySDK(config.cdnVersion)

      if (!isApplePaySupported()) {
        throw new Error(
          'Apple Pay not supported on this device/browser. Use Safari on an Apple device.',
        )
      }

      const applePayCfg = await getApplePaySDKConfig()
      console.log('[usePaymentFlow] isEligible:', applePayCfg.isEligible)
      if (!applePayCfg.isEligible) {
        throw new Error('Apple Pay is not eligible for this merchant/region.')
      }

      setSdkConfig(applePayCfg)
      setStatus('ready')
      console.log('[usePaymentFlow] initialization complete ✓')
    } catch (err) {
      console.error('[usePaymentFlow] Initialization error:', err)
      setError(toErrorMessage(err, 'Initialization failed'))
      setStatus('error')
    }
  }, [])

  /**
   * 触发 Apple Pay 支付（one-time-basic / one-time-vault 场景）。
   * 须在 initialize() 成功后调用（sdkConfig 非 null），否则置为 error 状态。
   * 内部创建 ApplePaySession 并调用 session.begin() 弹出系统支付面板。
   */
  const startPayment = useCallback(
    (config: PaymentFlowConfig) => {
      if (!sdkConfig) {
        setError('SDK not initialized — please click "确认配置并初始化 SDK" first')
        setStatus('error')
        return
      }

      setStatus('processing')
      setError(null)

      const session = createApplePaySession(
        { scenario: config.scenario, amount: config.amount, vaultId: config.vaultId, sdkConfig },
        {
          onSuccess: (transactionId, captureData) => {
            // one-time-vault 成功后提取 vault info 并存入 store，供 recurring-vault 使用
            if (config.scenario === 'one-time-vault') {
              const vaultInfo = extractVaultInfo(captureData as Parameters<typeof extractVaultInfo>[0])
              if (vaultInfo) {
                console.log('[usePaymentFlow] vault info saved — vaultId:', vaultInfo.vaultId, '| customerId:', vaultInfo.customerId)
                useCredentialsStore.getState().setLastVaultInfo(vaultInfo.vaultId, vaultInfo.customerId)
              }
            }
            setResult({ transactionId, captureData })
            setStatus('success')
          },
          onFailure: (err) => {
            console.error('[usePaymentFlow] Payment error:', err)
            setError(toErrorMessage(err, 'Payment failed'))
            setStatus('error')
          },
          onCancel: () => setStatus('ready'),
        },
      )

      session.begin()
    },
    [sdkConfig],
  )

  /**
   * 触发 MIT 定期扣款（recurring-vault 场景）。
   * 不需要 Apple Pay session，也不需要 capture — createOrder 即完成扣款，
   * 直接取 purchase_units 下的 payments.captures/authorizations 作为交易结果。
   */
  const startRecurringPayment = useCallback(async (config: PaymentFlowConfig) => {
    if (config.scenario !== 'recurring-vault') return

    setStatus('processing')
    setError(null)

    try {
      const { createApplePayPayPalOrder } = await import('@/lib/api')
      console.log('[usePaymentFlow] recurring payment — amount:', config.amount, '| vaultId:', config.vaultId)
      const order = await createApplePayPayPalOrder({
        scenario: 'recurring-vault',
        amount: config.amount,
        vaultId: config.vaultId,
      })
      console.log('[usePaymentFlow] recurring order response:', JSON.stringify(order))
      const txn =
        order.purchase_units?.[0]?.payments?.captures?.[0] ??
        order.purchase_units?.[0]?.payments?.authorizations?.[0]
      const transactionId = txn?.id ?? order.id
      console.log('[usePaymentFlow] ✓ recurring payment SUCCESS — transactionId:', transactionId)
      setResult({ transactionId, captureData: order })
      setStatus('success')
    } catch (err) {
      console.error('[usePaymentFlow] Recurring payment error:', err)
      setError(toErrorMessage(err, 'Recurring payment failed'))
      setStatus('error')
    }
  }, [])

  /** 重置所有状态到 idle，允许用户重新选择场景或重新初始化 */
  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    setSdkConfig(null)
  }, [])

  return { status, error, result, sdkConfig, initialize, startPayment, startRecurringPayment, reset }
}
