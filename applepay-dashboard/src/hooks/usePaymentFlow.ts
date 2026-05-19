import { useState, useCallback } from 'react'
import { getActiveCredentials } from '@/store/credentials'
import {
  loadPayPalSDK,
  loadApplePaySDK,
  isApplePaySupported,
  getApplePaySDKConfig,
} from '@/lib/paypal-sdk'
import { createApplePaySession } from '@/lib/apple-pay'
import type { ApplePayScenario } from '@/scenarios/types'
import type { ApplePayCDNVersion } from '@/lib/paypal-sdk'

export type PaymentStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error'
  | 'cancelled'

export interface PaymentResult {
  transactionId: string
  captureData: unknown
}

export interface PaymentFlowConfig {
  scenario: ApplePayScenario
  amount: string
  vaultId?: string
  cdnVersion: ApplePayCDNVersion
}

export function usePaymentFlow() {
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [sdkConfig, setSdkConfig] = useState<PayPalApplepayConfig | null>(null)

  const initialize = useCallback(async (config: PaymentFlowConfig) => {
    setStatus('loading')
    setError(null)
    setResult(null)
    setSdkConfig(null)

    try {
      const { clientId } = getActiveCredentials()
      await loadPayPalSDK(clientId)

      if (config.scenario !== 'recurring-vault') {
        await loadApplePaySDK(config.cdnVersion)

        if (!isApplePaySupported()) {
          throw new Error(
            'Apple Pay not supported. Use Safari on an Apple device with a card set up.',
          )
        }
      }

      const applePayCfg = await getApplePaySDKConfig()
      if (!applePayCfg.isEligible && config.scenario !== 'recurring-vault') {
        throw new Error('Apple Pay is not eligible for this merchant/region.')
      }

      setSdkConfig(applePayCfg)
      setStatus('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Initialization failed'
      setError(msg)
      setStatus('error')
    }
  }, [])

  const startPayment = useCallback(
    (config: PaymentFlowConfig) => {
      if (!sdkConfig) return

      setStatus('processing')
      setError(null)

      const session = createApplePaySession(
        {
          scenario: config.scenario,
          amount: config.amount,
          vaultId: config.vaultId,
          sdkConfig,
        },
        {
          onSuccess: (transactionId, captureData) => {
            setResult({ transactionId, captureData })
            setStatus('success')
          },
          onFailure: (err) => {
            const msg = err instanceof Error ? err.message : 'Payment failed'
            setError(msg)
            setStatus('error')
          },
          onCancel: () => {
            setStatus('ready')
          },
        },
      )

      session.begin()
    },
    [sdkConfig],
  )

  const startRecurringPayment = useCallback(async (config: PaymentFlowConfig) => {
    if (config.scenario !== 'recurring-vault') return

    setStatus('processing')
    setError(null)

    try {
      const { createApplePayOrder, captureApplePayOrder, extractTransactionId } = await import(
        '@/lib/api'
      )
      const order = await createApplePayOrder({
        scenario: 'recurring-vault',
        amount: config.amount,
        vaultId: config.vaultId,
      })
      const captureData = await captureApplePayOrder(order.id)
      const txId = extractTransactionId(captureData)
      setResult({ transactionId: txId ?? order.id, captureData })
      setStatus('success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recurring payment failed'
      setError(msg)
      setStatus('error')
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setResult(null)
    setSdkConfig(null)
  }, [])

  return {
    status,
    error,
    result,
    sdkConfig,
    initialize,
    startPayment,
    startRecurringPayment,
    reset,
  }
}
