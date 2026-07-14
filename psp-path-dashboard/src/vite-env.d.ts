/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 覆盖 api.ts 默认的远端 paypal-backend-api 地址；本地联调时用 `pnpm dev:local` 或 .env.local 设置 */
  readonly VITE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
