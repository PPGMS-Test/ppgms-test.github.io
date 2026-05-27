import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const require = createRequire(import.meta.url)
const { version } = require('./package.json') as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    // Enables HTTPS in dev — required for Apple Pay (secure context)
    basicSsl(),
  ],
  base: '/__1__-jsv5-test/ApplePay/',
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    open: false,
    // Expose to LAN so mobile Safari can connect via https://<your-ip>:5173
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
