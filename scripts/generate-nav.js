import fs from 'fs'
import path, { resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const pagesDir = resolve(rootDir, 'src', 'pages')

// 排除的文件夹
const EXCLUDED_DIRS = ['.git', '.vscode', 'node_modules', 'dist', '.well-known', 'css', 'js', 'scripts', 'public']

// noshow-xxx: 不复制也不显示
const isNoShow = (name) => name.toLowerCase().startsWith('noshow-')

// hidden-xxx: 复制但不显示
const isHidden = (name) => name.toLowerCase().startsWith('hidden-')

function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

// 读取目录下的 config.json 配置文件
function readConfig(dir) {
  const configPath = path.join(dir, 'config.json')
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    } catch (e) {
      console.warn(`[nav-generator] Failed to parse config.json in ${dir}`)
    }
  }
  return null
}

// 扫描目录，返回树结构
function scanDir(dir, basePath = '') {
  const name = path.basename(dir)
  const config = readConfig(dir)

  const result = {
    type: 'dir',
    name: name,
    path: basePath,
    title: config?.name || name,  // config.json 的 name 优先
    icon: config?.icon || 'folder',
    expanded: config?.expanded !== false,  // 默认 true (展开)，config.expanded: false 则默认折叠
    children: [],
    files: [],
    hasIndex: false
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
      // 如果当前目录有 index.html，子文件夹在 nav 中隐藏（但仍复制到 dist）
      if (result.hasIndex) {
        child.hiddenFromNav = true
      }
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
        title: entry.name === 'index.html' ? (config?.name || name) : entry.name.replace('.html', ''),
        isIndex: entry.name === 'index.html'
      })
    } else if (entry.name.startsWith('link-') && entry.name.endsWith('.json') && !isNoShow(entry.name) && !isHidden(entry.name)) {
      // link-xxx.json 文件作为外部链接处理
      const linkPath = path.join(dir, entry.name)
      try {
        const linkData = JSON.parse(fs.readFileSync(linkPath, 'utf-8'))
        const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
        result.files.push({
          name: linkData.name || entry.name.replace('.json', ''),
          path: normalizePath(filePath),
          title: linkData.name || entry.name.replace('.json', ''),
          isIndex: false,
          isExternal: true,
          href: linkData.href
        })
      } catch (e) {
        console.warn(`[nav-generator] Failed to parse link file: ${linkPath}`)
      }
    }
  }

  // 排序
  result.children.sort((a, b) => a.title.localeCompare(b.title))
  result.files.sort((a, b) => a.title.localeCompare(b.title))

  return result
}

// 生成导航数据
function generateNavData(tree) {
  return tree.children.map(panel => {
    const directFiles = panel.files.map(f => ({
      description: '',
      url: f.isExternal ? f.href : normalizePath(f.path),
      text: f.title,
      isFolder: false,
      hasChildren: false,
      isExternal: f.isExternal || false
    }))

    // 过滤掉 hiddenFromNav 的子文件夹（父级有 index.html）
    const visibleGroups = panel.children.filter(g => !g.hiddenFromNav)
    const groups = visibleGroups.map(group => {
      const groupFiles = group.files.map(f => ({
        description: '',
        url: f.isExternal ? f.href : normalizePath(f.path),
        text: f.title,
        isFolder: false,
        hasChildren: false,
        isExternal: f.isExternal || false
      }))

      const subGroups = group.children
        .filter(sub => !sub.hiddenFromNav)
        .map(sub => {
        const subFiles = sub.files.map(f => ({
          description: '',
          url: f.isExternal ? f.href : normalizePath(f.path),
          text: f.title,
          isFolder: false,
          hasChildren: false,
          isExternal: f.isExternal || false
        }))

        const subSubGroups = sub.children
        .filter(subsub => !subsub.hiddenFromNav)
        .map(subsub => {
          const subsubFiles = subsub.files.map(f => ({
            description: '',
            url: f.isExternal ? f.href : normalizePath(f.path),
            text: f.title,
            isFolder: false,
            hasChildren: false,
            isExternal: f.isExternal || false
          }))

          return {
            description: subsub.title,
            url: normalizePath(subsub.files[0]?.path || subsub.path),
            text: subsub.title,
            isFolder: true,
            expanded: subsub.expanded,
            hasChildren: subsub.children.length > 0 || subsub.files.length > 0,
            children: subsubFiles,
            subGroups: subsub.children.map(g => ({
              description: g.title,
              url: normalizePath(g.files[0]?.path || g.path),
              text: g.title,
              isFolder: true,
              expanded: g.expanded,
              hasChildren: g.children.length > 0 || g.files.length > 0,
              children: g.files.map(f => ({
                description: '',
                url: f.isExternal ? f.href : normalizePath(f.path),
                text: f.title,
                isFolder: false,
                hasChildren: false,
                isExternal: f.isExternal || false
              }))
            }))
          }
        })

        return {
          description: sub.title,
          url: normalizePath(sub.files[0]?.path || sub.path),
          text: sub.title,
          isFolder: true,
          expanded: sub.expanded,
          hasChildren: sub.children.length > 0 || sub.files.length > 0,
          children: subFiles,
          subGroups: subSubGroups
        }
      })

      return {
        title: group.title,
        icon: group.icon,
        expanded: group.expanded,
        items: [...groupFiles, ...subGroups]
      }
    })

    if (groups.length === 0 && directFiles.length > 0) {
      return {
        title: panel.title,
        icon: panel.icon,
        expanded: panel.expanded,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          expanded: panel.expanded,
          items: directFiles
        }]
      }
    }

    if (directFiles.length > 0 && groups.length > 0) {
      return {
        title: panel.title,
        icon: panel.icon,
        expanded: panel.expanded,
        groups: [{
          title: panel.title,
          icon: panel.icon,
          expanded: panel.expanded,
          items: directFiles
        }, ...groups]
      }
    }

    return {
      title: panel.title,
      icon: panel.icon,
      expanded: panel.expanded,
      groups: groups
    }
  }).filter(col => col.groups.length > 0)
}

// 主流程
const tree = scanDir(pagesDir)
const navData = generateNavData(tree)
const outputPath = resolve(rootDir, 'src', 'router', 'nav-data.json')

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

const routerOutputPath = resolve(rootDir, 'src', 'router', 'pages.json')
fs.writeFileSync(routerOutputPath, JSON.stringify(allFiles, null, 2))
console.log(`[nav-generator] Pages list generated: ${routerOutputPath}`)
console.log(`[nav-generator] Total files: ${allFiles.length}`)
