# SFTP 对账文件同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `psp-path-dashboard` 用户点击按钮后，通过 GitHub Actions 桥接到一个公网 SFTP 服务器，浏览目录并下载对账 CSV，在页面内展示表格并提供下载。

**Architecture:** 浏览器触发 → `paypal-backend-api`（Cloudflare Pages Edge，控制面，用 GitHub PAT 调 GitHub REST API）→ GitHub Actions workflow（ubuntu-latest 完整 Node.js 环境，用 `ssh2-sftp-client` 连 SFTP）→ 产物提交到独立的 `sftp-data` 分支 → 浏览器轮询 run 状态，完成后直接从 `raw.githubusercontent.com` 读取产物（公开仓库无需认证）。详见设计文档 `docs/2026-08-11-sftp-reconciliation-sync-design.md`。

**Tech Stack:** Next.js 15 (Edge Runtime) + `ssh2-sftp-client`（Node 端）+ GitHub Actions + GitHub REST API + React 18 / Vite 5 / TypeScript + Zustand（前端）

**已知外部事实（写计划前已确认，不需要再次验证）：**
- GitHub 仓库：`PPGMS-Test/ppgms-test.github.io`（来自仓库根 `README.md`），默认分支 `master`
- `paypal-backend-api` 已部署在 `https://ppgms-test-github-io.pages.dev`（前端 `PROXY_BASE` 默认值，见 `psp-path-dashboard/src/lib/api.ts`）
- 本仓库是 **public**，用户已确认对账数据是 sandbox 测试数据，可接受落到仓库里
- SFTP 账号密码按用户要求直接硬编码在脚本源码中；GitHub PAT 因权限范围更大（可操作仓库本身），存为 Cloudflare Pages 加密环境变量 `GITHUB_PAT`（此环境变量需要人工在 Cloudflare Pages 控制台配置，计划最后一个任务会提醒）
- 项目现有约定（已读过代码确认）：
  - `paypal-backend-api` 的 route.ts 一律 `export const runtime = 'edge'`，用 `@/lib/cors.ts` 的 `corsJson()`/`corsOptions()` 包装响应，可测试逻辑放 `lib/*.ts` + `lib/*.test.ts`，route.ts 本身不写单测（参考 `src/app/api/common/route.ts` + `src/lib/common-forward.ts`）
  - `psp-path-dashboard` 用 `HashRouter`，页面注册在 `src/App.tsx` 的 `<Routes>` 里；zustand store 用 `create()`，选择器写法 `useStore((s) => s.field)`；测试直接测 `.getState()`，不渲染组件（无 `@testing-library/react`）；样式用 Tailwind 自定义 token（`bg-ink`/`bg-accent`/`border-line`/`bg-surface2` 等，定义在 `tailwind.config.ts`）+ `cn()` 工具（`clsx` + `tailwind-merge`）；图标用 `lucide-react`
  - 仓库无 CSV 解析库（无 papaparse），需要自己写一个小的 CSV 解析函数

---

## File Structure

**新增文件：**

```
.github/workflows/sftp-sync.yml                              # GitHub Actions workflow：list/download 两种模式
scripts/sftp-sync/package.json                                # 独立小包，只依赖 ssh2-sftp-client
scripts/sftp-sync/config.mjs                                  # 硬编码 SFTP 连接参数（host/port/user/password/remoteDir）
scripts/sftp-sync/index.mjs                                   # 核心逻辑：list 模式写 listing.json，download 模式写目标文件

paypal-backend-api/src/lib/github-actions.ts                  # 封装 GitHub REST API：dispatchWorkflow() + findRunByName()
paypal-backend-api/src/lib/github-actions.test.ts             # 单测（mock fetch）
paypal-backend-api/src/app/api/sftp/trigger/route.ts           # POST：触发 workflow_dispatch
paypal-backend-api/src/app/api/sftp/status/route.ts             # GET：查询 run 状态

psp-path-dashboard/src/lib/csv-parse.ts                       # 极简 CSV 解析（支持带引号字段/转义引号/逗号）
psp-path-dashboard/src/lib/csv-parse.test.ts
psp-path-dashboard/src/lib/sftp-api.ts                         # 前端 API 封装：trigger/status/拉取 raw 产物
psp-path-dashboard/src/store/sftp-sync.ts                      # zustand store：轮询状态机（idle/listing/downloading/error）
psp-path-dashboard/src/store/sftp-sync.test.ts
psp-path-dashboard/src/components/SftpSyncPanel.tsx             # 主 UI：浏览目录按钮、文件列表、表格展示、下载按钮、错误重试
psp-path-dashboard/src/pages/SftpSyncPage.tsx                   # 页面壳（TopBar + SftpSyncPanel），注册路由 /sftp-sync
```

