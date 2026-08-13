# SFTP 倒序展示 + 当天缓存 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 SFTP 对账文件列表倒序展示,并在当天已有数据时复用缓存不再跑 GitHub Action。

**Architecture:** `sftp-data` 分支的产物从扁平根目录改为按 `credentialId` 分子目录,天然隔离不同凭证。列表缓存按天(`listing.json.generatedAt === 今天UTC`),下载缓存按存在性(日报内容不变,文件在即有效)。倒序为纯前端按文件名降序。后端与 workflow 无需改动。

**Tech Stack:** Node ESM 脚本(`ssh2-sftp-client`)+ `node:test`;前端 React 18 + Vite + Zustand + Vitest。

**参考文档:** `psp-path-dashboard/docs/superpowers/specs/2026-08-13-sftp-order-and-cache-design.md`

---

## 背景与约定(实现者必读)

- **node_modules 已就绪**:worktree 里 `node_modules` 是指向主仓库已装好依赖的符号链接(公司内网 registry 装包会卡死)。**不要跑 `pnpm install` / `npm install`**。
- **凭证 hardcode 是刻意的**:`scripts/sftp-sync/credentials.mjs` 里的沙箱用户名密码明文存放,已获用户批准(展示用 demo,仅沙箱数据),本次不动它。
- **不要 auto push**:提交到本地即可,push 由用户手动执行。
- **Commit 规范**(用户全局约定):标题 `<type>[<YYYY-MM-DD>](<sub-repo>): <中文简述>`,日期用 `date +%Y-%m-%d` 取真实值,正文按「## 解决的问题 / ## 主要改动 / ## 为什么这么改」分段。禁止 `--no-verify`。子仓库标注:脚本改动用 `(scripts/sftp-sync)`,前端用 `(psp-path-dashboard)`。
- **测试运行目录**:脚本测试在仓库根用 `node --test scripts/sftp-sync/`;前端测试在 `psp-path-dashboard/` 里用 `pnpm test`(即 `vitest run`)。

## 现状关键事实

- `scripts/sftp-sync/index.mjs`:import 时即调用 `run()`,直接连 SFTP。目前把 `listing.json` 和下载文件平铺写到 `OUTPUT_DIR` 根。
- workflow `.github/workflows/sftp-sync.yml` 用 `cp -r output/. data-branch/sftp-data/` 拷贝产物——**会保留子目录结构**,故脚本改写子目录后 workflow 无需改。
- 前端 `src/lib/sftp-api.ts`:`RAW_BASE` 指向 `.../sftp-data/sftp-data`;`fetchListing()` / `fetchDownloadedFile(fileName)` / `rawFileUrl(fileName)` 目前都不带 credentialId。
- `src/store/sftp-sync.ts`:phase 状态机 `idle→listing→browsing` / `idle→downloading→ready`,含 `setListing(files)` / `startDownloading(requestId,fileName)` / `setDownloaded(content)`。
- `src/components/SftpSyncPanel.tsx`:`handleBrowse` 无条件 `triggerSftpSync('list', activePresetId)`;`handleSelectFile` 无条件 `triggerSftpSync('download', activePresetId, fileName)`;列表直接按 `store.files` 原序渲染。
- 前端**无 `@testing-library/react`**;既有测试全是「测导出的纯函数」。故本计划把可测逻辑抽到 `sftp-api.ts`,组件层仅做接线,靠 typecheck + 手动验证。

## 文件结构规划

| 文件 | 职责 | 改动类型 |
|------|------|---------|
| `scripts/sftp-sync/index.mjs` | 抽出纯函数 `todayUtc`/`buildListingPayload`;产物写入 credential 子目录;`listing.json` 加 `generatedAt`+`credentialId`;`run()` 仅在直接执行时触发 | 修改 |
| `scripts/sftp-sync/index.test.mjs` | `node:test` 覆盖 `todayUtc`/`buildListingPayload` | 新建 |
| `psp-path-dashboard/src/lib/sftp-api.ts` | URL 带 credentialId 段;`Listing` 类型;`todayUtc`/`fetchCachedListing`/`sortFilesByNameDesc`;`fetchDownloadedFile(credentialId,fileName)` | 修改 |
| `psp-path-dashboard/src/lib/sftp-api.test.ts` | vitest 覆盖 URL 拼接、缓存新鲜度、下载、排序 | 新建 |
| `psp-path-dashboard/src/store/sftp-sync.ts` | 新增 `setDownloadedFile(fileName, content)`(缓存命中一步到 ready) | 修改 |
| `psp-path-dashboard/src/store/sftp-sync.test.ts` | vitest 覆盖 `setDownloadedFile` | 新建 |
| `psp-path-dashboard/src/components/SftpSyncPanel.tsx` | 缓存优先 browse/download、刷新按钮、降序渲染 | 修改 |

