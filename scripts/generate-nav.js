import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const pagesDir = path.resolve(rootDir, 'src', 'pages')

// 排除的文件夹
const EXCLUDED_DIRS = ['.git', '.vscode', 'node_modules', 'dist', '.well-known', 'css', 'js', 'scripts', 'public']

// 排除以 noshow 开头的文件夹和文件（不复制也不显示）
const isNoShow = (name) => name.toLowerCase().startsWith('noshow-')

// 排除以 hidden 开头的文件夹和文件（复制但不显示）
const isHidden = (name) => name.toLowerCase().startsWith('hidden-')

function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

// 扫描目录，返回树结构
function scanDir(dir, basePath = '') {
  const result = {
    name: path.basename(dir),
    path: basePath,
    title: path.basename(dir),
    icon: 'folder',
    children: [],   // 子文件夹
    files: []       // 直接的 HTML 文件
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // noshow- 完全排除（不复制也不显示），hidden- 只排除在导航外（复制到dist但不显示）
      if (EXCLUDED_DIRS.includes(entry.name) || isNoShow(entry.name) || isHidden(entry.name)) continue
      const childPath = basePath ? `${basePath}/${entry.name}` : entry.name
      const child = scanDir(path.join(dir, entry.name), childPath)
      // 如果子文件夹有内容才添加
      if (child.children.length > 0 || child.files.length > 0) {
        result.children.push(child)
      }
    } else if (entry.name.endsWith('.html') && !isNoShow(entry.name) && !isHidden(entry.name)) {
      const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
      result.files.push({
        name: entry.name.replace('.html', ''),
        path: normalizePath(filePath),
        title: entry.name === 'index.html' ? path.basename(basePath) : entry.name.replace('.html', ''),
        isIndex: entry.name === 'index.html'
      })
    }
  }

  // 排序
  result.children.sort((a, b) => a.title.localeCompare(b.title))
  result.files.sort((a, b) => a.title.localeCompare(b.title))

  return result
}

// 生成导航数据：panel -> group -> items
// items 可能包含直接链接或者子文件夹
function generateNavData(tree) {
  return tree.children.map(panel => {
    // panel 下的直接文件（如果没有子文件夹）
    const directFiles = panel.files.map(f => ({
      description: '',
      url: normalizePath(f.isIndex ? panel.path : f.path),
      text: f.title
    }))

    // 子文件夹变成 group
    const groups = panel.children.map(group => {
      const groupFiles = group.files.map(f => ({
        description: '',
        url: normalizePath(f.isIndex ? group.path : f.path),
        text: f.title,
        isFolder: false
      }))

      // group 的子文件夹 -> 第3层
      const subGroups = group.children.map(sub => {
        const subFiles = sub.files.map(f => ({
          description: '',
          url: normalizePath(f.isIndex ? sub.path : f.path),
          text: f.title,
          isFolder: false
        }))

        // sub 的子文件夹 -> 第4层
        const subSubGroups = sub.children.map(subsub => ({
          description: subsub.title,
          url: normalizePath(subsub.files[0]?.path || subsub.path),
          text: subsub.title,
          isFolder: true,
          children: subsub.files.map(f => ({
            description: '',
            url: normalizePath(f.isIndex ? subsub.path : f.path),
            text: f.title
          }))
        }))

        return {
          description: sub.title,
          url: normalizePath(sub.files[0]?.path || sub.path),
          text: sub.title,
          isFolder: true,
          children: subFiles,
          subGroups: subSubGroups
        }
      })

      return {
        title: group.title,
        icon: group.icon,
        items: [...groupFiles, ...subGroups]
      }
    })

    // 如果 panel 直接有文件但没有子文件夹，创建默认 group
    if (groups.length === 0 && directFiles.length > 0) {
      return {
        title: panel.title,
        icon: panel.icon,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          items: directFiles
        }]
      }
    }

    return {
      title: panel.title,
      icon: panel.icon,
      groups: groups
    }
  }).filter(col => col.groups.length > 0)
}

// 主流程
const tree = scanDir(pagesDir)
const navData = generateNavData(tree)
const outputPath = path.resolve(rootDir, 'src', 'router', 'nav-data.json')

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, JSON.stringify(navData, null, 2))
console.log(`[nav-generator] Navigation data generated: ${outputPath}`)

// 生成文件列表
const allFiles = []
function collectFiles(node) {
  for (const file of node.files) {
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

const routerOutputPath = path.resolve(rootDir, 'src', 'router', 'pages.json')
fs.writeFileSync(routerOutputPath, JSON.stringify(allFiles, null, 2))
console.log(`[nav-generator] Pages list generated: ${routerOutputPath}`)
console.log(`[nav-generator] Total files: ${allFiles.length}`)
