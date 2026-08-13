# SFTP 对账文件：倒序展示 + 当天缓存 设计

**日期**：2026-08-13
**范围**：`psp-path-dashboard` 的 SFTP 同步（对账文件）功能，以及其依赖的 `scripts/sftp-sync` 脚本。

## 背景

现有 SFTP 同步流程：前端点「浏览」→ 后端 `dispatchSftpWorkflow` → GitHub Actions 跑 `scripts/sftp-sync/index.mjs` 真连 SFTP → 结果提交到 `sftp-data` 分支 → 前端从 `raw.githubusercontent.com` 读取 `listing.json` / 单个 CSV。

两个体验问题：

1. **顺序问题**：列表按 SFTP 返回的原始顺序（升序）展示，但对账文件通常倒序看（最新在上）。
2. **性能问题**：对账文件一天才生成一次，但每次浏览/下载都跑一遍 action，慢。已经有当天数据时应直接复用。

## 核心设计：按凭证分子目录

在 `sftp-data` 分支里，产物从「扁平根目录」改为「按 credentialId 分子目录」：

```
sftp-data/
  <credentialId>/
    listing.json      ← { generatedAt: "2026-08-13", credentialId: "hkpsp", files: [...] }
    2026-08-11.csv
    2026-08-10.csv
    ...
```

好处：

- 不同凭证的产物天然隔离，换凭证时缓存自动 miss（读的是另一个路径），无需在内容里比对 credentialId。
- 下载文件也按凭证隔离，避免不同凭证同名 `2026-08-11.csv` 互相污染。

**旧的扁平结构**（根目录下的 `listing.json`/CSV）：不处理，共存废弃，下次跑 action 自动写入新结构。

## 功能 1：倒序展示

- 纯前端展示层排序：渲染前对 `store.files` 按 `name` 字符串**降序**排列。
- 文件名即日期（`2026-08-11.csv`），字符串降序 == 日期从新到旧。
- 不改脚本、不重跑 action，对已缓存列表也立即生效。

## 功能 2：缓存

### 列表缓存（按天）

- `listing.json` 内容新增两个字段（脚本写入）：
  - `generatedAt`：UTC `YYYY-MM-DD`，生成当天日期。
  - `credentialId`：来源凭证 id（冗余，便于调试）。
- `handleBrowse` 逻辑改为**缓存优先**：
  1. 先直接 GET `<credentialId>/listing.json`。
  2. 若 200 且 `generatedAt === 今天(UTC)` → 直接进 `browsing` 阶段展示，**不跑 action**。
  3. 若 404 / `generatedAt` 非今天 / 网络失败 → 触发 action（原流程）。
- 新增**「刷新」按钮**（`browsing` 阶段可见）：无条件重跑 action，绕过缓存，用于当天报表刚生成、想强制重拉的场景。

### 下载缓存（按存在性）

- 日报文件一旦生成，内容不变——所以「存在即有效」，**不做日期判断**。
- `handleSelectFile` 逻辑改为**缓存优先**：
  1. 先 GET `<credentialId>/<fileName>`。
  2. 若 200 → 直接渲染 CSV 表格，**不跑 action**。
  3. 若 404 → 触发 download action（原流程）。
- 工作流仅在成功时提交，故「文件存在」即代表一次成功下载，无需额外校验。

## 时区

脚本（GitHub Actions，UTC）和前端都用 **UTC** 判定「今天」：

- 脚本：`new Date().toISOString().slice(0, 10)`。
- 前端：同上。

日报一天一次，UTC 双端一致可避免跨午夜 off-by-one。已知可接受的边界：当天报表在 SFTP 上尚未生成、但用户当天已 list 过一次（缓存里没有今天的新文件），缓存命中会展示旧列表——「刷新」按钮可覆盖此场景。

## 受影响文件

| 文件 | 改动 |
|------|------|
| `scripts/sftp-sync/index.mjs` | 产物写入 `${OUTPUT_DIR}/${CREDENTIAL_ID}/` 子目录；`listing.json` 加 `generatedAt` + `credentialId` |
| `.github/workflows/sftp-sync.yml` | **无需改**（`cp -r output/. …/sftp-data/` 已保留子目录结构） |
| `psp-path-dashboard/src/lib/sftp-api.ts` | 所有 raw URL 带 `credentialId` 段；`fetchListing` 返回 `{ generatedAt, files }`；新增 `probeCachedFile` / `fetchCachedListing` 存在性与新鲜度探测 |
| `psp-path-dashboard/src/components/SftpSyncPanel.tsx` | 缓存优先的 browse/download、刷新按钮、按 name 降序排序 |
| `psp-path-dashboard/src/store/sftp-sync.ts` | 无实质改动（`setListing` 复用；缓存命中直接调用） |
| `paypal-backend-api/**` | **无需改**（credentialId 已透传） |

## 测试策略

- **脚本**：单测 `listing.json` 输出结构含 `generatedAt`（UTC 格式）与 `credentialId`，产物落在 credential 子目录。
- **前端 sftp-api**：单测 URL 拼接含 credentialId 段；`fetchCachedListing` 对 200-今天 / 200-陈旧 / 404 三种情况的返回。
- **前端 SftpSyncPanel**：单测缓存命中不触发 `triggerSftpSync`、缓存 miss 才触发；刷新按钮无条件触发；列表降序。
- **端到端手动验证**：换凭证 → 首次 browse 跑 action → 再次 browse 命中缓存秒开 → 刷新强制重跑 → 点文件缓存命中/未命中两条路径 → CSV 渲染。
