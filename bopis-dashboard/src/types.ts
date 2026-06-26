export type StepStatus = 'idle' | 'loading' | 'success' | 'error'

export interface StepResult {
  status: StepStatus
  response?: unknown
  error?: string
  debugId?: string
}

export interface StoreAddress {
  address_line_1: string
  admin_area_2: string
  admin_area_1: string
  postal_code: string
  country_code: string
}

export interface PayPalPaymentSession {
  start(
    opts: { presentationMode: 'auto' | 'popup' | 'modal' | 'direct-app-switch' },
    createOrderPromise: Promise<{ orderId: string }>,
  ): Promise<void>
  hasReturned(): boolean
  resume(): Promise<void>
}

export interface PayPalSDKInstance {
  createPayPalOneTimePaymentSession(opts: {
    onApprove: (data: { orderId: string }) => Promise<void>
    onCancel?: (data: unknown) => void
    onError?: (error: Error) => void
  }): PayPalPaymentSession
}

declare global {
  interface Window {
    paypal?: {
      createInstance(opts: {
        clientToken: string
        components: string[]
        pageType: string
      }): Promise<PayPalSDKInstance>
    }
  }
  namespace JSX {
    interface IntrinsicElements {
      'paypal-button': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & { type?: string }
    }
  }
}