后端 `paypal-backend-api/**` 与 `.github/workflows/sftp-sync.yml`:**不改**。

---

### Task 1: 脚本层——按凭证分子目录 + listing 元数据

> **重要(依赖隔离)**:`scripts/sftp-sync/` 本地**没有** `node_modules`(`ssh2-sftp-client` 只在 CI 里 `npm install`)。所以纯函数必须放在一个**不 import `ssh2-sftp-client`** 的独立模块 `listing.mjs` 里,测试只 import 它;`index.mjs` 从 `listing.mjs` 复用。否则 `node --test` 会因 import `ssh2-sftp-client` 失败。

**Files:**
- Create: `scripts/sftp-sync/listing.mjs`
- Modify: `scripts/sftp-sync/index.mjs`
- Test: `scripts/sftp-sync/listing.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `scripts/sftp-sync/listing.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildListingPayload, todayUtc } from './listing.mjs'

test('todayUtc 返回 UTC 的 YYYY-MM-DD', () => {
  assert.equal(todayUtc(new Date('2026-08-13T23:30:00Z')), '2026-08-13')
})

test('buildListingPayload 过滤目录并附带元数据', () => {
  const entries = [
    { type: '-', name: '2026-08-11.csv', size: 10, modifyTime: 111 },
    { type: 'd', name: 'subdir', size: 0, modifyTime: 222 },
  ]
  const payload = buildListingPayload(entries, 'hkpsp', '2026-08-13')
  assert.equal(payload.generatedAt, '2026-08-13')
  assert.equal(payload.credentialId, 'hkpsp')
  assert.deepEqual(payload.files, [{ name: '2026-08-11.csv', size: 10, modifyTime: 111 }])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test scripts/sftp-sync/`
Expected: FAIL —— `listing.mjs` 不存在(import 报错)。

- [ ] **Step 3a: 新建 `listing.mjs`(纯函数,无第三方依赖)**

Create `scripts/sftp-sync/listing.mjs`:

```js
// 纯函数模块：不 import ssh2-sftp-client，便于用 node:test 在无 node_modules 环境下测试

/** 返回 UTC 的 YYYY-MM-DD */
export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

/** 从 sftp.list 结果构造 listing.json 负载：只留普通文件，附带 generatedAt/credentialId */
export function buildListingPayload(entries, credentialId, dateStr) {
  const files = entries
    .filter((e) => e.type === '-') // 只列普通文件，排除目录
    .map((e) => ({ name: e.name, size: e.size, modifyTime: e.modifyTime }))
  return { generatedAt: dateStr, credentialId, files }
}
```

- [ ] **Step 3b: 改写 `index.mjs`**

把 `scripts/sftp-sync/index.mjs` 整体替换为:

```js
import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { SFTP_CREDENTIALS } from './credentials.mjs'
import { buildListingPayload, todayUtc } from './listing.mjs'

async function run() {
  const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
  // download 模式下的目标文件名（相对于 remoteDir，与 listing.json 里的 name 一致，不是完整路径）
  const REMOTE_PATH = process.env.SFTP_REMOTE_PATH
  const OUTPUT_DIR = process.env.SFTP_OUTPUT_DIR ?? './output'
  const CREDENTIAL_ID = process.env.SFTP_CREDENTIAL_ID

  const credential = SFTP_CREDENTIALS[CREDENTIAL_ID]
  if (!credential) {
    throw new Error(`unknown SFTP_CREDENTIAL_ID: ${CREDENTIAL_ID}`)
  }
  const SFTP_CONFIG = {
    host: credential.host,
    port: credential.port,
    username: credential.username,
    password: credential.password,
    readyTimeout: credential.readyTimeout,
  }
  const SFTP_REMOTE_DIR = credential.remoteDir
  // 产物按凭证分子目录，前端缓存据此天然隔离不同凭证
  const credentialDir = `${OUTPUT_DIR}/${CREDENTIAL_ID}`
  mkdirSync(credentialDir, { recursive: true })

  const sftp = new SftpClient()
  try {
    await sftp.connect(SFTP_CONFIG)

    if (ACTION === 'list') {
      const entries = await sftp.list(SFTP_REMOTE_DIR)
      const payload = buildListingPayload(entries, CREDENTIAL_ID, todayUtc())
      writeFileSync(`${credentialDir}/listing.json`, JSON.stringify(payload, null, 2))
      console.log(`listed ${payload.files.length} files from ${SFTP_REMOTE_DIR}`)
    } else if (ACTION === 'download') {
      if (!REMOTE_PATH) throw new Error('SFTP_REMOTE_PATH is required for download action')
      const fileName = REMOTE_PATH.split('/').pop()
      const remoteFullPath = `${SFTP_REMOTE_DIR}/${REMOTE_PATH}`
      const buffer = await sftp.get(remoteFullPath)
      writeFileSync(`${credentialDir}/${fileName}`, buffer)
      console.log(`downloaded ${remoteFullPath} -> ${credentialDir}/${fileName}`)
    } else {
      throw new Error(`unknown SFTP_ACTION: ${ACTION}`)
    }
  } finally {
    await sftp.end()
  }
}

// 仅当作为脚本直接执行时才连 SFTP；被测试 import 时不触发 run()
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run().catch((err) => {
    console.error('sftp-sync failed:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test scripts/sftp-sync/`
Expected: PASS —— 2 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add scripts/sftp-sync/index.mjs scripts/sftp-sync/listing.mjs scripts/sftp-sync/listing.test.mjs
git commit -m "$(cat <<'EOF'
feat[<YYYY-MM-DD>](scripts/sftp-sync): 产物按凭证分子目录并给 listing 加当天元数据

## 解决的问题
为「按凭证隔离缓存」和「当天缓存判定」打基础：产物写入 credentialId 子目录，listing.json 增加 generatedAt/credentialId。

## 主要改动
- scripts/sftp-sync/listing.mjs: 抽出纯函数 todayUtc/buildListingPayload（不依赖 ssh2-sftp-client，便于测试）
- scripts/sftp-sync/index.mjs: 从 listing.mjs 复用纯函数；写入 output/<credentialId>/ 子目录；run() 仅在直接执行时触发
- scripts/sftp-sync/listing.test.mjs: node:test 覆盖两个纯函数

## 为什么这么改
按凭证分目录让不同凭证的产物天然隔离，前端换凭证即缓存 miss，无需在内容里比对；generatedAt 用 UTC 与前端判定口径一致。
EOF
)"
```
(把 `<YYYY-MM-DD>` 换成 `date +%Y-%m-%d` 的真实输出)

---

### Task 2: 前端 API 层——凭证命名空间 URL + 缓存判定 + 排序

**Files:**
- Modify: `psp-path-dashboard/src/lib/sftp-api.ts`
- Test: `psp-path-dashboard/src/lib/sftp-api.test.ts`

- [ ] **Step 1: 写失败测试**

Create `psp-path-dashboard/src/lib/sftp-api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  rawFileUrl,
  fetchCachedListing,
  fetchDownloadedFile,
  sortFilesByNameDesc,
  todayUtc,
  type FileEntry,
} from './sftp-api'

describe('rawFileUrl', () => {
  it('URL 带 credentialId 段', () => {
    expect(rawFileUrl('hkpsp', '2026-08-11.csv')).toBe(
      'https://raw.githubusercontent.com/PPGMS-Test/ppgms-test.github.io/sftp-data/sftp-data/hkpsp/2026-08-11.csv',
    )
  })
})

describe('sortFilesByNameDesc', () => {
  it('按文件名降序（最新日期在前），不改原数组', () => {
    const input: FileEntry[] = [
      { name: '2026-08-10.csv', size: 1, modifyTime: 1 },
      { name: '2026-08-12.csv', size: 1, modifyTime: 1 },
      { name: '2026-08-11.csv', size: 1, modifyTime: 1 },
    ]
    const out = sortFilesByNameDesc(input)
    expect(out.map((f) => f.name)).toEqual(['2026-08-12.csv', '2026-08-11.csv', '2026-08-10.csv'])
    expect(input[0].name).toBe('2026-08-10.csv') // 原数组未被 mutate
  })
})

describe('fetchCachedListing', () => {
  afterEach(() => vi.restoreAllMocks())

  it('generatedAt 是今天 → 返回 files', async () => {
    const today = todayUtc()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          generatedAt: today,
          credentialId: 'hkpsp',
          files: [{ name: 'a.csv', size: 1, modifyTime: 2 }],
        }),
      }),
    )
    expect(await fetchCachedListing('hkpsp')).toEqual([{ name: 'a.csv', size: 1, modifyTime: 2 }])
  })

  it('generatedAt 非今天 → 返回 null（陈旧）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ generatedAt: '2000-01-01', credentialId: 'hkpsp', files: [] }),
      }),
    )
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })

  it('404 → 返回 null（miss）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })

  it('网络异常 → 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })
})

