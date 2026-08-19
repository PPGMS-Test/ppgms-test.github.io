import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  // 部署到 github-homepage 的 API panel 下：https://ppgms-test.github.io/__6__-API/payment-link-demo/
  // 与 applepay/bopis/psp-path-dashboard 一致，deploy workflow 会把 dist 合并到该路径。
  base: '/__6__-API/payment-link-demo/',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5174, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