**修改文件：**

```
psp-path-dashboard/src/App.tsx           # 新增 <Route path="/sftp-sync" element={<SftpSyncPage />} />
psp-path-dashboard/src/components/TopBar.tsx  # 新增一个导航入口链接到 /sftp-sync（参照现有"凭证"链接样式）
```

**职责边界：**
- `scripts/sftp-sync/`：纯 Node 脚本，只知道怎么跟 SFTP 交互、怎么写本地文件，不知道 GitHub API/前端
- `github-actions.ts`：只知道怎么跟 GitHub REST API 交互（触发/查状态），不知道 SFTP
- `sftp-api.ts`：只知道怎么跟 `paypal-backend-api` 和 `raw.githubusercontent.com` 交互
- `store/sftp-sync.ts`：只管状态机（轮询中/成功/失败），不直接碰 fetch 细节（调用 `sftp-api.ts` 提供的函数）
- `SftpSyncPanel.tsx`：只管渲染，从 store 读状态、调用 store 的 action

---

## Task 1: GitHub Actions workflow + SFTP 脚本

**Files:**
- Create: `.github/workflows/sftp-sync.yml`
- Create: `scripts/sftp-sync/package.json`
- Create: `scripts/sftp-sync/config.mjs`
- Create: `scripts/sftp-sync/index.mjs`

这部分依赖真实网络连接，不做自动化单测，用手动触发一次 workflow 验证（见 Step 5）。

- [ ] **Step 1: 创建独立的 Node 脚本包**

`scripts/sftp-sync/package.json`：

```json
{
  "name": "sftp-sync-script",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "ssh2-sftp-client": "^11.0.0"
  }
}
```

- [ ] **Step 2: 写 SFTP 连接配置（硬编码）**

`scripts/sftp-sync/config.mjs`：

```javascript
// SFTP 连接参数硬编码在源码中——本项目是展示用 demo，对账数据为 sandbox 测试数据，
// 用户已确认接受此简化（详见 docs/2026-08-11-sftp-reconciliation-sync-design.md）。
export const SFTP_CONFIG = {
  host: 'REPLACE_WITH_ACTUAL_SFTP_HOST',
  port: 22,
  username: 'REPLACE_WITH_ACTUAL_USERNAME',
  password: 'REPLACE_WITH_ACTUAL_PASSWORD',
}

export const SFTP_REMOTE_DIR = 'REPLACE_WITH_ACTUAL_REMOTE_DIR'
```

> **注意**：这三个占位符（host/username/password）和 remote dir 需要用户提供真实值后手动填入。这是本计划唯一需要用户提供额外信息才能跑通的地方，其余步骤都可以照抄执行。

- [ ] **Step 3: 写核心脚本（list + download 两种模式）**

`scripts/sftp-sync/index.mjs`：

```javascript
import SftpClient from 'ssh2-sftp-client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { SFTP_CONFIG, SFTP_REMOTE_DIR } from './config.mjs'

const ACTION = process.env.SFTP_ACTION // 'list' | 'download'
const REMOTE_PATH = process.env.SFTP_REMOTE_PATH // download 模式下的完整远程文件路径
const OUTPUT_DIR = process.env.SFTP_OUTPUT_DIR ?? './output'

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const sftp = new SftpClient()

  try {
    await sftp.connect(SFTP_CONFIG)

    if (ACTION === 'list') {
      const entries = await sftp.list(SFTP_REMOTE_DIR)
      const listing = entries
        .filter((e) => e.type === '-') // 只列普通文件，排除目录
        .map((e) => ({ name: e.name, size: e.size, modifyTime: e.modifyTime }))
      writeFileSync(`${OUTPUT_DIR}/listing.json`, JSON.stringify({ files: listing }, null, 2))
      console.log(`listed ${listing.length} files from ${SFTP_REMOTE_DIR}`)
    } else if (ACTION === 'download') {
      if (!REMOTE_PATH) throw new Error('SFTP_REMOTE_PATH is required for download action')
      const fileName = REMOTE_PATH.split('/').pop()
      const buffer = await sftp.get(REMOTE_PATH)
      writeFileSync(`${OUTPUT_DIR}/${fileName}`, buffer)
      console.log(`downloaded ${REMOTE_PATH} -> ${OUTPUT_DIR}/${fileName}`)
    } else {
      throw new Error(`unknown SFTP_ACTION: ${ACTION}`)
    }
  } finally {
    await sftp.end()
  }
}

run().catch((err) => {
  console.error('sftp-sync failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: 写 workflow 文件**

`.github/workflows/sftp-sync.yml`：

```yaml
name: SFTP Sync

