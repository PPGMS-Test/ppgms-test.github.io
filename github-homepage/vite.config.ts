import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const PAGE_ASSET_EXTENSIONS = new Set(['.html', '.css', '.js'])

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
}

const getExt = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

const isNoShow = (name: string) => name.toLowerCase().startsWith('noshow-')

function copyPages() {
  return {
    name: 'copy-pages',
    apply: 'build' as const,
    writeBundle(options: { dir?: string }) {
      const pagesDir = resolve(__dirname, 'src', 'pages')
      const outDir = options.dir!

      function copyDir(src: string, dest: string) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          if (isNoShow(entry.name)) continue
          const srcPath = resolve(src, entry.name)
          const destPath = resolve(dest, entry.name)
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
          } else if (PAGE_ASSET_EXTENSIONS.has(getExt(entry.name))) {
            fs.copyFileSync(srcPath, destPath)
          }
        }
      }

      copyDir(pagesDir, outDir)
    },
  }
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
  plugins: [
    react(),
    copyPages(),
    {
      // 这个插件只在 dev server 模式下生效（vite build 时不会执行）
      name: 'serve-src-pages',
      configureServer(server) {
        // 向 Vite dev server 注册一个中间件，拦截所有 HTTP 请求
        server.middlewares.use((req, res, next) => {
          // 取出请求路径，去掉 query string（如 ?t=123），并解码 URL 编码（如 %20 → 空格）
          // 例：请求 /__1__-jsv5-test/ACDC/ACDC-Sample.html?t=123 → url = /__1__-jsv5-test/ACDC/ACDC-Sample.html
          const url = decodeURIComponent((req.url ?? '').split('?')[0])

          // 取文件后缀，例：.html / .css / .js
          const ext = getExt(url)

          // 只处理 .html/.css/.js 请求，且路径不含 noshow- 前缀
          if (PAGE_ASSET_EXTENSIONS.has(ext) && !isNoShow(url)) {
            // 把 URL 路径拼到 src/pages/ 目录下，看本地有没有这个文件
            // url.replace(/^\//, '') 是去掉开头的斜杠，避免路径拼接出 src/pages//foo.html
            const filePath = resolve(__dirname, 'src', 'pages', url.replace(/^\//, ''))

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // 文件存在：设置正确的 Content-Type，然后直接返回文件内容，请求到此结束
              res.setHeader('Content-Type', MIME_BY_EXT[ext] ?? 'application/octet-stream')
              res.end(fs.readFileSync(filePath))
              return
            }
          }

          // 文件不存在，或不是我们要处理的类型 → 交给 Vite 后续流程处理
          next()
        })
      },
    },
  ],
  server: { port: 3000, open: false },
})
