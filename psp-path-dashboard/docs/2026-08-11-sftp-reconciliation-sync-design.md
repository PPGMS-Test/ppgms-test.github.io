# SFTP 对账文件同步 — 设计文档

## 背景与问题

`psp-path-dashboard` 需要从一个公网可访问的 SFTP 服务器上获取对账用的 CSV 文件（sandbox 测试数据，非生产敏感数据）。浏览器 JS 无法直接建立 SFTP（基于 SSH 的 TCP 协议）连接，必须有后端桥接。

### 关键约束

- **部署目标必须免费**。
- **点击后需要"即时"拉取最新数据**（而非定时任务刷新的静态数据）。
- 本仓库现有的 `paypal-backend-api` 部署在 Cloudflare Pages（Edge Runtime）。Edge Runtime 虽有 `cloudflare:sockets` 可建立裸 TCP 连接，但主流 SFTP 库（`ssh2` / `ssh2-sftp-client`）依赖 Node.js 的 `net`/`tls` 模块，在 Edge Runtime 下无法直接运行。
- 公司网络已确认封锁 `*.workers.dev` 和 `*.vercel.app` 域名，因此无法使用 Vercel Serverless Function（真正的 Node.js runtime）作为退路。
- `github.com` / `api.github.com` / `raw.githubusercontent.com` 在公司网络下必然可访问（本仓库的日常 git 操作和 GitHub Pages 部署依赖它们）。
- 本仓库（`ppgms-test.github.io`）是 **public** 仓库，但用户已确认对账数据是 sandbox 测试数据，可以接受落到仓库里。
- 本项目定位是展示用 demo，用户已确认 SFTP 账号密码可以直接硬编码在代码中（不使用 GitHub Secrets）。GitHub PAT 例外——它拥有触发本仓库 workflow 的写权限，仍需存为 Cloudflare Pages 加密环境变量，不硬编码、不提交进仓库。

### 结论

在完全免费的前提下，无法在 Cloudflare/Vercel 等免费 Edge 平台上跑通真正的 SFTP 客户端。改用 **GitHub Actions** 作为"重活"执行环境（完整 Ubuntu + Node.js runtime，无 Edge 限制，域名必然可访问），`paypal-backend-api` 只承担"触发 + 查询状态"的控制面角色。这带来的代价是响应时间不是毫秒级，而是一次 GitHub Actions run 的耗时（预期 15～40 秒），用户已确认可以接受。

## 架构总览

```
psp-path-dashboard (浏览器)
   │ 1. 点击"浏览 SFTP 目录" / 选择文件下载
   ▼
paypal-backend-api (Cloudflare Pages, 控制面)
   │ 2. 用服务端保存的 GitHub PAT 调用 GitHub API 触发 workflow_dispatch
   ▼
GitHub Actions: sftp-sync.yml (ubuntu-latest, 完整 Node.js 环境)
   │ 3. 用 ssh2-sftp-client 连接 SFTP，list 目录 或 下载指定文件
   │ 4. 结果写成 JSON/CSV，提交到独立的 sftp-data 分支
   ▼
psp-path-dashboard 轮询 run 状态 → 完成后
直接从 raw.githubusercontent.com 读取 sftp-data 分支上的产物（公开仓库，无需认证）
```

分层原则：GitHub PAT 只存在服务端（Cloudflare 加密环境变量），从不下发到浏览器。SFTP 账号密码直接硬编码在 `scripts/sftp-sync.mjs` 源码中（demo 项目 + sandbox 数据，用户已确认接受）。前端与后端之间不传递任何 SFTP/GitHub 凭证。

## 组件详情

### 1. GitHub Actions workflow：`.github/workflows/sftp-sync.yml`

- 触发方式：`workflow_dispatch`，输入参数：
  - `action`：`list` | `download`
  - `remote_path`：`download` 时必填，SFTP 上的目标文件路径
  - `client_request_id`：调用方生成的唯一标识，用于关联轮询结果
- `run-name: sftp-sync-${{ inputs.client_request_id }}`，使轮询方能精确匹配到自己触发的那次 run，避免多次点击时张冠李戴
- `concurrency: { group: sftp-sync, cancel-in-progress: false }`，防止并发写坏产物分支
- 权限：`contents: write`（提交产物到 `sftp-data` 分支需要）
- SFTP 连接参数（host、port、username、password、remote_dir）直接硬编码在 `scripts/sftp-sync.mjs` 中，不使用 GitHub Secrets。本项目是展示用 demo，且数据是 sandbox 测试数据，用户已确认接受此简化（代价：这些凭证会随源码在 public 仓库中公开可见）
- 核心逻辑封装在 `scripts/sftp-sync.mjs`，用 `ssh2-sftp-client`：
  - `list` 模式：连接、列出 `SFTP_REMOTE_DIR` 下的文件，写出 `listing.json`（包含文件名、大小、修改时间）
  - `download` 模式：下载 `remote_path` 指定的文件，原样落盘为对应文件名
