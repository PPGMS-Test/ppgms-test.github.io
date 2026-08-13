/**
 * 凭证 store：从 credentials.config 工厂初始化，管理当前选中的三方凭证与环境，
 * 并据此构造 PLB client。切换凭证会重建 client。
 */
import { create } from 'zustand'
import { createCredentialConfig, type PartnerCredential } from '@/config/credentials.config'
import { createPayPalConfig } from '@/config/paypal.config'
import { createPayPalClient, type PayPalClient } from '@/lib/api/client'

const credentialConfig = createCredentialConfig()

interface CredentialsState {
  presets: PartnerCredential[]
  selectedId: string
  credential: PartnerCredential
  client: PayPalClient
  /** 切换预设凭证并重建 client */
  select: (id: string) => void
}

function buildClient(credential: PartnerCredential): PayPalClient {
  return createPayPalClient({
    config: createPayPalConfig(credential.environment),
    credential,
  })
}

const initial = credentialConfig.default()

export const useCredentialsStore = create<CredentialsState>((set) => ({
  presets: credentialConfig.all(),
  selectedId: initial.id,
  credential: initial,
  client: buildClient(initial),
  select: (id) => {
    const credential = credentialConfig.byId(id) ?? credentialConfig.default()
    set({ selectedId: credential.id, credential, client: buildClient(credential) })
  },
}))
