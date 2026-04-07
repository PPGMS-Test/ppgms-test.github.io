import fs from 'fs'
import path from 'path'

// 排除的文件夹
export const EXCLUDED_DIRS = ['.git', '.vscode', 'node_modules', 'dist', '.well-known', 'css', 'js', 'scripts', 'public']

// noshow-xxx: 不复制也不显示
export const isNoShow = (name) => name.toLowerCase().startsWith('noshow-')

// hidden-xxx: 复制但不显示
export const isHidden = (name) => name.toLowerCase().startsWith('hidden-')

/**
 * 将 Windows 下的反斜杠替换为正斜杠，以保证 URL 的跨平台一致性
 */
export function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

/**
 * 解析带有排序标记的名称，例如: "[1]-jsv5-test" -> { order: 1, cleanName: "jsv5-test" }
 * 如果没有标记，返回默认极大值以排在后面
 */
export function parseNameAndOrder(name) {
  const match = name.match(/^\[(\d+)\]-(.+)$/)
  if (match) {
    return {
      order: parseInt(match[1], 10),
      cleanName: match[2]
    }
  }
  return {
    order: 999999,
    cleanName: name
  }
}
export function readConfig(dir) {
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
