import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type PayPalButtonProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  type?: 'subscribe' | string
  [key: string]: unknown
}

interface PayPalSubscriptionSession {
  start: (
    options: { presentationMode: 'auto' | 'modal' | 'popup' | 'redirect' },
    subscriptionPromise: Promise<{ subscriptionId: string }>,
  ) => Promise<void>
}

interface PayPalSdkInstance {
  createPayPalSubscriptionPaymentSession: (handlers: {
    onApprove: (data: { subscriptionId?: string }) => void | Promise<void>
    onCancel?: (data: unknown) => void
    onError?: (error: unknown) => void
  }) => PayPalSubscriptionSession
}

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: {
        clientId: string
        components: string[]
        pageType?: string
      }) => Promise<PayPalSdkInstance>
    }
  }

  namespace JSX {
    interface IntrinsicElements {
      'paypal-button': PayPalButtonProps
    }
  }
}

export {}
