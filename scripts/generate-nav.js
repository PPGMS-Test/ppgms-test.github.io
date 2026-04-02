import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const pagesDir = path.resolve(rootDir, 'src', 'pages')

// 排除的文件夹
const EXCLUDED_DIRS = ['.git', '.vscode', 'node_modules', 'dist', '.well-known', 'css', 'js', 'scripts', 'public']

// noshow-xxx: 不复制也不显示
const isNoShow = (name) => name.toLowerCase().startsWith('noshow-')

// hidden-xxx: 复制但不显示
const isHidden = (name) => name.toLowerCase().startsWith('hidden-')

function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

// 扫描目录，返回树结构
// 每个节点: { type: 'dir'|'file', name, path, title, icon, children: [], files: [], hasIndex: bool }
function scanDir(dir, basePath = '') {
  const name = path.basename(dir)
  const result = {
    type: 'dir',
    name: name,
    path: basePath,
    title: name,
    icon: 'folder',
    children: [],   // 子文件夹
    files: [],       // 直接的 HTML 文件
    hasIndex: false  // 是否有 index.html
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true })

  // 先检查是否有 index.html
  const indexEntry = entries.find(e => e.isFile() && e.name === 'index.html')
  result.hasIndex = !!indexEntry

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.includes(entry.name) || isNoShow(entry.name) || isHidden(entry.name)) continue
      const childPath = basePath ? `${basePath}/${entry.name}` : entry.name
      const child = scanDir(path.join(dir, entry.name), childPath)
      if (child.children.length > 0 || child.files.length > 0 || child.hasIndex) {
        result.children.push(child)
      }
    } else if (entry.name.endsWith('.html') && !isNoShow(entry.name) && !isHidden(entry.name)) {
      // 如果有 index.html，其他 html 文件不显示
      if (result.hasIndex && entry.name !== 'index.html') continue
      const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
      result.files.push({
        name: entry.name.replace('.html', ''),
        path: normalizePath(filePath),
        title: entry.name === 'index.html' ? name : entry.name.replace('.html', ''),
        isIndex: entry.name === 'index.html'
      })
    }
  }

  // 排序
  result.children.sort((a, b) => a.title.localeCompare(b.title))
  result.files.sort((a, b) => a.title.localeCompare(b.title))

  return result
}

// 生成导航数据
// 结构: panel -> groups -> items (可折叠)
// 如果 panel 有直接文件，创建一个默认 group
function generateNavData(tree) {
  return tree.children.map(panel => {
    // panel 下的直接文件（如果有的话）
    const directFiles = panel.files.map(f => ({
      description: '',
      url: normalizePath(f.isIndex ? panel.path : f.path),
      text: f.title,
      isFolder: false,
      hasChildren: false
    }))

    // 子文件夹变成 group
    const groups = panel.children.map(group => {
      // group 下的直接文件
      const groupFiles = group.files.map(f => ({
        description: '',
        url: normalizePath(f.isIndex ? group.path : f.path),
        text: f.title,
        isFolder: false,
        hasChildren: false
      }))

      // group 的子文件夹 -> 第3层
      const subGroups = group.children.map(sub => {
        // sub 下的直接文件
        const subFiles = sub.files.map(f => ({
          description: '',
          url: normalizePath(f.isIndex ? sub.path : f.path),
          text: f.title,
          isFolder: false,
          hasChildren: false
        }))

        // sub 的子文件夹 -> 第4层
        const subSubGroups = sub.children.map(subsub => {
          const subsubFiles = subsub.files.map(f => ({
            description: '',
            url: normalizePath(f.isIndex ? subsub.path : f.path),
            text: f.title,
            isFolder: false,
            hasChildren: false
          }))

          return {
            description: subsub.title,
            url: normalizePath(subsub.files[0]?.path || subsub.path),
            text: subsub.title,
            isFolder: true,
            hasChildren: subsub.children.length > 0 || subsub.files.length > 0,
            children: subsubFiles,
            subGroups: subsub.children.map(g => ({
              description: g.title,
              url: normalizePath(g.files[0]?.path || g.path),
              text: g.title,
              isFolder: true,
              hasChildren: g.children.length > 0 || g.files.length > 0,
              children: g.files.map(f => ({
                description: '',
                url: normalizePath(f.isIndex ? g.path : f.path),
                text: f.title,
                isFolder: false,
                hasChildren: false
              }))
            }))
          }
        })

        return {
          description: sub.title,
          url: normalizePath(sub.files[0]?.path || sub.path),
          text: sub.title,
          isFolder: true,
          hasChildren: sub.children.length > 0 || sub.files.length > 0,
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

    // 如果 panel 同时有直接文件和子文件夹，都显示
    if (directFiles.length > 0 && groups.length > 0) {
      // 直接文件作为第一个 group
      return {
        title: panel.title,
        icon: panel.icon,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          items: directFiles
        }, ...groups]
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

// 生成文件列表（排除 noshow 和 hidden）
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
