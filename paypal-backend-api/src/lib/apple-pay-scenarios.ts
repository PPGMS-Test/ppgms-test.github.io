import { CheckoutPaymentIntent } from '@paypal/paypal-server-sdk'
import type { OrderRequest, OrdersController } from '@paypal/paypal-server-sdk'
import { createOrder } from './order-scenarios'

export type ApplePayScenario = 'one-time-basic' | 'one-time-vault' | 'recurring-vault'

export interface ApplePayOrderParams {
  scenario: ApplePayScenario
  amount: string
  currencyCode?: string
  vaultId?: string
  /** Optional per-request controller built from caller-supplied credentials */
  controller?: OrdersController
  paypalAuthAssertion?: string
}

function buildApplePayOrderBody(params: ApplePayOrderParams): OrderRequest {
  const { scenario, amount, currencyCode = 'USD', vaultId } = params

  const base: OrderRequest = {
    intent: CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        description: 'Apple Pay Test Purchase',
        amount: { currencyCode, value: amount },
      },
    ],
  }

  if (scenario === 'one-time-basic') {
    return {
      ...base,
      paymentSource: {
        applePay: {
          experienceContext: {
            returnUrl: 'https://ppgms-test.github.io',
            cancelUrl: 'https://ppgms-test.github.io',
          },
        } as never,
      },
    }
  }

  if (scenario === 'one-time-vault') {
    // storedCredential is NOT needed on initial vault save — only on subsequent MIT charges
    return {
      ...base,
      paymentSource: {
        applePay: {
          attributes: {
            vault: { storeInVault: 'ON_SUCCESS' as never },
          },
        } as never,
      },
    }
  }

  // recurring-vault (MIT)
  if (!vaultId) throw new Error('vaultId is required for recurring-vault scenario')
  return {
    ...base,
    paymentSource: {
      applePay: {
        vaultId,
        storedCredential: {
          paymentInitiator: 'MERCHANT' as never,
          paymentType: 'RECURRING' as never,
          usage: 'SUBSEQUENT' as never,
        },
      } as never,
    },
  }
}

export async function createApplePayOrder(params: ApplePayOrderParams) {
  const { controller, paypalAuthAssertion, ...rest } = params
  const orderRequestBody = buildApplePayOrderBody(rest)
  return createOrder({ orderRequestBody, controller, paypalAuthAssertion })
}