- 最后一步把产物提交到独立的 **`sftp-data` 分支**（不是 `master`），避免每次同步触发 `deploy.yml` 的整站重新构建部署（`deploy.yml` 只监听 `push: branches: [master]`）

### 2. `paypal-backend-api` 新增接口

- `POST /api/sftp/trigger`
  - 请求体：`{ action: 'list' | 'download', remotePath?: string }`
  - 生成 `client_request_id`（UUID），调用 GitHub Workflow Dispatch API 触发 `sftp-sync.yml`
  - 返回 `{ requestId }` 给前端
- `GET /api/sftp/status?requestId=`
  - 用 `run-name` 匹配对应的 workflow run（`GET /repos/{owner}/{repo}/actions/runs`，按 `name` 过滤）
  - 返回 `{ status: 'queued' | 'in_progress' | 'completed', conclusion?: 'success' | 'failure' }`
- GitHub PAT 存为 Cloudflare Pages 加密环境变量，权限范围仅需 `actions:write`（触发 + 查询 run 状态）
- 两个接口都不读取/转发 SFTP 数据本身——数据由前端直接从 `raw.githubusercontent.com` 拉取（公开仓库，无需认证，减少一层代理）

### 3. `psp-path-dashboard` 新增页面/区块："对账文件同步"

- 【浏览 SFTP 目录】按钮
  - 调用 `POST /api/sftp/trigger`（`action: 'list'`）
  - 轮询 `GET /api/sftp/status`，展示 loading 态（带已用时长提示，如"同步中…（12s）"）
  - 完成后：拉取 `raw.githubusercontent.com/.../sftp-data/listing.json`，展示文件列表（名称/大小/修改时间）
- 点击列表中某文件
  - 调用 `POST /api/sftp/trigger`（`action: 'download'`, `remotePath`）
  - 同样的轮询 loading 态
  - 完成后：
    - 拉取对应文件内容，客户端解析 CSV 并渲染成表格展示在页面内
    - 同时提供"下载"按钮（可直接链接到 `raw.githubusercontent.com` 上的原文件，或用解析后的内容生成 Blob 触发浏览器下载）
- 失败态：GitHub Actions run 的 `conclusion === 'failure'`（如密码错误、SFTP 连接超时）→ 展示错误信息 + 【重试】按钮

## 数据流小结

用户点击 → 一次 list 往返（~15-40s）→ 看到文件列表 → 点击某文件 → 一次 download 往返（~15-40s）→ 页面内表格展示 + 下载按钮。全程无需常驻服务器、无需访问被封的域名；GitHub PAT 存在 Cloudflare 加密环境变量中不经过浏览器，SFTP 账号密码硬编码在源码中（demo + sandbox 数据场景下用户已接受）。

## 错误处理

| 场景 | 处理方式 |
|------|----------|
| GitHub Actions run 排队/运行超时（如 > 2 分钟） | 前端轮询设置超时上限，超时后提示"同步超时，请重试" |
| SFTP 连接失败（凭证错误/网络不通） | workflow run 以非零退出码结束，`conclusion = failure`，前端展示具体错误摘要 + 重试按钮 |
| GitHub API 触发失败（PAT 过期/权限不足） | `paypal-backend-api` 的 `/api/sftp/trigger` 返回 5xx，前端直接展示"触发失败，请检查后端配置" |
| CSV 解析失败（格式异常） | 表格区域展示"无法解析该文件"，但仍保留【下载】按钮，用户可下载原始文件自行查看 |

## 测试策略

- `scripts/sftp-sync.mjs`：依赖真实网络连接，不做自动化单元测试；用真实 sandbox SFTP 凭证手动触发一次 workflow 做验证
- `paypal-backend-api` 的 `/api/sftp/trigger`、`/api/sftp/status`：mock GitHub REST API 响应，做单元测试覆盖成功/失败/超时分支
- `psp-path-dashboard` 前端：
  - CSV 解析 + 表格渲染：用固定样例 CSV 内容做 vitest 单测
  - 轮询状态机（loading → success/failure）：mock fetch 做组件测试

## 范围之外（Out of scope）

- 不支持私钥认证（当前只需账号密码）
- 不支持多个 SFTP 服务器/多套凭证配置
- 不做对账数据的业务逻辑处理（比对、汇总等），仅负责"拉取并展示原始 CSV"
