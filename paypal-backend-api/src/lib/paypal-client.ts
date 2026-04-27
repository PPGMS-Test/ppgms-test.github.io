import {
  ApiError,
  Client,
  CustomError,
  Environment,
  LogLevel,
  OAuthAuthorizationController,
  OrdersController,
  VaultController,
} from '@paypal/paypal-server-sdk'
import type { OAuthProviderError } from '@paypal/paypal-server-sdk'
import { getSandboxCredentials } from './credentials'

interface ClientToken {
  accessToken: string
  expiresIn: number
  scope: string
  tokenType: string
}

type OAuthError = { error: OAuthProviderError; error_description?: string }

function buildClient(clientId: string, clientSecret: string, env: Environment) {
  return new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    timeout: 0,
    environment: env,
    logging: {
      logLevel: LogLevel.Info,
      logRequest: { logBody: true },
      logResponse: { logHeaders: true },
    },
  })
}

function buildSandboxClient() {
  const { clientId, clientSecret } = getSandboxCredentials()
  return buildClient(clientId, clientSecret, Environment.Sandbox)
}

const sandboxClient = buildSandboxClient()
export const ordersController = new OrdersController(sandboxClient)
export const oAuthController = new OAuthAuthorizationController(sandboxClient)
export const vaultController = new VaultController(sandboxClient)

async function fetchClientToken(
  oAuth: OAuthAuthorizationController,
  clientId: string,
  clientSecret: string,
  domains: string,
) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const fieldParameters: Record<string, string> = { response_type: 'client_token' }
  if (domains) fieldParameters['domains[]'] = domains

  const { result, statusCode } = await oAuth.requestToken(
    { authorization: `Basic ${auth}` },
    fieldParameters,
  )

  const { accessToken, expiresIn, scope, tokenType } = result
  const transformed: ClientToken = {
    accessToken,
    expiresIn: Number(expiresIn),
    scope: String(scope),
    tokenType,
  }
  return { jsonResponse: transformed, httpStatusCode: statusCode }
}

export async function getBrowserSafeClientToken() {
  const { clientId, clientSecret, domains } = getSandboxCredentials()
  try {
    return await fetchClientToken(oAuthController, clientId, clientSecret, domains)
  } catch (error) {
    if (error instanceof ApiError) {
      return { jsonResponse: error.result as OAuthError, httpStatusCode: error.statusCode }
    }
    throw error
  }
}

export async function getLiveBrowserSafeClientToken(clientId: string, clientSecret: string) {
  const liveClient = buildClient(clientId, clientSecret, Environment.Production)
  const liveOAuth = new OAuthAuthorizationController(liveClient)
  try {
    return await fetchClientToken(liveOAuth, clientId, clientSecret, '')
  } catch (error) {
    if (error instanceof ApiError) {
      return { jsonResponse: error.result as OAuthError, httpStatusCode: error.statusCode }
    }
    throw error
  }
}

export async function captureOrder(orderId: string) {
  try {
    const { result, statusCode } = await ordersController.captureOrder({
      id: orderId,
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

export async function getOrder(orderId: string) {
  try {
    const { result, statusCode } = await ordersController.getOrder({ id: orderId })
    return { jsonResponse: result, httpStatusCode: statusCode }
  } catch (error) {
    if (error instanceof ApiError) {
      return { jsonResponse: error.result as CustomError, httpStatusCode: error.statusCode }
    }
    throw error
  }
}
