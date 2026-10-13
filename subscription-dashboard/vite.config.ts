import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/__6__-API/subscription-dashboard/',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: { port: 5181, host: true, open: false },
  build: { outDir: 'dist', emptyOutDir: true },
})
