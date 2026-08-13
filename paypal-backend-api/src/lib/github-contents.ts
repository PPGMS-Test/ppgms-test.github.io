// 通过 GitHub Contents API 读取 sftp-data 分支里的同步产物。
// 为什么不直接用 raw.githubusercontent.com：raw 走 Fastly CDN，与 Git 后端是「最终一致」的——
// workflow 刚 push 完，raw 需要一个传播窗口（几秒到几十秒）才能读到新内容，期间 404 或读到旧数据，
// 这正是「第一次同步后立刻读取失败、隔几秒重试才成功」的根因。Contents API 直接读 Git 数据库，
// push 完即可读（读写强一致），从根上消除该传播延迟。
const GITHUB_OWNER = 'PPGMS-Test'
const GITHUB_REPO = 'ppgms-test.github.io'
const DATA_BRANCH = 'sftp-data'
// 产物在 sftp-data 分支里的仓库路径前缀：sftp-data/<credentialId>/<fileName>
const REPO_DIR = 'sftp-data'
const CONTENTS_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`
const REQUEST_TIMEOUT_MS = 20_000

// 单段路径白名单：字母数字与 . _ - ，且不是 . / .. 。用于防止路径穿越与多段注入。
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/
export function isSafeSegment(segment: string): boolean {
  return segment !== '.' && segment !== '..' && SAFE_SEGMENT.test(segment)
}

export type BranchFileResult = { ok: true; content: string } | { ok: false; status: number }

/** 读取 sftp-data/<credentialId>/<fileName> 的原始文本；404 等非 2xx 用 ok:false + status 表达 */
export async function fetchBranchFile(
  pat: string,
  credentialId: string,
  fileName: string,
): Promise<BranchFileResult> {
  const path = `${REPO_DIR}/${credentialId}/${fileName}`
  const res = await fetch(`${CONTENTS_BASE}/${path}?ref=${DATA_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      // raw 媒体类型直接返回文件字节（而非 base64 JSON），支持 <=100MB，对账 CSV 绰绰有余
      Accept: 'application/vnd.github.raw',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, content: await res.text() }
}

interface ContentsEntry {
  name: string
  type: string
}

/**
 * 列出 sftp-data/<credentialId>/ 目录下已下载的文件名（排除 listing.json）。
 * 用于前端给「已缓存、可秒开」的文件标蓝点。目录尚不存在(404) → 返回空数组。
 */
export async function listBranchDir(pat: string, credentialId: string): Promise<string[]> {
  const path = `${REPO_DIR}/${credentialId}`
  const res = await fetch(`${CONTENTS_BASE}/${path}?ref=${DATA_BRANCH}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Failed to list branch dir: ${res.status}`)
  const data = (await res.json()) as ContentsEntry[]
  return data
    .filter((e) => e.type === 'file' && e.name !== 'listing.json')
    .map((e) => e.name)
}
