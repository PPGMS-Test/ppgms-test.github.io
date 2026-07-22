// 切换凭证套时的编排入口：联动更新 active-preset / credentials / flow 三个 store。
// 单独拆文件是为了避免 credentials.ts / flow.ts 互相导入产生循环依赖。
import { getPresetById } from '@/config/credential-presets'
import { useActivePresetStore } from './active-preset'
import { useCredentialsStore } from './credentials'
import { useFlowStore } from './flow'

export function applyCredentialPreset(id: string): void {
  const preset = getPresetById(id)
  useActivePresetStore.getState().setActivePresetId(preset.id)
  useCredentialsStore.getState().applyPreset(preset)
  useFlowStore.getState().updateConfig({ payerId: preset.payerId, payeeEmail: preset.payeeEmail })
}
