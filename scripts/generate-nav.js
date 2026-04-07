import fs from 'fs'
import path, { resolve } from 'path'
import { fileURLToPath } from 'url'
import { normalizePath } from './utils.js'
import { scanDir } from './scanner.js'
import { generateNavData } from './formatter.js'

/**
 * 【生成导航主入口脚本】
 * 职责：
 * 1. 设置工作路径
 * 2. 调用 scanDir() 获取项目 src/pages 目录的树形结构
 * 3. 调用 generateNavData() 将目录树格式化为前端导航可用的 JSON 数据 (nav-data.json)
 * 4. 收集所有的文件路径信息，生成用于路由和文件拷贝的页面列表 (pages.json)
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const pagesDir = resolve(rootDir, 'src', 'pages')

// 1. 扫描树结构和生成导航 JSON 数据
const tree = scanDir(pagesDir)
const navData = generateNavData(tree)
const outputPath = resolve(rootDir, 'src', 'router', 'nav-data.json')

// 创建写入目录并生成文件
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(navData, null, 2))
console.log(`[nav-generator] Navigation data generated: ${outputPath}`)

/**
 * 2. 收集平铺的所有文件信息 (包含隐藏的子文件夹)，主要用于页面分发和复制
 * - 排除已作为外部链接 (isExternal: true) 的配置文件
 * @param {Object} node 目录树节点
 */
const allFiles = []
function collectFiles(node) {
  for (const file of node.files) {
    if (file.isExternal) continue  // 不把外部链接记录到实体路由和文件拷贝列表中

    allFiles.push({
      name: file.name,
      path: normalizePath(file.isIndex ? node.path : file.path),
      filePath: normalizePath(file.isIndex ? `${node.path}/index.html` : file.path)
    })
  }
  for (const child of node.children) {
    collectFiles(child)
  }
}
collectFiles(tree)

// 写入 pages.json 文件列表
const routerOutputPath = resolve(rootDir, 'src', 'router', 'pages.json')
fs.writeFileSync(routerOutputPath, JSON.stringify(allFiles, null, 2))
console.log(`[nav-generator] Pages list generated: ${routerOutputPath}`)
console.log(`[nav-generator] Total files (excluding external links): ${allFiles.length}`)
