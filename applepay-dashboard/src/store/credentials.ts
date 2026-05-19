import { create } from 'zustand'

// Sandbox defaults from the original applepay-test.html
const SANDBOX_DEFAULTS = {
  clientId: 'Adz6qoCn9-BQ0tFfWVZBl_rSTyxD0_fpk39E_u2KqT1HoYtN8HTQsSwunpx5Jynk0q8tj1nxUHS-TWlL',
  clientSecret: 'ENCbxo_xFeOFsq4uVGll5gDau005zIVG_c7AeBipt60sqbbOdA6netNgqQjd1DUacHj2QUD-4GFVqcU8',
}

interface CredentialsState {
  clientId: string
  clientSecret: string
  setClientId: (id: string) => void
  setClientSecret: (secret: string) => void
  reset: () => void
}

export const useCredentialsStore = create<CredentialsState>((set) => ({
  clientId: SANDBOX_DEFAULTS.clientId,
  clientSecret: SANDBOX_DEFAULTS.clientSecret,
  setClientId: (clientId) => set({ clientId }),
  setClientSecret: (clientSecret) => set({ clientSecret }),
  reset: () => set(SANDBOX_DEFAULTS),
}))
