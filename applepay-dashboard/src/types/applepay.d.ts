// Apple Pay Web JS API type declarations
// https://developer.apple.com/documentation/apple_pay_on_the_web

interface ApplePayLineItem {
  label: string
  amount: string | number
  type?: 'final' | 'pending'
  paymentTiming?: 'immediate' | 'recurring' | 'deferred' | 'automaticReload'
  recurringPaymentStartDate?: string | Date
  recurringPaymentEndDate?: string | Date
  recurringPaymentIntervalUnit?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
  recurringPaymentIntervalCount?: number
}

interface ApplePayRecurringPaymentRequest {
  paymentDescription: string
  regularBilling: ApplePayLineItem
  trialBilling?: ApplePayLineItem
  billingAgreement?: string
  managementURL: string
}

interface ApplePayPaymentRequest {
  countryCode: string
  currencyCode: string
  merchantCapabilities: string[]
  supportedNetworks: string[]
  total: ApplePayLineItem
  lineItems?: ApplePayLineItem[]
  requiredBillingContactFields?: string[]
  requiredShippingContactFields?: string[]
  recurringPaymentRequest?: ApplePayRecurringPaymentRequest
}

interface ApplePayContact {
  emailAddress?: string
  phoneNumber?: string
  givenName?: string
  familyName?: string
  addressLines?: string[]
  locality?: string
  postalCode?: string
  administrativeArea?: string
  country?: string
  countryCode?: string
}

interface ApplePayPaymentToken {
  paymentMethod: {
    displayName?: string
    network?: string
    type?: string
  }
  paymentData: unknown
  transactionIdentifier?: string
}

interface ApplePayPayment {
  token: ApplePayPaymentToken
  billingContact?: ApplePayContact
  shippingContact?: ApplePayContact
}

interface ApplePayValidateMerchantEvent {
  validationURL: string
}

interface ApplePayPaymentMethodSelectedEvent {
  paymentMethod: {
    displayName?: string
    network?: string
    type?: string
  }
}

interface ApplePayPaymentAuthorizedEvent {
  payment: ApplePayPayment
}

declare class ApplePaySession {
  static readonly STATUS_SUCCESS: number
  static readonly STATUS_FAILURE: number
  static supportsVersion(version: number): boolean
  static canMakePayments(): boolean

  constructor(version: number, paymentRequest: ApplePayPaymentRequest)

  onvalidatemerchant: ((event: ApplePayValidateMerchantEvent) => void) | null
  onpaymentmethodselected: ((event: ApplePayPaymentMethodSelectedEvent) => void) | null
  onpaymentauthorized: ((event: ApplePayPaymentAuthorizedEvent) => void) | null
  oncancel: (() => void) | null
  onshippingcontactselected: ((event: unknown) => void) | null

  begin(): void
  abort(): void
  completeMerchantValidation(merchantSession: unknown): void
  completePaymentMethodSelection(update: { newTotal: ApplePayLineItem }): void
  completePayment(result: { status: number }): void
}

interface PayPalApplepayConfig {
  isEligible: boolean
  countryCode: string
  currencyCode: string
  merchantCapabilities: string[]
  supportedNetworks: string[]
}

interface PayPalApplepay {
  config(): Promise<PayPalApplepayConfig>
  validateMerchant(params: { validationUrl: string }): Promise<{ merchantSession: unknown }>
  confirmOrder(params: {
    orderId: string
    token: ApplePayPaymentToken
    billingContact?: ApplePayContact
    shippingContact?: ApplePayContact
    email?: string
  }): Promise<void>
}

interface PayPalNamespace {
  Applepay(): PayPalApplepay
}

interface Window {
  ApplePaySession: typeof ApplePaySession
  paypal: PayPalNamespace
}
