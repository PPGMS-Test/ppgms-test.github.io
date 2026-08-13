// 与 paypal-backend-api 的 /api/sftp/* 交互。
// 产物在 sftp-data 分支里按 credentialId 分子目录：sftp-data/<credentialId>/{listing.json,<file>}
// 读取一律走后端 /api/sftp/file|dir（后端用 GitHub Contents API，读写强一致），
// 不再走 raw.githubusercontent.com——raw 是 CDN、与 Git 后端最终一致，同步后立刻读会因传播延迟而失败。
// raw 仅保留用于「下载 CSV」的 <a href>（用户点下载时文件早已传播，直链下载体验更好、也不占后端带宽）。
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE || 'https://ppgms-test-github-io.pages.dev'
const RAW_BASE = 'https://raw.githubusercontent.com/PPGMS-Test/ppgms-test.github.io/sftp-data/sftp-data'

export interface TriggerResult {
  requestId?: string
  error?: string
}

export async function triggerSftpSync(
  action: 'list' | 'download',
  credentialId: string,
  remotePath?: string,
): Promise<TriggerResult> {
  const res = await fetch(`${PROXY_BASE}/api/sftp/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, remotePath, credentialId }),
  })
  return (await res.json().catch(() => ({}))) as TriggerResult
}

export interface StatusResult {
  status: 'pending' | 'queued' | 'in_progress' | 'completed'
  conclusion?: 'success' | 'failure' | null
  error?: string
}

export async function getSftpSyncStatus(requestId: string): Promise<StatusResult> {
  const res = await fetch(`${PROXY_BASE}/api/sftp/status?requestId=${encodeURIComponent(requestId)}`)
  return (await res.json().catch(() => ({ status: 'pending' }))) as StatusResult
}

export interface FileEntry {
  name: string
  size: number
  modifyTime: number
}

export interface Listing {
  generatedAt: string // UTC YYYY-MM-DD
  credentialId: string
  files: FileEntry[]
}

/** 返回 UTC 的 YYYY-MM-DD，与脚本端口径一致 */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** 按文件名降序（文件名即日期，字符串降序 == 从新到旧）；返回新数组，不 mutate 入参 */
export function sortFilesByNameDesc(files: FileEntry[]): FileEntry[] {
  return [...files].sort((a, b) => b.name.localeCompare(a.name))
}

/** 「下载 CSV」直链，仅用于 <a href> 下载；读取内容请走 fetchDownloadedFile（后端强一致） */
export function rawFileUrl(credentialId: string, fileName: string): string {
  return `${RAW_BASE}/${encodeURIComponent(credentialId)}/${encodeURIComponent(fileName)}`
}

/** 拉取指定凭证的 listing.json（后端 Contents API，强一致）；404/网络失败抛错 */
export async function fetchListing(credentialId: string): Promise<Listing> {
  const res = await fetch(
    `${PROXY_BASE}/api/sftp/file?credentialId=${encodeURIComponent(credentialId)}&fileName=listing.json`,
  )
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`)
  return (await res.json()) as Listing
}

/**
 * 缓存优先的列表读取：命中「当天(UTC)」的 listing 返回 files，否则返回 null。
 * miss / 陈旧 / 网络失败 一律当作 null（调用方据此决定是否跑 action）。
 */
export async function fetchCachedListing(credentialId: string): Promise<FileEntry[] | null> {
  try {
    const listing = await fetchListing(credentialId)
    if (listing.generatedAt === todayUtc()) return listing.files
    return null
  } catch {
    return null
  }
}

/** 拉取指定凭证下某文件的原始文本内容（后端 Contents API，强一致）；404/网络失败抛错（调用方 catch 后走 action） */
export async function fetchDownloadedFile(credentialId: string, fileName: string): Promise<string> {
  const res = await fetch(
    `${PROXY_BASE}/api/sftp/file?credentialId=${encodeURIComponent(credentialId)}&fileName=${encodeURIComponent(fileName)}`,
  )
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  return res.text()
}

/**
 * 列出该凭证已下载到 sftp-data 分支的文件名集合（后端 Contents API 目录列表，强一致）。
 * 用于给「已缓存、点开即秒开」的文件标蓝点。任何失败都返回空集合（不影响列表展示）。
 */
export async function fetchCachedFileNames(credentialId: string): Promise<string[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/api/sftp/dir?credentialId=${encodeURIComponent(credentialId)}`)
    if (!res.ok) return []
    const data = (await res.json()) as { files?: string[] }
    return data.files ?? []
  } catch {
    return []
  }
}
