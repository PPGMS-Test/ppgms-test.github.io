// 与 paypal-backend-api 的 /api/sftp/* 交互，以及最终从 raw.githubusercontent.com 拉取产物。
// 产物在 sftp-data 分支里按 credentialId 分子目录：sftp-data/<credentialId>/{listing.json,<file>}
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

export function rawFileUrl(credentialId: string, fileName: string): string {
  return `${RAW_BASE}/${encodeURIComponent(credentialId)}/${encodeURIComponent(fileName)}`
}

/** 拉取指定凭证的 listing.json（cache-busting 避免 CDN 旧内容）；404/网络失败抛错 */
export async function fetchListing(credentialId: string): Promise<Listing> {
  const res = await fetch(`${rawFileUrl(credentialId, 'listing.json')}?t=${Date.now()}`)
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

/** 拉取指定凭证下某文件的原始文本内容；404/网络失败抛错（调用方 catch 后走 action） */
export async function fetchDownloadedFile(credentialId: string, fileName: string): Promise<string> {
  const res = await fetch(`${rawFileUrl(credentialId, fileName)}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  return res.text()
}
