export const getSandboxCredentials = () => ({
  clientId: process.env.PAYPAL_SANDBOX_CLIENT_ID!,
  clientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET!,
  domains: process.env.FASTLANE_DOMAIN ?? '',
})

export const getLiveAvmkfCredentials = () => ({
  clientId: process.env.PAYPAL_LIVE_AVMKF_CLIENT_ID!,
  clientSecret: process.env.PAYPAL_LIVE_AVMKF_CLIENT_SECRET!,
  domains: process.env.FASTLANE_DOMAIN ?? '',
})
