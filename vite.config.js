import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import fs from 'fs'

// 导航生成插件
function navGenerator() {
  return {
    name: 'nav-generator',
    buildStart() {
      console.log('[nav-generator] Building navigation data...')
    }
  }
}

// 排除以 noshow 开头的文件夹和文件
const isNoShow = (name) => name.toLowerCase().startsWith('noshow')

// 复制 pages 目录到 dist 的插件
function copyPages() {
  return {
    name: 'copy-pages',
    apply: 'build',
    writeBundle(options) {
      const pagesDir = resolve(__dirname, 'src', 'pages')
      const outDir = options.dir

      function copyDir(src, dest) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true })
        }
        const entries = fs.readdirSync(src, { withFileTypes: true })
        for (const entry of entries) {
          if (isNoShow(entry.name)) continue
          const srcPath = resolve(src, entry.name)
          const destPath = resolve(dest, entry.name)
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath)
          } else if (entry.name.endsWith('.html')) {
            fs.copyFileSync(srcPath, destPath)
            console.log(`[copy-pages] Copied: ${destPath}`)
          }
        }
      }

      console.log('[copy-pages] Copying pages to dist...')
      copyDir(pagesDir, outDir)
    }
  }
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  plugins: [
    vue(),
    navGenerator(),
    copyPages(),
    // 手动处理 src/pages 作为静态文件的中间件
    {
      name: 'serve-src-pages',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url.split('?')[0]
          // 只处理 HTML 文件请求，且排除 noshow
          if (url.includes('.html') && !isNoShow(url)) {
            const filePath = resolve(__dirname, 'src', 'pages', url)
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', 'text/html')
              res.end(fs.readFileSync(filePath))
              return
            }
          }
          next()
        })
      }
    }
  ],
  server: {
    port: 3000,
    open: false
  }
})
