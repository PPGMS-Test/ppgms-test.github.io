# SFTP 多凭证支持 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 SFTP 同步页面根据当前全局选中的 `activePresetId` 自动使用对应的 SFTP 凭证，支持多套账号（`hkpsp` / `yuncong-hk-psp1`），未配置 SFTP 的凭证给出前端提示。

**Architecture:** 新增 `credentialId` 字段贯穿 前端 `SftpSyncPanel` → `lib/sftp-api.ts` → `paypal-backend-api` 的 `/api/sftp/trigger` → `dispatchSftpWorkflow` → GitHub Actions `workflow_dispatch` input `credential_id` → `scripts/sftp-sync/index.mjs` 按 id 查 `credentials.mjs` 里的凭证表。

**Tech Stack:** 与既有 SFTP 同步功能一致（Node.js 脚本 + GitHub Actions + Next.js Edge Route + React/Zustand）。

**参考设计文档：** `psp-path-dashboard/docs/2026-08-12-sftp-multi-credential-design.md`

---

### Task 1: 脚本层——多凭证表 `credentials.mjs` + `index.mjs` 按 id 查表

**Files:**
- Create: `scripts/sftp-sync/credentials.mjs`
- Modify: `scripts/sftp-sync/index.mjs`
- Delete: `scripts/sftp-sync/config.mjs`

- [ ] **Step 1: 创建 `scripts/sftp-sync/credentials.mjs`**

```js
// SFTP 连接参数硬编码在源码中——本项目是展示用 demo，对账数据为 sandbox 测试数据，
// 用户已确认接受此简化（详见 docs/2026-08-11-sftp-reconciliation-sync-design.md）。
//
// key 必须跟 psp-path-dashboard/src/config/credential-presets.ts 里 CredentialPreset.id 一致，
// 前端按 activePresetId 传下来的字符串在这里查表。

export const SFTP_CREDENTIALS = {
  hkpsp: {
    host: 'reports.sandbox.paypal.com',
    port: 22,
    username: 'sftpw7_HKPSPPP.com',
    password: 'Filma132800@',
    readyTimeout: 15000,
    remoteDir: '/ppreports/outgoing',
  },
  'yuncong-hk-psp1': {
    host: 'reports.sandbox.paypal.com',
    port: 22,
    username: 'sftpjg_psp-test-hk02test.com',
    password: 'Pp@test1357',
    readyTimeout: 15000,
    remoteDir: '/ppreports/outgoing',
  },
}
```

- [ ] **Step 2: 修改 `scripts/sftp-sync/index.mjs`，按 `SFTP_CREDENTIAL_ID` 查表**

把文件开头的 import 和常量部分：

```js
import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { SFTP_CONFIG, SFTP_REMOTE_DIR } from './config.mjs'

const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
const REMOTE_PATH = process.env.SFTP_REMOTE_PATH // download 模式下的目标文件名（相对于 SFTP_REMOTE_DIR，与 list 模式返回的 listing.json 里的 name 字段一致，不是完整路径）
const OUTPUT_DIR = process.env.SFTP_OUTPUT_DIR ?? './output'
```

替换为：

```js
import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { SFTP_CREDENTIALS } from './credentials.mjs'

const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
const REMOTE_PATH = process.env.SFTP_REMOTE_PATH // download 模式下的目标文件名（相对于 SFTP_REMOTE_DIR，与 list 模式返回的 listing.json 里的 name 字段一致，不是完整路径）
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
```

其余 `run()` 函数（`list`/`download` 分支）逻辑保持不变，无需修改。

- [ ] **Step 3: 删除旧的 `scripts/sftp-sync/config.mjs`**

```bash
git rm scripts/sftp-sync/config.mjs
```

- [ ] **Step 4: 手动验证脚本能正确报错（无网络也能验证这一步的查表逻辑）**

Run: `cd scripts/sftp-sync && SFTP_ACTION=list SFTP_CREDENTIAL_ID=not-exist node index.mjs`
Expected: 抛出 `Error: unknown SFTP_CREDENTIAL_ID: not-exist` 并以非零状态码退出（真正连接 SFTP 的验证留到 Task 7 端到端手动验证）。

- [ ] **Step 5: Commit**

