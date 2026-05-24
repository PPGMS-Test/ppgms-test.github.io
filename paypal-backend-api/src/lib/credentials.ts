import {
  SANDBOX_CLIENT_ID,
  SANDBOX_CLIENT_SECRET,
  FASTLANE_DOMAIN,
  LIVE_AVMKF_CLIENT_ID,
  LIVE_AVMKF_CLIENT_SECRET,
} from './config'

export const getSandboxCredentials = () => ({
  clientId: SANDBOX_CLIENT_ID,
  clientSecret: SANDBOX_CLIENT_SECRET,
  domains: FASTLANE_DOMAIN,
})

export const getLiveAvmkfCredentials = () => ({
  clientId: LIVE_AVMKF_CLIENT_ID,
  clientSecret: LIVE_AVMKF_CLIENT_SECRET,
  domains: FASTLANE_DOMAIN,
})