describe('fetchDownloadedFile', () => {
  afterEach(() => vi.restoreAllMocks())

  it('200 → 返回文本内容', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'a,b\n1,2' }))
    expect(await fetchDownloadedFile('hkpsp', 'x.csv')).toBe('a,b\n1,2')
  })

  it('404 → 抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchDownloadedFile('hkpsp', 'x.csv')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd psp-path-dashboard && pnpm test sftp-api`
Expected: FAIL —— 新导出的 `rawFileUrl(credentialId, fileName)` 签名、`fetchCachedListing`、`sortFilesByNameDesc`、`todayUtc` 不存在。

- [ ] **Step 3: 改写 `sftp-api.ts`**

把 `psp-path-dashboard/src/lib/sftp-api.ts` 整体替换为:

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd psp-path-dashboard && pnpm test sftp-api`
Expected: PASS —— 全部用例通过。

- [ ] **Step 5: 提交**

```bash
git add psp-path-dashboard/src/lib/sftp-api.ts psp-path-dashboard/src/lib/sftp-api.test.ts
git commit -m "$(cat <<'EOF'
feat[<YYYY-MM-DD>](psp-path-dashboard): SFTP API 支持凭证命名空间 URL、当天缓存判定与降序排序

## 解决的问题
为倒序展示与当天缓存提供 API 层能力。

## 主要改动
- src/lib/sftp-api.ts: 所有 raw URL 带 credentialId 段；新增 Listing 类型、todayUtc、sortFilesByNameDesc、fetchCachedListing；fetchDownloadedFile 改为 (credentialId, fileName)
- src/lib/sftp-api.test.ts: 覆盖 URL 拼接、缓存新鲜度（今天/陈旧/404/异常）、下载、降序排序

## 为什么这么改
缓存判定与排序是纯函数，抽到 API 层可被 vitest 覆盖（本仓库无 @testing-library/react，不测组件渲染）；下载缓存按存在性（日报内容不变），列表缓存按天。
EOF
)"
```

---

### Task 3: 前端 store + 组件接线——缓存优先、刷新按钮、降序渲染

**Files:**
- Modify: `psp-path-dashboard/src/store/sftp-sync.ts`
- Modify: `psp-path-dashboard/src/components/SftpSyncPanel.tsx`
- Test: `psp-path-dashboard/src/store/sftp-sync.test.ts`

- [ ] **Step 1: 写失败测试(store)**

Create `psp-path-dashboard/src/store/sftp-sync.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSftpSyncStore } from './sftp-sync'