```bash
git add scripts/sftp-sync/credentials.mjs scripts/sftp-sync/index.mjs scripts/sftp-sync/config.mjs
git commit -m "feat[2026-08-12](scripts/sftp-sync): 支持按 credential id 查表选择 SFTP 账号"
```

---

### Task 2: GitHub Actions workflow 新增 `credential_id` input

**Files:**
- Modify: `.github/workflows/sftp-sync.yml`

- [ ] **Step 1: 在 `workflow_dispatch.inputs` 新增 `credential_id`**

把：

```yaml
  workflow_dispatch:
    inputs:
      action:
        description: 'list or download'
        required: true
        type: choice
        options: [list, download]
      remote_path:
        description: 'File name within the configured SFTP_REMOTE_DIR (required for download, e.g. "2026-08-11.csv")'
        required: false
        type: string
      client_request_id:
        description: 'Unique id supplied by the caller, used to correlate polling'
        required: true
        type: string
```

替换为：

```yaml
  workflow_dispatch:
    inputs:
      action:
        description: 'list or download'
        required: true
        type: choice
        options: [list, download]
      remote_path:
        description: 'File name within the configured SFTP_REMOTE_DIR (required for download, e.g. "2026-08-11.csv")'
        required: false
        type: string
      credential_id:
        description: 'Credential preset id, must match a key in scripts/sftp-sync/credentials.mjs (e.g. "hkpsp")'
        required: true
        type: string
      client_request_id:
        description: 'Unique id supplied by the caller, used to correlate polling'
        required: true
        type: string
```

- [ ] **Step 2: 在 "Run SFTP sync" 步骤的 `env` 里新增 `SFTP_CREDENTIAL_ID`**

把：

```yaml
      - name: Run SFTP sync
        working-directory: source/scripts/sftp-sync
        env:
          SFTP_ACTION: ${{ inputs.action }}
          SFTP_REMOTE_PATH: ${{ inputs.remote_path }}
          SFTP_OUTPUT_DIR: ${{ github.workspace }}/output
        run: node index.mjs
```

替换为：

```yaml
      - name: Run SFTP sync
        working-directory: source/scripts/sftp-sync
        env:
          SFTP_ACTION: ${{ inputs.action }}
          SFTP_REMOTE_PATH: ${{ inputs.remote_path }}
          SFTP_CREDENTIAL_ID: ${{ inputs.credential_id }}
          SFTP_OUTPUT_DIR: ${{ github.workspace }}/output
        run: node index.mjs
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/sftp-sync.yml
git commit -m "feat[2026-08-12](workflow): SFTP Sync workflow 新增 credential_id 输入"
```

---

### Task 3: 后端 `dispatchSftpWorkflow` 新增 `credentialId` 参数

**Files:**
- Modify: `paypal-backend-api/src/lib/github-actions.ts`
- Modify: `paypal-backend-api/src/lib/github-actions.test.ts`

- [ ] **Step 1: 更新已有测试，断言 `inputs.credential_id`**

把 `paypal-backend-api/src/lib/github-actions.test.ts` 里第一个测试：

```ts
  it('POST 到 dispatches 端点，带 action/remote_path/client_request_id', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', clientRequestId: 'req-1' })

    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/dispatches',
    )
    const options = init as RequestInit
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test')
    const body = JSON.parse(options.body as string)
    expect(body.ref).toBe('master')
    expect(body.inputs).toEqual({ action: 'list', remote_path: '', client_request_id: 'req-1' })
  })
```

替换为：

```ts
  it('POST 到 dispatches 端点，带 action/remote_path/credential_id/client_request_id', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-1' })

    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/dispatches',
    )
    const options = init as RequestInit
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test')
    const body = JSON.parse(options.body as string)
    expect(body.ref).toBe('master')
    expect(body.inputs).toEqual({
      action: 'list',
      remote_path: '',
      credential_id: 'hkpsp',
      client_request_id: 'req-1',
    })
  })
```

其余测试（download 模式、非 2xx 抛错、`findRunByName` 相关）不受影响，`dispatchSftpWorkflow` 调用处补上 `credentialId: 'hkpsp'` 即可：

