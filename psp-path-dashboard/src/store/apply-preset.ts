// 切换凭证套时的编排入口：联动更新 active-preset / credentials / flow 三个 store。
// 单独拆文件是为了保持各 store 的职责边界清晰：这里需要同时协调三个 store，
// 放进任何一个 store 自己的文件里，都会让那个 store 承担本不属于它的跨 store 编排职责。
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
