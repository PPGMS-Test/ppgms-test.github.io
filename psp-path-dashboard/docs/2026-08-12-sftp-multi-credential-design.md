# SFTP 多凭证支持 设计文档

日期：2026-08-12

## 背景

`sftp-sync` 功能（见 [2026-08-11-sftp-reconciliation-sync-design.md](./2026-08-11-sftp-reconciliation-sync-design.md)）上线并完成端到端手动验证（Task 8）后，发现当前 SFTP 连接凭证是硬编码的单一账号（`psp-psa-hk02`），且该账号对应的 sandbox 环境目录下没有对账数据。

项目里已有的 `CREDENTIAL_PRESETS`（`src/config/credential-presets.ts`）本身就是"多套下游商户测试凭证"的管理机制，其中每套 preset 可选携带 `loginInfo.sftpUser`（目前仅用于在凭证管理页展示，不参与任何实际请求）。用户希望切换到 `hkpsp` 这套凭证对应的 SFTP 账号，验证能否拉到真实对账文件，因此需要让 SFTP 同步功能感知"当前选中的是哪套凭证"，并使用对应账号连接。

## 目标

- SFTP 同步页面根据当前全局选中的凭证（`activePresetId`）自动使用对应的 SFTP 账号，无需用户在同步页面里重复选择。
- 支持多套凭证各自独立的 SFTP host/用户名/密码/远端目录。
- 未配置 SFTP 信息的凭证，在同步页面给出明确提示，而不是让用户触发后才在远端报错。

## 非目标

- 不做"按凭证分文件夹"存储同步结果——`sftp-data` 分支上的输出文件路径维持现状（固定路径，不区分凭证），每次浏览/下载只关心当前选中凭证的最新一次结果，会覆盖上一次输出。
- 不改动 `CREDENTIAL_PRESETS` 的 BYOK（clientId/clientSecret 等）字段的管理方式，只涉及 SFTP 凭证。
- 不做凭证权限/多用户隔离，仍然是单人 demo 项目场景。

## 设计

### 1. 凭证数据存储

新建 `scripts/sftp-sync/credentials.mjs`，替代原来的 `scripts/sftp-sync/config.mjs`：

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

`scripts/sftp-sync/index.mjs` 改为：

```js
import { SFTP_CREDENTIALS } from './credentials.mjs'

const CREDENTIAL_ID = process.env.SFTP_CREDENTIAL_ID
const cred = SFTP_CREDENTIALS[CREDENTIAL_ID]
if (!cred) {
  throw new Error(`unknown SFTP_CREDENTIAL_ID: ${CREDENTIAL_ID}`)
}
const SFTP_CONFIG = { host: cred.host, port: cred.port, username: cred.username, password: cred.password, readyTimeout: cred.readyTimeout }
const SFTP_REMOTE_DIR = cred.remoteDir
```

其余 `list`/`download` 逻辑不变。

### 2. 传参链路

新增一个字段 `credentialId`，贯穿整条链路：

1. **前端 `SftpSyncPanel`**：通过 `useActivePresetStore()` 读取当前 `activePresetId`，调用 `triggerSftpSync(action, remotePath, credentialId)`。
2. **`lib/sftp-api.ts`**：`triggerSftpSync` 新增 `credentialId` 参数，写入 POST body：`{ action, remotePath, credentialId }`。
3. **`paypal-backend-api` `/api/sftp/trigger/route.ts`**：解析 body 里的 `credentialId`，校验非空字符串（缺失则返回 400），转发给 `dispatchSftpWorkflow`。
4. **`lib/github-actions.ts` `dispatchSftpWorkflow`**：新增 `credentialId` 参数，作为 workflow_dispatch 的 `inputs.credential_id` 传下去。
5. **`.github/workflows/sftp-sync.yml`**：新增 input：
   ```yaml
   credential_id:
     description: 'Credential preset id, must match a key in scripts/sftp-sync/credentials.mjs (e.g. "hkpsp")'
     required: true
     type: string
   ```
   并在 "Run SFTP sync" 步骤的 `env` 里加一行 `SFTP_CREDENTIAL_ID: ${{ inputs.credential_id }}`。
6. **`scripts/sftp-sync/index.mjs`**：如上，按 `SFTP_CREDENTIAL_ID` 查表，查不到直接 throw（会体现在 Actions 运行日志里，run 会标红失败，不会误用别的账号连接）。

`credential_id` 用 `type: string` 而不是 `choice`，避免每新增一套 preset 就要改 workflow 的枚举值；有效性校验完全交给脚本运行时查表。

### 3. 前端兜底：未配置 SFTP 的凭证

`CredentialPreset.loginInfo?.sftpUser` 已经是可选字段（详见 `credential-presets.ts`）。`SftpSyncPanel` 渲染前先读取当前 `activePreset`：

- 若 `activePreset.loginInfo?.sftpUser` 不存在 → 渲染一条提示（复用 `error` 态类似的样式，但不经过 store 的 `phase`，是纯展示判断）："当前凭证「{activePreset.label}」未配置 SFTP 账号，请先在凭证管理页切换到已配置 SFTP 的凭证"，不渲染"浏览 SFTP 目录"按钮。
- 若存在 → 正常渲染现有的浏览/同步流程。

这一判断只影响前端 UI 提示，不改变后端的强校验（即便前端判断有遗漏，`index.mjs` 的查表兜底仍然是最终防线）。

### 4. 数据覆盖行为（维持现状，不改动）

`sftp-data` 分支上 `listing.json` 和下载的 CSV 文件路径都是固定的（不带凭证标识）。切换凭证后重新浏览/下载会直接覆盖上一次的输出。这符合"同一时刻只关心当前选中凭证的最新数据"的使用场景，不需要按凭证分文件夹存储，避免过度设计。

## 影响范围（文件清单）

- `scripts/sftp-sync/config.mjs` → 删除，内容合并进新建的 `scripts/sftp-sync/credentials.mjs`
- `scripts/sftp-sync/index.mjs` → 改为按 `SFTP_CREDENTIAL_ID` 查表
- `.github/workflows/sftp-sync.yml` → 新增 `credential_id` input + 对应 env
- `paypal-backend-api/src/lib/github-actions.ts` → `dispatchSftpWorkflow` 新增 `credentialId` 参数
- `paypal-backend-api/src/lib/github-actions.test.ts` → 补充/更新相应断言
- `paypal-backend-api/src/app/api/sftp/trigger/route.ts` → 解析、校验、转发 `credentialId`
- `psp-path-dashboard/src/lib/sftp-api.ts` → `triggerSftpSync` 新增 `credentialId` 参数
- `psp-path-dashboard/src/components/SftpSyncPanel.tsx` → 读取 `activePresetId`/`activePreset`，传参 + 未配置 SFTP 时的提示态

## 测试

- `paypal-backend-api/src/lib/github-actions.test.ts`：更新对 `dispatchSftpWorkflow` 请求体中 `inputs.credential_id` 的断言。
- 手动验证：分别切换到 `hkpsp` 和 `yuncong-hk-psp1` 两套凭证，触发浏览，确认 workflow 日志里 `SFTP_CREDENTIAL_ID` 对应正确，连接到各自账号（可通过 `listed N files` 的 N 值/来源目录区分）。
- 手动验证：把 `activePresetId` 切换到一个没有 `loginInfo.sftpUser` 的凭证（如果测试时存在这种 preset），确认 UI 显示提示而不是渲染浏览按钮。