```ts
  it('download 模式带 remote_path', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({
      pat: 'ghp_test',
      action: 'download',
      remotePath: '/recon/2026-08-11.csv',
      credentialId: 'hkpsp',
      clientRequestId: 'req-2',
    })
    const [, init] = spy.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.inputs.remote_path).toBe('/recon/2026-08-11.csv')
  })

  it('GitHub API 返回非 2xx 时抛错', async () => {
    mockFetchOnce(422, { message: 'bad request' })
    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-3' }),
    ).rejects.toThrow('Failed to dispatch workflow: 422')
  })
```

- [ ] **Step 2: 运行测试，确认因类型不匹配 / 缺少字段而失败**

Run: `cd paypal-backend-api && npx vitest run src/lib/github-actions.test.ts`
Expected: FAIL（`credentialId` 不在 `DispatchParams` 类型里，或 `inputs` 断言不匹配）

- [ ] **Step 3: 修改 `paypal-backend-api/src/lib/github-actions.ts`**

把：

```ts
interface DispatchParams {
  pat: string
  action: 'list' | 'download'
  remotePath?: string
  clientRequestId: string
}

export async function dispatchSftpWorkflow({ pat, action, remotePath, clientRequestId }: DispatchParams): Promise<void> {
  const res = await fetch(`${API_BASE}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'master',
      inputs: {
        action,
        remote_path: remotePath ?? '',
        client_request_id: clientRequestId,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Failed to dispatch workflow: ${res.status}`)
  }
}
```

替换为：

```ts
interface DispatchParams {
  pat: string
  action: 'list' | 'download'
  remotePath?: string
  credentialId: string
  clientRequestId: string
}

export async function dispatchSftpWorkflow({
  pat,
  action,
  remotePath,
  credentialId,
  clientRequestId,
}: DispatchParams): Promise<void> {
  const res = await fetch(`${API_BASE}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'master',
      inputs: {
        action,
        remote_path: remotePath ?? '',
        credential_id: credentialId,
        client_request_id: clientRequestId,
      },
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Failed to dispatch workflow: ${res.status}`)
  }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd paypal-backend-api && npx vitest run src/lib/github-actions.test.ts`
Expected: PASS（5 个测试全部通过）

- [ ] **Step 5: Commit**

```bash
git add paypal-backend-api/src/lib/github-actions.ts paypal-backend-api/src/lib/github-actions.test.ts
git commit -m "feat[2026-08-12](paypal-backend-api): dispatchSftpWorkflow 新增 credentialId 参数"
```

---

### Task 4: 后端路由 `/api/sftp/trigger` 解析并转发 `credentialId`

**Files:**
- Modify: `paypal-backend-api/src/app/api/sftp/trigger/route.ts`

无自动化测试框架覆盖这个 route 文件（现状如此，遵循既有模式），本任务只做实现 + 手动验证。

- [ ] **Step 1: 修改 `paypal-backend-api/src/app/api/sftp/trigger/route.ts`**

把：

```ts
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; remotePath?: string }
  const { action, remotePath } = body

  if (action !== 'list' && action !== 'download') {
    return corsJson({ error: 'action must be "list" or "download"' }, 400)
  }
  if (action === 'download' && !remotePath) {
    return corsJson({ error: 'remotePath is required for download action' }, 400)
  }
  if (action === 'download' && remotePath!.split('/').includes('..')) {
    return corsJson({ error: 'remotePath must not contain ".." path segments' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  const clientRequestId = crypto.randomUUID()

  try {
    await dispatchSftpWorkflow({ pat, action, remotePath, clientRequestId })
    return corsJson({ requestId: clientRequestId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger sftp sync'
    return corsJson({ error: message }, 502)
  }
}
```

替换为：

```ts
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string
    remotePath?: string
    credentialId?: string
  }
  const { action, remotePath, credentialId } = body

  if (action !== 'list' && action !== 'download') {
    return corsJson({ error: 'action must be "list" or "download"' }, 400)
  }
  if (action === 'download' && !remotePath) {
    return corsJson({ error: 'remotePath is required for download action' }, 400)
  }
  if (action === 'download' && remotePath!.split('/').includes('..')) {
    return corsJson({ error: 'remotePath must not contain ".." path segments' }, 400)
  }
  if (!credentialId) {
    return corsJson({ error: 'credentialId is required' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  const clientRequestId = crypto.randomUUID()

  try {
    await dispatchSftpWorkflow({ pat, action, remotePath, credentialId, clientRequestId })
    return corsJson({ requestId: clientRequestId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to trigger sftp sync'
    return corsJson({ error: message }, 502)
  }
}
```

- [ ] **Step 2: 本地手动验证类型检查通过**

Run: `cd paypal-backend-api && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 3: Commit**

```bash
git add paypal-backend-api/src/app/api/sftp/trigger/route.ts
git commit -m "feat[2026-08-12](paypal-backend-api): /api/sftp/trigger 校验并转发 credentialId"
```

---

### Task 5: 前端 `lib/sftp-api.ts` 的 `triggerSftpSync` 新增 `credentialId` 参数

**Files:**
- Modify: `psp-path-dashboard/src/lib/sftp-api.ts`

- [ ] **Step 1: 修改 `triggerSftpSync` 签名与请求体**

把：

```ts
export async function triggerSftpSync(action: 'list' | 'download', remotePath?: string): Promise<TriggerResult> {
  const res = await fetch(`${PROXY_BASE}/api/sftp/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, remotePath }),
  })
  return (await res.json().catch(() => ({}))) as TriggerResult
}
```

替换为：

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add psp-path-dashboard/src/lib/sftp-api.ts
git commit -m "feat[2026-08-12](psp-path-dashboard): triggerSftpSync 新增 credentialId 参数"
```

（这一步会让 `SftpSyncPanel.tsx` 里现有的两处调用出现 TypeScript 类型错误——这是预期的，Task 6 会修复调用处。）

---

### Task 6: 前端 `SftpSyncPanel` 联动 `activePresetId` + 未配置 SFTP 时的提示

**Files:**
- Modify: `psp-path-dashboard/src/components/SftpSyncPanel.tsx`

- [ ] **Step 1: 新增 import，读取当前 preset**

把文件顶部的 import：

```tsx
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, RotateCcw, AlertCircle } from 'lucide-react'
import { useSftpSyncStore } from '@/store/sftp-sync'
import { triggerSftpSync, getSftpSyncStatus, fetchListing, fetchDownloadedFile, rawFileUrl } from '@/lib/sftp-api'
import { parseCsv } from '@/lib/csv-parse'
import { cn } from '@/lib/utils'
```

替换为：

```tsx
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, RotateCcw, AlertCircle } from 'lucide-react'
import { useSftpSyncStore } from '@/store/sftp-sync'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById } from '@/config/credential-presets'
import { triggerSftpSync, getSftpSyncStatus, fetchListing, fetchDownloadedFile, rawFileUrl } from '@/lib/sftp-api'
import { parseCsv } from '@/lib/csv-parse'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: 在 `SftpSyncPanel` 函数体内读取 `activePreset`**

