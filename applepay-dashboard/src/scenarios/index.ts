// Builds the ApplePayPaymentRequest for each scenario
import type { ApplePayScenario } from './types'

interface BuildRequestParams {
  scenario: ApplePayScenario
  amount: string
  sdkConfig: PayPalApplepayConfig
}

export function buildApplePayRequest(params: BuildRequestParams): ApplePayPaymentRequest {
  const { scenario, amount, sdkConfig } = params
  const { countryCode, merchantCapabilities, supportedNetworks } = sdkConfig

  const baseRequest: ApplePayPaymentRequest = {
    countryCode,
    currencyCode: 'USD',
    merchantCapabilities,
    supportedNetworks,
    requiredBillingContactFields: ['name', 'phone', 'email', 'postalAddress'],
    requiredShippingContactFields: ['name', 'phone', 'email', 'postalAddress'],
    total: {
      label: 'Demo (Card is not charged)',
      amount,
      type: 'final',
    },
  }

  if (scenario === 'one-time-basic' || scenario === 'one-time-vault') {
    return baseRequest
  }

  // recurring-vault: add recurring payment details for UI display
  return {
    ...baseRequest,
    total: { ...baseRequest.total, type: 'recurring', paymentTiming: 'recurring' },
    lineItems: [
      {
        label: 'Recurring Subscription',
        amount,
        paymentTiming: 'recurring',
        recurringPaymentStartDate: new Date().toISOString(),
        calendarUnit: 'month',
        calendarUnitCount: 1,
      },
    ],
    recurringPaymentRequest: {
      paymentDescription: 'Monthly subscription via Apple Pay',
      regularBilling: {
        label: 'Monthly Plan',
        amount,
        calendarUnit: 'month',
        calendarUnitCount: 1,
      },
      billingAgreement: 'You authorize recurring charges until you cancel.',
      managementURL: 'https://ppgms-test.github.io',
    },
  }
}