on:
  workflow_dispatch:
    inputs:
      action:
        description: 'list or download'
        required: true
        type: choice
        options: [list, download]
      remote_path:
        description: 'Full remote file path (required for download)'
        required: false
        type: string
      client_request_id:
        description: 'Unique id supplied by the caller, used to correlate polling'
        required: true
        type: string

run-name: sftp-sync-${{ inputs.client_request_id }}

concurrency:
  group: sftp-sync
  cancel-in-progress: false

permissions:
  contents: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout master (for script source)
        uses: actions/checkout@v4
        with:
          ref: master
          path: source

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install script dependencies
        working-directory: source/scripts/sftp-sync
        run: npm install

      - name: Run SFTP sync
        working-directory: source/scripts/sftp-sync
        env:
          SFTP_ACTION: ${{ inputs.action }}
          SFTP_REMOTE_PATH: ${{ inputs.remote_path }}
          SFTP_OUTPUT_DIR: ${{ github.workspace }}/output
        run: node index.mjs

      - name: Checkout sftp-data branch
        uses: actions/checkout@v4
        with:
          ref: sftp-data
          path: data-branch

      - name: Copy output into data branch
        run: |
          mkdir -p data-branch/sftp-data
          cp -r output/. data-branch/sftp-data/

      - name: Commit and push result
        working-directory: data-branch
        run: |
          git config user.name "sftp-sync-bot"
          git config user.email "sftp-sync-bot@users.noreply.github.com"
          git add sftp-data
          git diff --cached --quiet && echo "no changes" || git commit -m "sftp-sync: ${{ inputs.action }} (${{ inputs.client_request_id }})"
          git push origin sftp-data
```

- [ ] **Step 5: 手动创建 `sftp-data` 分支（workflow 依赖它已存在）**

这一步在实现代码之外，需要人工操作一次（后续 workflow 运行不需要重复）：

```bash
git checkout --orphan sftp-data
git rm -rf .
mkdir sftp-data
echo '{}' > sftp-data/.gitkeep.json
git add sftp-data
git commit -m "chore: init sftp-data branch"
git push origin sftp-data
git checkout master
```

- [ ] **Step 6: 提交 workflow 和脚本**

```bash
git add .github/workflows/sftp-sync.yml scripts/sftp-sync
git commit -m "feat[$(date +%Y-%m-%d)]: 新增 GitHub Actions SFTP 同步 workflow"
```

- [ ] **Step 7: 手动触发一次验证（需要先在 Step 2 填入真实 SFTP 凭证并推送）**

推送后在 GitHub 仓库页面 → Actions → SFTP Sync → Run workflow，`action` 选 `list`，`client_request_id` 随便填一个字符串（如 `test-1`）。跑完后检查 `sftp-data` 分支下 `sftp-data/listing.json` 是否有内容，确认凭证和远程目录填得对。

---

## Task 2: 后端 GitHub API 封装（`lib/github-actions.ts`）

**Files:**
- Create: `paypal-backend-api/src/lib/github-actions.ts`
- Test: `paypal-backend-api/src/lib/github-actions.test.ts`

- [ ] **Step 1: 写失败的测试**

`paypal-backend-api/src/lib/github-actions.test.ts`：

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchSftpWorkflow, findRunByName } from './github-actions'

function mockFetchOnce(status = 200, json: unknown = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(json),
  } as Response)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('dispatchSftpWorkflow', () => {
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

  it('download 模式带 remote_path', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({
      pat: 'ghp_test',
      action: 'download',
      remotePath: '/recon/2026-08-11.csv',
      clientRequestId: 'req-2',
    })
    const [, init] = spy.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.inputs.remote_path).toBe('/recon/2026-08-11.csv')
  })

  it('GitHub API 返回非 2xx 时抛错', async () => {
    mockFetchOnce(422, { message: 'bad request' })
    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', clientRequestId: 'req-3' }),
    ).rejects.toThrow('Failed to dispatch workflow: 422')
  })
})

describe('findRunByName', () => {
  it('在 runs 列表里按 name 精确匹配，返回 status/conclusion', async () => {
    mockFetchOnce(200, {
      workflow_runs: [
        { name: 'sftp-sync-other', status: 'completed', conclusion: 'success' },
        { name: 'sftp-sync-req-1', status: 'in_progress', conclusion: null },
      ],
    })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-1')
    expect(result).toEqual({ status: 'in_progress', conclusion: null })
  })

  it('找不到匹配的 run 时返回 null（run 可能还没出现在列表里）', async () => {
    mockFetchOnce(200, { workflow_runs: [] })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-404')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd paypal-backend-api && pnpm test github-actions`
