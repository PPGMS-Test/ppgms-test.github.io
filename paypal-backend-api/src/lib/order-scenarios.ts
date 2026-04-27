import {
  ApiError,
  CheckoutPaymentIntent,
  CustomError,
  FulfillmentType,
  PaypalExperienceUserAction,
  PaypalWalletContextShippingPreference,
  PhoneType,
} from '@paypal/paypal-server-sdk'
import type { OrderRequest } from '@paypal/paypal-server-sdk'
import { ordersController } from './paypal-client'

export async function createOrder({
  orderRequestBody,
  paypalRequestId,
}: {
  orderRequestBody: OrderRequest
  paypalRequestId?: string
}) {
  try {
    const { result, statusCode } = await ordersController.createOrder({
      body: orderRequestBody,
      paypalRequestId,
      prefer: 'return=minimal',
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
            method: 'DHL',
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
            appSwitchContext: { launchPaypalApp: true },
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