describe('useSftpSyncStore.setDownloadedFile', () => {
  beforeEach(() => useSftpSyncStore.getState().reset())

  it('缓存命中：一步进入 ready，带上文件名与内容，且 requestId 置空（不触发轮询）', () => {
    useSftpSyncStore.getState().setDownloadedFile('2026-08-11.csv', 'a,b\n1,2')
    const s = useSftpSyncStore.getState()
    expect(s.phase).toBe('ready')
    expect(s.downloadingFileName).toBe('2026-08-11.csv')
    expect(s.csvContent).toBe('a,b\n1,2')
    expect(s.requestId).toBeNull()
    expect(s.error).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd psp-path-dashboard && pnpm test sftp-sync`
Expected: FAIL —— `setDownloadedFile` 不存在于 store。

- [ ] **Step 3: 给 store 加 `setDownloadedFile`**

在 `psp-path-dashboard/src/store/sftp-sync.ts` 的 `SftpSyncState` 接口里,`setDownloaded` 一行后加:

```ts
  setDownloadedFile: (fileName: string, content: string) => void
```

在 `create(...)` 的实现里,`setDownloaded` 那一行后加:

```ts
  setDownloadedFile: (fileName, content) =>
    set({
      phase: 'ready',
      downloadingFileName: fileName,
      csvContent: content,
      requestId: null,
      error: null,
    }),
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd psp-path-dashboard && pnpm test sftp-sync`
Expected: PASS。

- [ ] **Step 5: 改 `SftpSyncPanel.tsx` 接线**

改动点(逐处):

(a) 更新 import 行,加入缓存/排序函数:

```tsx
import { triggerSftpSync, getSftpSyncStatus, fetchListing, fetchCachedListing, fetchDownloadedFile, sortFilesByNameDesc, rawFileUrl } from '@/lib/sftp-api'
```

(b) `listingElapsed` 轮询回调里,把 `const files = await fetchListing()` 改为带 credentialId 并取 `.files`:

```tsx
  const listingElapsed = usePolling(store.requestId, isListingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const listing = await fetchListing(activePresetId)
      store.setListing(listing.files)
    } catch {
      store.setError('拉取目录列表失败')
    }
  })
```

(c) `downloadElapsed` 轮询回调里,`fetchDownloadedFile` 加 credentialId:

```tsx
  const downloadElapsed = usePolling(store.requestId, isDownloadingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const content = await fetchDownloadedFile(activePresetId, store.downloadingFileName ?? '')
      store.setDownloaded(content)
    } catch {
      store.setError('拉取文件内容失败')
    }
  })
