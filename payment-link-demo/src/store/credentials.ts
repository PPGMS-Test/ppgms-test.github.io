/**
 * 凭证 store：从 credentials.config 工厂初始化，管理当前集成角色(mode)、选中的凭证与环境，
 * 并据此构造 PLB client。切换凭证或角色都会重建 client。
 */
import { create } from 'zustand'
import {
  createCredentialConfig,
  type PartnerCredential,
  type IntegrationRole,
} from '@/config/credentials.config'
import { createPayPalConfig } from '@/config/paypal.config'
import { createPayPalClient, type PayPalClient } from '@/lib/api/client'

const credentialConfig = createCredentialConfig()

interface CredentialsState {
  presets: PartnerCredential[]
  /** 当前集成角色：first-party / third-party */
  mode: IntegrationRole
  selectedId: string
  credential: PartnerCredential
  client: PayPalClient
  /** 切换预设凭证并重建 client（mode 随之同步为该凭证的 mode） */
  select: (id: string) => void
  /** 切换集成角色，自动选中该角色下的默认凭证 */
  setMode: (mode: IntegrationRole) => void
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
  mode: initial.mode,
  selectedId: initial.id,
  credential: initial,
  client: buildClient(initial),
  select: (id) => {
    const credential = credentialConfig.byId(id) ?? credentialConfig.default()
    set({
      selectedId: credential.id,
      credential,
      mode: credential.mode,
      client: buildClient(credential),
    })
  },
  setMode: (mode) => {
    const credential = credentialConfig.defaultFor(mode)
    set({
      mode,
      selectedId: credential.id,
      credential,
      client: buildClient(credential),
    })
  },
}))
