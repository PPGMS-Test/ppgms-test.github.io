/**
 * 全局功能开关（可运行时切换，持久化到 localStorage）。
 *
 * imagesEnabled：是否启用 PLB 图片两步上传逻辑。默认取 IMAGES_FEATURE_DEFAULT。
 *   - 关：不生成/上传商品图，不在 line_items 里带 images，表单隐藏图片区，商品卡显示图标。
 *   - 开：启用完整两步上传（best-effort，接口不可用时跳过图片继续建 link）。
 * 详见 src/config/app.config.ts 的说明与内部 spec（HLD/LLD，feature flag ADR-IMG-016）。
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { IMAGES_FEATURE_DEFAULT } from '@/config/app.config'

interface FeatureFlagsState {
  imagesEnabled: boolean
  setImagesEnabled: (enabled: boolean) => void
  toggleImages: () => void
}

export const useFeatureFlagsStore = create<FeatureFlagsState>()(
  persist(
    (set) => ({
      imagesEnabled: IMAGES_FEATURE_DEFAULT,
      setImagesEnabled: (enabled) => set({ imagesEnabled: enabled }),
      toggleImages: () => set((s) => ({ imagesEnabled: !s.imagesEnabled })),
    }),
    { name: 'paylink-demo-flags' },
  ),
)