把：

```tsx
export function SftpSyncPanel() {
  const store = useSftpSyncStore()
  const isListingPolling = store.phase === 'listing'
  const isDownloadingPolling = store.phase === 'downloading'
  const [isTriggering, setIsTriggering] = useState(false)
```

替换为：

```tsx
export function SftpSyncPanel() {
  const store = useSftpSyncStore()
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const activePreset = getPresetById(activePresetId)
  const sftpUser = activePreset.loginInfo?.sftpUser
  const isListingPolling = store.phase === 'listing'
  const isDownloadingPolling = store.phase === 'downloading'
  const [isTriggering, setIsTriggering] = useState(false)
```

- [ ] **Step 3: `handleBrowse`/`handleSelectFile` 传入 `activePresetId` 作为 `credentialId`**

把：

```tsx
  async function handleBrowse() {
    setIsTriggering(true)
    try {
      const result = await triggerSftpSync('list')
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

  async function handleSelectFile(fileName: string) {
    setIsTriggering(true)
    try {
      const result = await triggerSftpSync('download', fileName)
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

替换为：

```tsx
  async function handleBrowse() {
    setIsTriggering(true)
    try {
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

  async function handleSelectFile(fileName: string) {
    setIsTriggering(true)
    try {
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

- [ ] **Step 4: 在渲染部分，未配置 SFTP 的凭证下显示提示，替代"浏览"按钮**

把：

```tsx
      {store.phase === 'idle' && (
        <button
          type="button"
          onClick={handleBrowse}
          disabled={isTriggering}
          className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={16} /> 浏览 SFTP 目录
        </button>
      )}
```

替换为：

```tsx
      {store.phase === 'idle' && !sftpUser && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface2/60 px-4 py-3 text-sm text-muted">
          <AlertCircle size={16} />
          <span>
            当前凭证「{activePreset.label}」未配置 SFTP 账号，请先在凭证管理页切换到已配置 SFTP 的凭证。
          </span>
        </div>
      )}

      {store.phase === 'idle' && sftpUser && (
        <button
          type="button"
          onClick={handleBrowse}
          disabled={isTriggering}
          className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={16} /> 浏览 SFTP 目录
        </button>
      )}
```

- [ ] **Step 5: 运行类型检查，确认 Task 5 引入的类型错误已修复**

Run: `cd psp-path-dashboard && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 6: Commit**

```bash
git add psp-path-dashboard/src/components/SftpSyncPanel.tsx
git commit -m "feat[2026-08-12](psp-path-dashboard): SFTP 同步页联动 activePresetId，未配置账号时给出提示"
```

---

### Task 7: 端到端手动验证

**Files:** 无代码改动，纯验证步骤。

- [ ] **Step 1: 推送所有分支**

```bash
git push pc-git master
```

（`master` 分支即可，不涉及 `sftp-data` 分支的改动）

- [ ] **Step 2: 在 GitHub Actions 页面手动触发一次 `SFTP Sync` workflow，`credential_id` 填 `hkpsp`**

`action` 选 `list`，`credential_id` 填 `hkpsp`，`client_request_id` 填 `manual-test-hkpsp`，`remote_path` 留空。

Expected: 运行成功，日志里 `listed <N> files from /ppreports/outgoing` 的 N 值可能与之前 `yuncong-hk-psp1` 那次不同（验证确实连的是不同账号）。

- [ ] **Step 3: 在 GitHub Actions 页面手动触发一次 `SFTP Sync` workflow，`credential_id` 填一个不存在的值**

`action` 选 `list`，`credential_id` 填 `not-exist`，`client_request_id` 填 `manual-test-invalid`。

Expected: 运行失败（红叉），日志里能看到 `Error: unknown SFTP_CREDENTIAL_ID: not-exist`。

- [ ] **Step 4: 浏览器打开 `/sftp-sync` 页面，在凭证管理页切换到 `hkpsp`，回到同步页测试完整流程**

浏览 → 若有文件则选择一个 → 下载/查看 CSV 表格渲染是否正常。若 `hkpsp` 目录仍然是空的，至少确认"浏览"能正常触发、轮询结束后显示"无文件"而不报错（若当前 UI 没有对"空文件列表"的专门展示，属于已知的可接受行为，不需要为此单独修复）。

- [ ] **Step 5: 切换回一个没有配置 `loginInfo.sftpUser` 的凭证（如果凭证列表里存在这种），确认同步页显示"未配置 SFTP 账号"提示，且不渲染浏览按钮**

（当前 `CREDENTIAL_PRESETS` 里 `hkpsp` 和 `yuncong-hk-psp1` 都已配置 `loginInfo`，如无未配置的 preset 可跳过这一步，只做代码走查确认条件分支正确即可。）

---

## Self-Review 记录

- **Spec coverage**：设计文档 4 个部分（凭证数据存储、传参链路、前端兜底、数据覆盖行为不变）分别对应 Task 1、Task 2-5、Task 6、无需改动（未新增任务）。全部覆盖。
- **Placeholder scan**：无 TBD/TODO，所有步骤含完整代码。
- **Type consistency**：`credentialId` 命名在 `sftp-api.ts`（`credentialId: string`）、`route.ts`（`credentialId?: string`）、`github-actions.ts`（`credentialId: string`）、workflow yaml（`credential_id`）、`index.mjs`（`SFTP_CREDENTIAL_ID`）之间保持一致的语义映射（TS 层 camelCase，workflow/env 层 snake_case/大写，符合各自语言习惯，非不一致）。
