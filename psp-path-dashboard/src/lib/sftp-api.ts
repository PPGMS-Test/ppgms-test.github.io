// 与 paypal-backend-api 的 /api/sftp/* 交互，以及最终从 raw.githubusercontent.com 拉取产物。
// PROXY_BASE 约定跟 lib/api.ts 保持一致：默认直连已部署后端，pnpm dev:local 时可覆盖。
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

/** list 完成后拉取 listing.json（cache-busting 避免读到 CDN 缓存的旧内容） */
export async function fetchListing(): Promise<FileEntry[]> {
  const res = await fetch(`${RAW_BASE}/listing.json?t=${Date.now()}`)
  if (!res.ok) throw new Error(`Failed to fetch listing: ${res.status}`)
  const data = (await res.json()) as { files: FileEntry[] }
  return data.files
}

/** download 完成后拉取指定文件的原始文本内容 */
export async function fetchDownloadedFile(fileName: string): Promise<string> {
  const res = await fetch(`${RAW_BASE}/${encodeURIComponent(fileName)}?t=${Date.now()}`)
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`)
  return res.text()
}

export function rawFileUrl(fileName: string): string {
  return `${RAW_BASE}/${encodeURIComponent(fileName)}`
}
