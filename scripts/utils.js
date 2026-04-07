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
 * 读取目录下的 config.json 配置文件
 * 可以用于配置该目录在导航中的名称(name)、图标(icon)和是否默认展开(expanded)
 */
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
