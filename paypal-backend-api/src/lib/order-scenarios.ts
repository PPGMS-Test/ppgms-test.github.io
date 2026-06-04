import {
  ApiError,
  CheckoutPaymentIntent,
  CustomError,
  FulfillmentType,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
  PhoneType,
} from '@paypal/paypal-server-sdk'
import type { OrderRequest, OrdersController } from '@paypal/paypal-server-sdk'
import { ordersController } from './paypal-client'

export async function createOrder({
  orderRequestBody,
  paypalRequestId,
  controller,
  paypalAuthAssertion,
}: {
  orderRequestBody: OrderRequest
  paypalRequestId?: string
  controller?: OrdersController
  paypalAuthAssertion?: string
}) {
  const ctrl = controller ?? ordersController
  try {
    const { result, statusCode } = await ctrl.createOrder({
      body: orderRequestBody,
      paypalRequestId,
      prefer: 'return=minimal',
      paypalAuthAssertion: paypalAuthAssertion ?? undefined,
    })
    return { jsonResponse: result, httpStatusCode: statusCode }
  } catch (error) {
    if (error instanceof ApiError) {
      return { jsonResponse: error.result as CustomError, httpStatusCode: error.statusCode }
    }
    throw error
  }
}

export function createOrderWithSampleData() {
  return createOrder({
    orderRequestBody: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [{ amount: { currencyCode: 'USD', value: '100.00' } }],
    },
  })
}

export function createOrderBCDCInline(returnUrl?: string) {
  return createOrder({
    orderRequestBody: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: {
            currencyCode: 'USD',
            value: '149.95',
            breakdown: { itemTotal: { currencyCode: 'USD', value: '149.95' } },
          },
          items: [
            {
              name: 'Test Product',
              unitAmount: { currencyCode: 'USD', value: '29.99' },
              quantity: '5',
              sku: 'test-product-1',
            },
          ],
          shipping: {
            type: FulfillmentType.Shipping,
            name: { fullName: 'John Doe' },
            address: {
              addressLine1: '1600 Amphitheatre Parkway',
              addressLine2: 'Suite 100',
              postalCode: '94043',
              adminArea2: 'Mountain View',
              countryCode: 'US',
              adminArea1: 'CA',
            },
          },
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            paymentMethodPreference: 'IMMEDIATE_PAYMENT_REQUIRED' as never,
            brandName: 'EXAMPLE INC',
            locale: 'en-US',
            landingPage: 'LOGIN' as never,
            shippingPreference: PaypalWalletContextShippingPreference.SetProvidedAddress,
            userAction: PaypalExperienceUserAction.PayNow,
            returnUrl: returnUrl ?? 'http://localhost:3001/return-url',
            cancelUrl: 'http://localhost:3001/return-url',
          },
          name: { givenName: 'John', surname: 'Doe' },
          address: {
            addressLine1: '1600 Amphitheatre Parkway',
            postalCode: '94043',
            adminArea2: 'Mountain View',
            countryCode: 'US',
            adminArea1: 'CA',
          },
          emailAddress: 'test@test.com',
          phone: {
            phoneType: PhoneType.Home,
            phoneNumber: { nationalNumber: '4085551234' },
          },
        },
      },
    },
  })
}

// REST-shape (snake_case) twin of createOrderAppSwitch — built as a plain object so the
// hand-written REST client in lib/paypal-rest.ts can POST it directly to PayPal without
// going through the SDK. Keep payload semantics aligned with createOrderAppSwitch below.
export function buildAppSwitchOrderBodyRest(returnUrl: string, cancelUrl: string): Record<string, unknown> {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        amount: {
          currency_code: 'USD',
          value: '149.95',
          breakdown: { item_total: { currency_code: 'USD', value: '149.95' } },
        },
        items: [
          {
            name: 'Test Product',
            unit_amount: { currency_code: 'USD', value: '29.99' },
            quantity: '5',
            sku: 'test-product-1',
          },
        ],
        shipping: {
          type: 'SHIPPING',
          name: { full_name: 'John Doe' },
          address: {
            address_line_1: '1600 Amphitheatre Parkway',
            address_line_2: 'Suite 100',
            postal_code: '94043',
            admin_area_2: 'Mountain View',
            country_code: 'US',
            admin_area_1: 'CA',
          },
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: 'EXAMPLE INC',
          locale: 'en-US',
          landing_page: 'LOGIN',
          shipping_preference: 'SET_PROVIDED_ADDRESS',
          user_action: 'PAY_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
          app_switch_context: {},
        },
        name: { given_name: 'John', surname: 'Doe' },
        address: {
          address_line_1: '1600 Amphitheatre Parkway',
          postal_code: '94043',
          admin_area_2: 'Mountain View',
          country_code: 'US',
          admin_area_1: 'CA',
        },
        email_address: 'test@test.com',
        phone: {
          phone_type: 'HOME',
          phone_number: { national_number: '4085551234' },
        },
      },
    },
  }
}

export function createOrderAppSwitch(returnUrl: string, cancelUrl: string) {
  return createOrder({
    orderRequestBody: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          amount: {
            currencyCode: 'USD',
            value: '149.95',
            breakdown: { itemTotal: { currencyCode: 'USD', value: '149.95' } },
          },
          items: [
            {
              name: 'Test Product',
              unitAmount: { currencyCode: 'USD', value: '29.99' },
              quantity: '5',
              sku: 'test-product-1',
            },
          ],
          shipping: {
            type: FulfillmentType.Shipping,
            name: { fullName: 'John Doe' },
            address: {
              addressLine1: '1600 Amphitheatre Parkway',
              addressLine2: 'Suite 100',
              postalCode: '94043',
              adminArea2: 'Mountain View',
              countryCode: 'US',
              adminArea1: 'CA',
            },
          },
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            paymentMethodPreference: 'IMMEDIATE_PAYMENT_REQUIRED' as never,
            brandName: 'EXAMPLE INC',
            locale: 'en-US',
            landingPage: 'LOGIN' as never,
            shippingPreference: PaypalWalletContextShippingPreference.SetProvidedAddress,
            userAction: PaypalExperienceUserAction.PayNow,
            returnUrl,
            cancelUrl,
            appSwitchContext: {},
          },
          name: { givenName: 'John', surname: 'Doe' },
          address: {
            addressLine1: '1600 Amphitheatre Parkway',
            postalCode: '94043',
            adminArea2: 'Mountain View',
            countryCode: 'US',
            adminArea1: 'CA',
          },
          emailAddress: 'test@test.com',
          phone: {
            phoneType: PhoneType.Home,
            phoneNumber: { nationalNumber: '4085551234' },
          },
        },
      },
    },
  })
}
