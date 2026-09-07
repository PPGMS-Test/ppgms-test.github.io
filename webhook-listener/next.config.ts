import type { NextConfig } from 'next'
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev'

const nextConfig: NextConfig = {
  reactStrictMode: false,
}

// setupDevPlatform must be called in dev, but Next.js transpiles .ts config
// to CJS which breaks top-level await. Use .catch() to handle it silently.
if (process.env.NODE_ENV === 'development') {
  setupDevPlatform().catch(console.error)
}

export default nextConfig