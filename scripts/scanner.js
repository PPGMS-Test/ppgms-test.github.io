import fs from 'fs'
import path from 'path'
import { EXCLUDED_DIRS, isNoShow, isHidden, normalizePath, readConfig } from './utils.js'

/**
 * 递归扫描指定的目录并返回树形结构的节点信息
 * 包含层级：当前目录信息、子目录(children)、当前目录下的 HTML 文件 / JSON 外部链接 (files)
 *
 * 特殊逻辑：
 * 1. 如果当前目录下存在 index.html，则其它同级的 .html 不会被加入 files 中，
 *    并且其子目录 child 会被标记为 hiddenFromNav = true (仅复制，不在导航中显示)
 * 2. 识别以 link- 开头、.json 结尾的文件，当作外部跳转链接处理
 *
 * @param {string} dir - 要扫描的本地绝对物理路径
 * @param {string} basePath - 相对根目录的相对路径，用于生成访问 URL
 * @returns {Object} 树形节点对象
 */
export function scanDir(dir, basePath = '') {
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

  // 1. 预扫描：检查当前目录是否有 index.html 文件
  const indexEntry = entries.find(e => e.isFile() && e.name === 'index.html')
  result.hasIndex = !!indexEntry

  // 2. 遍历所有文件/目录进行处理
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // 过滤掉特定排除目录、noshow-、hidden- 目录
      if (EXCLUDED_DIRS.includes(entry.name) || isNoShow(entry.name) || isHidden(entry.name)) continue

      const childPath = basePath ? `${basePath}/${entry.name}` : entry.name
      const child = scanDir(path.join(dir, entry.name), childPath)

      // 如果当前父目录有 index.html，则子文件夹在 nav 导航中隐藏（但仍会被 Vite 插件复制到 dist）
      if (result.hasIndex) {
        child.hiddenFromNav = true
      }

      // 只有非空的子目录才会被推入结果中
      if (child.children.length > 0 || child.files.length > 0 || child.hasIndex) {
        result.children.push(child)
      }
    }
    else if (entry.name.endsWith('.html') && !isNoShow(entry.name) && !isHidden(entry.name)) {
      // 如果有 index.html 且当前文件不是 index.html，则跳过（即同级只认 index.html）
      if (result.hasIndex && entry.name !== 'index.html') continue

      const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
      result.files.push({
        name: entry.name.replace('.html', ''),
        path: normalizePath(filePath),
        title: entry.name === 'index.html' ? (config?.name || name) : entry.name.replace('.html', ''),
        isIndex: entry.name === 'index.html'
      })
    }
    else if (entry.name.startsWith('link-') && entry.name.endsWith('.json') && !isNoShow(entry.name) && !isHidden(entry.name)) {
      // 解析 link-xxx.json 文件，作为外部链接处理
      const linkPath = path.join(dir, entry.name)
      try {
        const linkData = JSON.parse(fs.readFileSync(linkPath, 'utf-8'))
        const filePath = basePath ? `${basePath}/${entry.name}` : entry.name
        result.files.push({
          name: linkData.name || entry.name.replace('.json', ''),
          path: normalizePath(filePath),
          title: linkData.name || entry.name.replace('.json', ''),
          isIndex: false,
          isExternal: true,       // 标记为外部链接
          href: linkData.href     // 真实的外部跳转 URL
        })
      } catch (e) {
        console.warn(`[nav-generator] Failed to parse link file: ${linkPath}`)
      }
    }
  }

  // 3. 结果排序（按照标题的字母顺序）
  result.children.sort((a, b) => a.title.localeCompare(b.title))
  result.files.sort((a, b) => a.title.localeCompare(b.title))

  return result
}