Expected: FAIL，报错 `Cannot find module './github-actions'` 或找不到导出的函数

- [ ] **Step 3: 实现 `github-actions.ts`**

```typescript
const GITHUB_OWNER = 'PPGMS-Test'
const GITHUB_REPO = 'ppgms-test.github.io'
const WORKFLOW_FILE = 'sftp-sync.yml'
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`

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
  })
  if (!res.ok) {
    throw new Error(`Failed to dispatch workflow: ${res.status}`)
  }
}

export interface RunStatus {
  status: string
  conclusion: string | null
}

export async function findRunByName(pat: string, runName: string): Promise<RunStatus | null> {
  const res = await fetch(`${API_BASE}/actions/runs?event=workflow_dispatch&per_page=20`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    throw new Error(`Failed to list workflow runs: ${res.status}`)
  }
  const data = (await res.json()) as { workflow_runs: Array<{ name: string; status: string; conclusion: string | null }> }
  const match = data.workflow_runs.find((run) => run.name === runName)
  if (!match) return null
  return { status: match.status, conclusion: match.conclusion }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd paypal-backend-api && pnpm test github-actions`
Expected: PASS，5 个测试全绿

- [ ] **Step 5: Commit**

```bash
git add paypal-backend-api/src/lib/github-actions.ts paypal-backend-api/src/lib/github-actions.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 新增 GitHub Actions 触发/查询状态封装"
```

---

## Task 3: 后端路由 `/api/sftp/trigger` 和 `/api/sftp/status`

**Files:**
- Create: `paypal-backend-api/src/app/api/sftp/trigger/route.ts`
- Create: `paypal-backend-api/src/app/api/sftp/status/route.ts`

这两个 route.ts 是薄封装（调用 Task 2 已测试过的 `github-actions.ts`），按项目现有约定（`common/route.ts` 同样没有独立单测）不写专门的路由测试，靠手动验证（Task 5）。

- [ ] **Step 1: 实现 trigger 路由**

`paypal-backend-api/src/app/api/sftp/trigger/route.ts`：

```typescript
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { dispatchSftpWorkflow } from '@/lib/github-actions'

export function OPTIONS() {
  return corsOptions()
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { action?: string; remotePath?: string }
  const { action, remotePath } = body

  if (action !== 'list' && action !== 'download') {
    return corsJson({ error: 'action must be "list" or "download"' }, 400)
  }
  if (action === 'download' && !remotePath) {
    return corsJson({ error: 'remotePath is required for download action' }, 400)
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

- [ ] **Step 2: 实现 status 路由**

`paypal-backend-api/src/app/api/sftp/status/route.ts`：

```typescript
export const runtime = 'edge'

import { corsJson, corsOptions } from '@/lib/cors'
import { findRunByName } from '@/lib/github-actions'

export function OPTIONS() {
  return corsOptions()
}

export async function GET(req: Request) {
  const requestId = new URL(req.url).searchParams.get('requestId')
  if (!requestId) {
    return corsJson({ error: 'requestId query param is required' }, 400)
  }

  const pat = process.env.GITHUB_PAT
  if (!pat) {
    return corsJson({ error: 'GITHUB_PAT is not configured' }, 500)
  }

  try {
    const run = await findRunByName(pat, `sftp-sync-${requestId}`)
    if (!run) {
      return corsJson({ status: 'pending' })
    }
    return corsJson({ status: run.status, conclusion: run.conclusion })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to query sftp sync status'
    return corsJson({ error: message }, 502)
  }
}
```

- [ ] **Step 3: 本地跑一下类型检查确认没有编译错误**

Run: `cd paypal-backend-api && npx tsc --noEmit`
Expected: 无 sftp 相关的类型错误

- [ ] **Step 4: Commit**

```bash
git add paypal-backend-api/src/app/api/sftp
git commit -m "feat[$(date +%Y-%m-%d)](paypal-backend-api): 新增 /api/sftp/trigger 和 /api/sftp/status 路由"
```

---

## Task 4: 前端 CSV 解析工具

**Files:**
- Create: `psp-path-dashboard/src/lib/csv-parse.ts`
- Test: `psp-path-dashboard/src/lib/csv-parse.test.ts`

- [ ] **Step 1: 写失败的测试**

`psp-path-dashboard/src/lib/csv-parse.test.ts`：

```typescript
import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv-parse'

describe('parseCsv', () => {
  it('解析简单的逗号分隔内容，第一行是表头', () => {
    const result = parseCsv('name,amount\nAlice,100\nBob,200')
    expect(result.headers).toEqual(['name', 'amount'])
    expect(result.rows).toEqual([
      ['Alice', '100'],
      ['Bob', '200'],
    ])
  })

  it('支持带引号的字段（字段内含逗号）', () => {
    const result = parseCsv('name,note\n"Smith, John",hello')
    expect(result.rows).toEqual([['Smith, John', 'hello']])
  })

  it('支持引号内的转义引号（连续两个双引号表示一个字面双引号）', () => {
    const result = parseCsv('name,note\n"Say ""hi""",ok')
    expect(result.rows).toEqual([['Say "hi"', 'ok']])
  })

  it('忽略末尾空行', () => {
    const result = parseCsv('a,b\n1,2\n')
    expect(result.rows).toEqual([['1', '2']])
  })

  it('空字符串输入返回空表头和空行', () => {
    const result = parseCsv('')
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('支持 CRLF 换行', () => {
    const result = parseCsv('a,b\r\n1,2\r\n3,4')
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd psp-path-dashboard && pnpm test csv-parse`
Expected: FAIL，`Cannot find module './csv-parse'`

- [ ] **Step 3: 实现 `csv-parse.ts`**

```typescript
export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/** 极简 RFC4180 风格 CSV 解析：支持带引号字段、转义引号（""）、逗号、CRLF/LF 换行 */
export function parseCsv(input: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  function pushField() {
    row.push(field)
    field = ''
  }
  function pushRow() {
    pushField()
    rows.push(row)
    row = []
  }

  while (i < input.length) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (char === ',') {
      pushField()
      i += 1
      continue
    }
    if (char === '\r') {
      i += 1
      continue
    }
    if (char === '\n') {
      pushRow()
      i += 1
      continue
    }
    field += char
    i += 1
  }

  // 处理最后一行（如果输入没有以换行结尾）
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ''))
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] }
  }
  const [headers, ...dataRows] = nonEmptyRows
  return { headers, rows: dataRows }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd psp-path-dashboard && pnpm test csv-parse`
Expected: PASS，6 个测试全绿

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/lib/csv-parse.ts psp-path-dashboard/src/lib/csv-parse.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 新增极简 CSV 解析工具"
```

---

## Task 5: 前端 API 封装（`lib/sftp-api.ts`）

**Files:**
- Create: `psp-path-dashboard/src/lib/sftp-api.ts`

- [ ] **Step 1: 实现 API 封装**

`psp-path-dashboard/src/lib/sftp-api.ts`：

```typescript
// 与 paypal-backend-api 的 /api/sftp/* 交互，以及最终从 raw.githubusercontent.com 拉取产物。
// PROXY_BASE 约定跟 lib/api.ts 保持一致：默认直连已部署后端，pnpm dev:local 时可覆盖。
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE || 'https://ppgms-test-github-io.pages.dev'
const RAW_BASE = 'https://raw.githubusercontent.com/PPGMS-Test/ppgms-test.github.io/sftp-data/sftp-data'

export interface TriggerResult {
  requestId?: string
  error?: string
}

export async function triggerSftpSync(action: 'list' | 'download', remotePath?: string): Promise<TriggerResult> {
  const res = await fetch(`${PROXY_BASE}/api/sftp/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, remotePath }),
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
```

- [ ] **Step 2: 本地类型检查**

Run: `cd psp-path-dashboard && npx tsc -b --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add psp-path-dashboard/src/lib/sftp-api.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 新增前端 SFTP 同步 API 封装"
```

---

## Task 6: 前端状态机 store（`store/sftp-sync.ts`）

**Files:**
- Create: `psp-path-dashboard/src/store/sftp-sync.ts`
- Test: `psp-path-dashboard/src/store/sftp-sync.test.ts`

Store 只管状态转换，不自己跑真实的轮询定时器（定时器由组件里的 `useEffect` 驱动，调用 store 暴露的 setter），这样单测可以直接调 action 断言状态变化，不用 mock 定时器。

- [ ] **Step 1: 写失败的测试**

`psp-path-dashboard/src/store/sftp-sync.test.ts`：

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { useSftpSyncStore } from './sftp-sync'

beforeEach(() => {
  useSftpSyncStore.getState().reset()
})

describe('useSftpSyncStore', () => {
  it('初始状态是 idle', () => {
    expect(useSftpSyncStore.getState().phase).toBe('idle')
  })

  it('startListing 把 phase 设为 listing 并记录 requestId', () => {
    useSftpSyncStore.getState().startListing('req-1')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('listing')
    expect(state.requestId).toBe('req-1')
    expect(state.error).toBeNull()
  })

  it('setListing 把结果写入并把 phase 设为 browsing', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setListing([{ name: 'a.csv', size: 10, modifyTime: 0 }])
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('browsing')
    expect(state.files).toEqual([{ name: 'a.csv', size: 10, modifyTime: 0 }])
  })

  it('startDownloading 把 phase 设为 downloading 并记录目标文件名', () => {
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('downloading')
    expect(state.requestId).toBe('req-2')
    expect(state.downloadingFileName).toBe('a.csv')
  })

  it('setDownloaded 把内容写入并把 phase 设为 ready', () => {
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    useSftpSyncStore.getState().setDownloaded('name,amount\nAlice,100')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('ready')
    expect(state.csvContent).toBe('name,amount\nAlice,100')
  })

  it('setError 把 phase 设为 error 并记录错误信息', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setError('连接超时')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('error')
    expect(state.error).toBe('连接超时')
  })

  it('reset 恢复到初始状态', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setError('失败')
    useSftpSyncStore.getState().reset()
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('idle')
    expect(state.requestId).toBeNull()
    expect(state.error).toBeNull()
    expect(state.files).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd psp-path-dashboard && pnpm test store/sftp-sync`
Expected: FAIL，`Cannot find module './sftp-sync'`

- [ ] **Step 3: 实现 store**

`psp-path-dashboard/src/store/sftp-sync.ts`：

```typescript
import { create } from 'zustand'
import type { FileEntry } from '@/lib/sftp-api'

export type SftpSyncPhase = 'idle' | 'listing' | 'browsing' | 'downloading' | 'ready' | 'error'

interface SftpSyncState {
  phase: SftpSyncPhase
  requestId: string | null
  files: FileEntry[]
  downloadingFileName: string | null
  csvContent: string | null
  error: string | null
  startListing: (requestId: string) => void
  setListing: (files: FileEntry[]) => void
  startDownloading: (requestId: string, fileName: string) => void
  setDownloaded: (content: string) => void
  setError: (message: string) => void
  reset: () => void
}

const initialState = {
  phase: 'idle' as SftpSyncPhase,
  requestId: null,
  files: [],
  downloadingFileName: null,
  csvContent: null,
  error: null,
}

export const useSftpSyncStore = create<SftpSyncState>()((set) => ({
  ...initialState,
  startListing: (requestId) => set({ phase: 'listing', requestId, error: null }),
  setListing: (files) => set({ phase: 'browsing', files }),
  startDownloading: (requestId, fileName) =>
    set({ phase: 'downloading', requestId, downloadingFileName: fileName, error: null }),
  setDownloaded: (content) => set({ phase: 'ready', csvContent: content }),
  setError: (message) => set({ phase: 'error', error: message }),
  reset: () => set({ ...initialState }),
}))
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd psp-path-dashboard && pnpm test store/sftp-sync`
Expected: PASS，7 个测试全绿

- [ ] **Step 5: Commit**

```bash
git add psp-path-dashboard/src/store/sftp-sync.ts psp-path-dashboard/src/store/sftp-sync.test.ts
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 新增 SFTP 同步状态机 store"
```

---

## Task 7: 前端 UI 组件与页面

**Files:**
- Create: `psp-path-dashboard/src/components/SftpSyncPanel.tsx`
- Create: `psp-path-dashboard/src/pages/SftpSyncPage.tsx`
- Modify: `psp-path-dashboard/src/App.tsx`
- Modify: `psp-path-dashboard/src/components/TopBar.tsx`

组件涉及定时轮询和渲染，项目约定不用 `@testing-library/react` 做组件渲染测试，因此本任务靠手动在浏览器里验证（Task 8），不写自动化测试，符合现有测试策略（设计文档"测试策略"一节已注明）。

- [ ] **Step 1: 实现轮询 + 展示组件**

`psp-path-dashboard/src/components/SftpSyncPanel.tsx`：

```typescript
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, RotateCcw, AlertCircle } from 'lucide-react'
import { useSftpSyncStore } from '@/store/sftp-sync'
import { triggerSftpSync, getSftpSyncStatus, fetchListing, fetchDownloadedFile, rawFileUrl } from '@/lib/sftp-api'
import { parseCsv } from '@/lib/csv-parse'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120_000

function usePolling(requestId: string | null, active: boolean, onDone: (ok: boolean) => void) {
  const startedAt = useRef<number>(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!active || !requestId) return
    startedAt.current = Date.now()
    setElapsedSec(0)

    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt.current
      setElapsedSec(Math.floor(elapsed / 1000))

      if (elapsed > POLL_TIMEOUT_MS) {
        clearInterval(interval)
        onDone(false)
        return
      }

      const result = await getSftpSyncStatus(requestId)
      if (result.status === 'completed') {
        clearInterval(interval)
        onDone(result.conclusion === 'success')
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, active])

  return elapsedSec
}

export function SftpSyncPanel() {
  const store = useSftpSyncStore()
  const isListingPolling = store.phase === 'listing'
  const isDownloadingPolling = store.phase === 'downloading'

  const listingElapsed = usePolling(store.requestId, isListingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const files = await fetchListing()
      store.setListing(files)
    } catch {
      store.setError('拉取目录列表失败')
    }
  })

  const downloadElapsed = usePolling(store.requestId, isDownloadingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const content = await fetchDownloadedFile(store.downloadingFileName ?? '')
      store.setDownloaded(content)
    } catch {
      store.setError('拉取文件内容失败')
    }
  })

  async function handleBrowse() {
    const result = await triggerSftpSync('list')
    if (result.requestId) {
      store.startListing(result.requestId)
    } else {
      store.setError(result.error ?? '触发同步失败')
    }
  }

  async function handleSelectFile(fileName: string) {
    const result = await triggerSftpSync('download', fileName)
    if (result.requestId) {
      store.startDownloading(result.requestId, fileName)
    } else {
      store.setError(result.error ?? '触发同步失败')
    }
  }

  const parsed = store.csvContent ? parseCsv(store.csvContent) : null

  return (
    <div className="flex flex-col gap-4">
      {store.phase === 'idle' && (
        <button
          type="button"
          onClick={handleBrowse}
          className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2"
        >
          <FolderOpen size={16} /> 浏览 SFTP 目录
        </button>
      )}

      {(isListingPolling || isDownloadingPolling) && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          同步中…（{isListingPolling ? listingElapsed : downloadElapsed}s）
        </div>
      )}

      {store.phase === 'browsing' && (
        <ul className="flex flex-col gap-2">
          {store.files.map((file) => (
            <li key={file.name}>
              <button
                type="button"
                onClick={() => handleSelectFile(file.name)}
                className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-ink transition hover:border-accent/50 hover:bg-surface2"
              >
                <span>{file.name}</span>
                <span className="font-mono text-xs text-muted">{file.size} bytes</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {store.phase === 'ready' && parsed && (
        <div className="flex flex-col gap-3">
          <a
            href={rawFileUrl(store.downloadingFileName ?? '')}
            download={store.downloadingFileName ?? undefined}
            className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2"
          >
            <Download size={16} /> 下载 {store.downloadingFileName}
          </a>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface2">
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-mono text-xs uppercase text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => (
                  <tr key={i} className={cn(i % 2 === 0 ? 'bg-transparent' : 'bg-surface2/40')}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-ink">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {store.phase === 'error' && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-danger">
          <AlertCircle size={16} />
          <span>{store.error}</span>
          <button
            type="button"
            onClick={() => store.reset()}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-ink transition hover:border-accent/50 hover:bg-surface2"
          >
            <RotateCcw size={14} /> 重试
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 实现页面壳**

`psp-path-dashboard/src/pages/SftpSyncPage.tsx`：

```typescript
import { TopBar } from '@/components/TopBar'
import { SftpSyncPanel } from '@/components/SftpSyncPanel'

export function SftpSyncPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-4 font-display text-lg font-semibold text-ink">对账文件同步</h1>
        <SftpSyncPanel />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: 注册路由**

修改 `psp-path-dashboard/src/App.tsx`，在现有 import 和 `<Routes>` 里加一行：

```typescript
import { SftpSyncPage } from '@/pages/SftpSyncPage'
```

```typescript
<Route path="/sftp-sync" element={<SftpSyncPage />} />
```

（放在 `<Route path="/credentials" .../>` 之后）

- [ ] **Step 4: 在 TopBar 加导航入口**

修改 `psp-path-dashboard/src/components/TopBar.tsx`，在现有 `<Link to="/credentials" ...>` 之前加一个新链接（用 `lucide-react` 的 `FileSpreadsheet` 图标）：

```typescript
import { KeyRound, Moon, Sun, Workflow, FileSpreadsheet } from 'lucide-react'
```

```typescript
<Link
  to="/sftp-sync"
  className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-ink transition hover:border-accent/50 hover:bg-surface2"
>
  <FileSpreadsheet size={14} /> 对账同步
</Link>
```

- [ ] **Step 5: 本地类型检查**

Run: `cd psp-path-dashboard && npx tsc -b --noEmit`
Expected: 无类型错误

- [ ] **Step 6: Commit**

```bash
git add psp-path-dashboard/src/components/SftpSyncPanel.tsx psp-path-dashboard/src/pages/SftpSyncPage.tsx psp-path-dashboard/src/App.tsx psp-path-dashboard/src/components/TopBar.tsx
git commit -m "feat[$(date +%Y-%m-%d)](psp-path-dashboard): 新增对账文件同步页面与导航入口"
```

---

## Task 8: 端到端手动验证

**Files:** 无新文件，纯验证步骤

- [ ] **Step 1: 配置 Cloudflare Pages 环境变量**

登录 Cloudflare Pages 控制台 → `ppgms-test-github-io` 项目 → Settings → Environment variables，新增加密变量：
- `GITHUB_PAT`：一个有 `actions:write`（触发/查看 workflow run）权限的 GitHub Personal Access Token（Fine-grained token，仅授权到 `PPGMS-Test/ppgms-test.github.io` 这一个仓库，`Actions: Read and write` 权限即可）

保存后重新部署一次 `paypal-backend-api`（或等下次 push 自动部署）使环境变量生效。

- [ ] **Step 2: 本地跑通前端**

```bash
cd psp-path-dashboard && pnpm dev
```

浏览器打开 `http://localhost:5180/#/sftp-sync`，点击【浏览 SFTP 目录】。

- [ ] **Step 3: 验证 list 流程**

预期：按钮消失，出现"同步中…（Ns）"的 loading 态；15~40 秒后变成文件列表。若报错，检查：
- `paypal-backend-api` 的 `GITHUB_PAT` 是否配置正确
- GitHub 仓库 Actions 页面该 run 是否真的执行了、日志报了什么错

- [ ] **Step 4: 验证 download 流程**

点击列表中任意一个文件，预期同样出现 loading 态，完成后页面内出现表格和【下载】按钮。点击下载按钮确认能拿到原始文件。

- [ ] **Step 5: 验证失败态**

临时把 `scripts/sftp-sync/config.mjs` 里的密码改错、推送、重新触发一次 list，确认页面能正确展示错误信息和【重试】按钮，而不是卡死在 loading。验证完后把密码改回正确值再推送一次。

- [ ] **Step 6: 全部通过后跑一遍完整测试套件确认没有破坏其他功能**

```bash
cd paypal-backend-api && pnpm test
cd ../psp-path-dashboard && pnpm test
```

Expected: 两边全绿

---

## Self-Review 记录

- **Spec 覆盖**：设计文档的架构总览（GitHub Actions 桥接）、三个组件（workflow、backend 两接口、frontend 页面）、错误处理表格四种场景（超时/SFTP 失败/GitHub API 失败/CSV 解析失败）均已在 Task 1/2/3/6/7 中落地，超时用 `POLL_TIMEOUT_MS` 处理，CSV 解析失败通过 `parsed` 为 `null` 时不渲染表格（但按钮/下载仍可用）覆盖。
- **占位符检查**：全文唯一的占位符是 Task 1 Step 2 里的 SFTP 真实凭证（host/username/password/remote dir）——这是设计上必须由用户提供的外部信息，不是计划疏漏，已在旁边加注释说明。
- **类型一致性**：`FileEntry`（`lib/sftp-api.ts`）在 `store/sftp-sync.ts` 里原样复用；`SftpSyncPhase` 的枚举值（`idle/listing/browsing/downloading/ready/error`）在 store 实现和 `SftpSyncPanel.tsx` 的条件渲染里保持一致；`triggerSftpSync`/`getSftpSyncStatus`/`fetchListing`/`fetchDownloadedFile`/`rawFileUrl` 的函数名和参数在 `lib/sftp-api.ts` 定义后，在 `SftpSyncPanel.tsx` 中的调用完全对应。
- **范围检查**：8 个任务全部服务于同一个功能（SFTP 对账文件同步），没有夹带无关重构。