```

(d) `handleBrowse` 改为缓存优先,并支持强制刷新:

```tsx
  async function handleBrowse(forceRefresh = false) {
    setIsTriggering(true)
    try {
      if (!forceRefresh) {
        const cached = await fetchCachedListing(activePresetId)
        if (cached) {
          store.setListing(cached)
          return
        }
      }
      const result = await triggerSftpSync('list', activePresetId)
      if (result.requestId) {
        store.startListing(result.requestId)
      } else {
        store.setError(result.error ?? '触发同步失败')
      }
    } catch {
      store.setError('触发同步失败，请检查网络连接')
    } finally {
      setIsTriggering(false)
    }
  }
```

(e) `handleSelectFile` 改为缓存优先(先试拉缓存文件,404 才跑 action):

```tsx
  async function handleSelectFile(fileName: string) {
    setIsTriggering(true)
    try {
      try {
        const content = await fetchDownloadedFile(activePresetId, fileName)
        store.setDownloadedFile(fileName, content) // 缓存命中：一步到 ready
        return
      } catch {
        // 缓存 miss，落到下面走 download action
      }
      const result = await triggerSftpSync('download', activePresetId, fileName)
      if (result.requestId) {
        store.startDownloading(result.requestId, fileName)
      } else {
        store.setError(result.error ?? '触发同步失败')
      }
    } catch {
      store.setError('触发同步失败，请检查网络连接')
    } finally {
      setIsTriggering(false)
    }
  }
```

(f) 浏览按钮的 `onClick` 因 `handleBrowse` 现在带参数,改为箭头函数避免把事件对象当 forceRefresh 传入:

把
```tsx
          onClick={handleBrowse}
```
改为
```tsx
          onClick={() => handleBrowse()}
