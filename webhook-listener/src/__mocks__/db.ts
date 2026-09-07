// Mock for @/lib/db — avoids importing @cloudflare/next-on-pages in vitest
export const getDB = () => {
  throw new Error('getDB should be mocked in tests')
}