```

(g) `store.phase === 'browsing'` 区块:列表降序渲染,并在列表上方加「刷新」按钮。把整个 browsing 区块替换为:

```tsx
      {store.phase === 'browsing' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleBrowse(true)}
            disabled={isTriggering}
            className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw size={16} /> 刷新
          </button>
          <ul className="flex flex-col gap-2">
            {sortFilesByNameDesc(store.files).map((file) => (
              <li key={file.name}>
                <button
                  type="button"
                  onClick={() => handleSelectFile(file.name)}
                  disabled={isTriggering}
                  className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{file.name}</span>
                  <span className="font-mono text-xs text-muted">{file.size} bytes</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
```

(h) `store.phase === 'ready'` 区块里的下载链接 `rawFileUrl` 加 credentialId:

把
```tsx
            href={rawFileUrl(store.downloadingFileName ?? '')}
```
改为
```tsx
            href={rawFileUrl(activePresetId, store.downloadingFileName ?? '')}
```

(`RotateCcw` 已在原 import 里,无需新增。)

- [ ] **Step 6: typecheck + 全量测试**

Run: `cd psp-path-dashboard && pnpm build && pnpm test`
Expected: `tsc` 无类型错误,vitest 全绿(含新加的 sftp-api / sftp-sync 用例)。

- [ ] **Step 7: 提交**

```bash
git add psp-path-dashboard/src/store/sftp-sync.ts psp-path-dashboard/src/store/sftp-sync.test.ts psp-path-dashboard/src/components/SftpSyncPanel.tsx
git commit -m "$(cat <<'EOF'
feat[<YYYY-MM-DD>](psp-path-dashboard): SFTP 列表倒序展示 + 当天缓存复用 + 刷新按钮

## 解决的问题
对账文件列表改为倒序（最新在前）；当天已有数据时直接复用缓存不再跑 GitHub Action；下载过的文件再次点击秒开。

## 主要改动
- src/components/SftpSyncPanel.tsx: handleBrowse 缓存优先并支持强制刷新；handleSelectFile 先试缓存文件、miss 才跑 download；browsing 区块按文件名降序渲染并新增刷新按钮；URL 全部带 activePresetId
- src/store/sftp-sync.ts: 新增 setDownloadedFile，缓存命中一步进入 ready 且不触发轮询
- src/store/sftp-sync.test.ts: 覆盖 setDownloadedFile

## 为什么这么改
日报一天一次，缓存命中避免无谓 action（慢）；下载缓存按存在性（日报内容不变），列表缓存按当天 UTC；刷新按钮兜底当天新报表刚生成的场景。
EOF
)"
```

---

## 端到端手动验证(全部任务完成后)

在 `psp-path-dashboard` dev server 上:

1. 切到 `hkpsp` 凭证,首次点「浏览 SFTP 目录」→ 应跑 action(转圈),完成后列表**倒序**展示。
2. 收起再次「浏览」→ 应**秒开**(命中当天缓存,不转圈)。
3. 点「刷新」→ 应重新跑 action(转圈)。
4. 点某文件(当天未下过)→ 跑 download action → CSV 表格渲染 + 下载按钮可用。
5. 再点同一文件 → **秒开**(命中下载缓存)。
6. 切到另一凭证再「浏览」→ 应 miss 缓存跑 action(路径隔离生效)。

---

## Self-Review

**Spec coverage:**
- 按凭证分子目录 → Task 1(脚本写子目录)+ Task 2(URL 带 credentialId)。✓
- 功能1 倒序 → Task 2 `sortFilesByNameDesc` + Task 3 (g) 渲染。✓
- 功能2 列表按天缓存 → Task 1(`generatedAt`)+ Task 2(`fetchCachedListing`)+ Task 3 (d) `handleBrowse`。✓
- 刷新按钮 → Task 3 (d)(g)。✓
- 下载按存在性缓存 → Task 2(`fetchDownloadedFile` 抛错语义)+ Task 3 (e) + store `setDownloadedFile`。✓
- UTC 时区双端一致 → Task 1 `todayUtc` + Task 2 `todayUtc`。✓
- workflow/后端不改 → 计划明确不含,已核对 `cp -r output/.` 保留子目录。✓
- 旧扁平产物不处理 → 用户已确认「不管旧文件」,无任务。✓

**Placeholder scan:** 除 commit 里的 `<YYYY-MM-DD>`(要求用 `date` 替换,已标注),无占位。✓

**Type consistency:** `FileEntry`{name,size,modifyTime}、`Listing`{generatedAt,credentialId,files} 全程一致;`rawFileUrl(credentialId, fileName)`、`fetchDownloadedFile(credentialId, fileName)`、`fetchCachedListing(credentialId)`、`setDownloadedFile(fileName, content)` 各处签名一致。✓
