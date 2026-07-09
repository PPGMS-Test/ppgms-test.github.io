# PSP Path Playground — UI v2 改版设计

- **日期**：2026-07-09
- **作者**：Yuncong Qiang（+ Claude 协作 brainstorming）
- **状态**：待用户 review
- **前置**：本文档是对已实现的 PSP Path Playground（见 `2026-07-09-psp-path-playground-design.md` / `-plan.md`）的 UI + 请求架构改版。

## 1. 目标

让演练台从"后端拼 body、前端只看简化字段"升级为"**前端拥有完整请求、所见即所发**"，并聚焦在请求/响应本身：

1. 删掉独立的「概念讲解官」右侧 panel（概念太基础，不值得占一整栏）；概念内容降级为每步的**内联 Tips**。
2. 中间区回显**真实的 request body**（发给 PayPal 的完整 body），默认只读、可切换编辑、编辑时实时保存。
3. 回显**关键 request headers**（含可选的 PayPal-Auth-Assertion）。
4. 页面改为**左 + 中两栏**；响应区在请求执行后显示在**中栏 request 区下方**（不再有右栏）。

## 2. 已确认决策

| 维度 | 决策 |
|------|------|
| 请求来源 | 方案 B：**前端构建完整 body + headers**，经通用转发路由发出（所见即所发、可编辑） |
| 转发路由 | 新增 `paypal-backend-api/src/app/api/common/route.ts`；目标地址走 header，body 原样转发 |
| 现有 byok 路由 | **全部保留**（前端不拼 body 时仍可直接用） |
| Auth 步骤 | 例外：仍用现有 `byok/psp/access-token`（form-encoded + Basic auth + 返回 token 的特殊请求） |
| Request body 编辑 | **默认只读**（显示默认/生成值）；「编辑」按钮切换为可编辑 textarea；编辑模式**实时保存**；另有「重新生成」兜底 |
| Auth Assertion | 可选开关；打开时给**所有走 /common 的步骤（2–6）都加** `PayPal-Auth-Assertion` 头 |
| 概念内容 | `concepts.ts` **保留**，改为每步**内联 Tips**（用 `steps.ts` 的 `conceptKeys` 映射，每步 1–2 条） |
| 布局 | **左（StepRail）+ 中（Request 上 / Response 下）两栏**，删除右侧 ConceptPanel；flex，窄屏塌缩 |

## 3. 后端：通用转发路由 `/api/common`

**文件**：`paypal-backend-api/src/app/api/common/route.ts`（Edge Runtime，独立于 `byok/`）。

**契约**：
- 控制头：
  - `x-target-path`：PayPal 的 API path（如 `/v2/checkout/orders`）。**只接受 path**，后端用 `PAYPAL_SANDBOX_BASE`（`https://api-m.sandbox.paypal.com`）拼成完整 URL。
  - `x-target-method`：转发用的 HTTP method，默认 `POST`。
- **body**：请求 body 原样转发给 PayPal（`POST`/`PATCH` 等有 body 时）。
- **透传头**：把入站请求里以下头原样转给 PayPal（存在才转）：`Authorization`、`Content-Type`、`Prefer`、`PayPal-Partner-Attribution-Id`、`PayPal-Auth-Assertion`、`PayPal-Request-Id`。控制头（`x-target-*`）与 hop-by-hop/host 头不转发。
- **返回**：`corsJson(paypalJson, paypalStatus)`——PayPal 响应原样带回。
- 支持 `OPTIONS`（CORS 预检）。

**安全（SSRF 防护）**：`x-target-path` 必须以 `/` 开头且不包含协议/host；后端只拼 `PAYPAL_SANDBOX_BASE + path`。若传入的是完整 URL 或指向非 sandbox host，返回 400。绝不按调用方给的任意 host 发起请求。

**CORS**：`paypal-backend-api/src/lib/cors.ts` 的 `Access-Control-Allow-Headers` 增补：`x-target-path, x-target-method, Prefer, PayPal-Partner-Attribution-Id, PayPal-Auth-Assertion, PayPal-Request-Id`（保留已有 `Content-Type, Authorization, x-paypal-bn-code`）。`Access-Control-Allow-Methods` 增补 `PATCH`（当前用 POST/GET，留余量）。

**psp.ts**：保持不变（现有 `byok/psp/*` 路由仍依赖它）。仅新增 `/api/common`，不删旧逻辑。

## 4. 前端：请求构建前移

### 4.1 新文件
- `src/lib/psp-requests.ts`：把请求 body 模板搬到前端（内容与后端 `psp.ts` 的 build 函数一致）：
  - `buildPartnerReferralBody(trackingId, returnUrl)`
  - `buildOrderBody({ amount, currency, payeeEmail, referenceId })`
  - `buildReferencedPayoutBody(captureId)` → `{ reference_type: 'TRANSACTION_ID', reference_id: captureId }`
  - `buildRefundBody()` → `{}`
  - 每个返回 JS 对象；UI 用 `JSON.stringify(obj, null, 2)` 展示。
- `src/lib/auth-assertion.ts`：移植自 `applepay-dashboard/src/lib/auth-assertion.ts`，生成 `PayPal-Auth-Assertion` JWT：`base64url({"alg":"none","typ":"JWT"}) + "." + base64url({"iss": clientId, "payer_id": payerId}) + "."`（无签名，PayPal 允许 alg=none 的 partner assertion）。签名 `generateAuthAssertion(clientId: string, payerId: string): string`。

### 4.2 `api.ts` 改造
- 保留 `fetchAccessToken()`（走 `byok/psp/access-token`，不变）。
- 新增核心：
  ```
  callCommon(targetPath, { method='POST', body, token, bnCode, authAssertion }): ApiResult
  ```
  组装并 POST 到 `${PROXY_BASE}/api/common`，headers：`x-target-path`、`x-target-method`、`Authorization: Bearer <token>`、`Content-Type: application/json`、`Prefer: return=representation`、（有 bnCode）`PayPal-Partner-Attribution-Id`、（有 authAssertion）`PayPal-Auth-Assertion`；body 为传入的原始 JSON 字符串。
- 移除旧的 `createPartnerReferral/createOrder/captureOrder/disburse/refund`（改由 StepDetail 组装 body 后统一走 `callCommon`）。各步的 targetPath：
  - onboarding → `/v2/customer/partner-referrals`
  - createOrder → `/v2/checkout/orders`
  - capture → `/v2/checkout/orders/{orderId}/capture`
  - disburse → `/v1/payments/referenced-payouts-items`
  - refund → `/v2/payments/captures/{captureId}/refund`

### 4.3 flow store 扩展（`src/store/flow.ts`）
新增：
- `config.payerId: string`（默认 `DEFAULT_PAYER_ID`）
- `config.authAssertionEnabled: boolean`（默认 `false`）
- `requestBodies: Partial<Record<StepId, string>>`：每步（可编辑的）原始 JSON body 字符串。
- `bodyEditing: Partial<Record<StepId, boolean>>`：每步编辑模式开关。
- actions：`setRequestBody(step, raw)`（编辑实时保存）、`setBodyEditing(step, on)`、`regenerateBody(step, raw)`（用生成值覆盖）。
- `reset()` 一并清空以上。

### 4.4 credentials store
不变（clientId/clientSecret/bnCode 已在）。auth assertion 用 `clientId`（来自 credentials）+ `config.payerId`（flow store）生成。

## 5. UI 布局与组件

### 5.1 两栏
`PlaygroundPage` 改为：
```
┌───────────────┬───────────────────────────────────────────┐
│ TopBar (全宽)                                                │
├───────────────┼───────────────────────────────────────────┤
│ StepRail      │  中栏（唯一主内容区，纵向堆叠）：            │
│ (左)          │   • 步骤标题 + FundFlowBar                   │
│               │   • 内联 Tips（该步 conceptKeys 对应 1–2 条）│
│               │   • Request 区                              │
│               │   • Response 区（发送后出现在下方）          │
└───────────────┴───────────────────────────────────────────┘
```
flex：`lg` 及以上 = 左栏(固定宽) + 中栏(flex-1)；`lg` 以下 = 左栏塌成顶部横向滚动条，中栏纵向堆叠。**右侧 ConceptPanel 删除**。

### 5.2 组件变化
- **删除** `src/components/ConceptPanel.tsx`。
- **新增** `src/components/StepTips.tsx`：读 `conceptsFor(step.conceptKeys)`，紧凑内联展示（标题 + 一句话 + `§` 章节号；可折叠），不占独立栏。
- **改写** `src/components/StepDetail.tsx`：
  - 结构化输入：金额/币种/payee email/tracking/**payer_id 输入** + **Auth Assertion 开关**（改这些字段时通过 `regenerateBody` 刷新对应步骤的 body 字符串）。
  - **Request body 卡**：
    - 默认**只读** `<pre>` 展示 `requestBodies[step]`（初次进入若无则由 `buildXBody(config)` 生成并存入）。
    - 「编辑」按钮 → 切成 `<textarea>`，`onChange` 调 `setRequestBody`（**实时保存**）。
    - 「重新生成」按钮 → 用当前结构化字段重建 body 覆盖（兜底）。
    - Auth / Onboarding / Disburse / Refund 中 body 为空或不可编辑的步骤按其性质处理：capture/refund body 为 `{}` 或无 body，仍展示（capture 无 body、refund `{}`）。
  - **Headers 回显卡**：列出将发送的关键头及其值——`Authorization: Bearer <token 前若干位…>`（token 存在才显示；默认部分打码，见 §7）、`Content-Type`、`Prefer`、（bnCode 有）`PayPal-Partner-Attribution-Id`、（开关开）`PayPal-Auth-Assertion: <jwt>`。
  - **发送**：`runStep` 组装 targetPath + 当前 `requestBodies[step]`（解析为 JSON；解析失败则报错提示）+ headers（含按开关生成的 auth assertion），调用 `callCommon`；产出（orderId/captureId/refundId）串联逻辑不变。
  - **Response 区**：在 Request 区下方，发送后展示响应 JSON + status（沿用现有 `responses`/`stepStatus`）。

### 5.3 icons
沿用 lucide-react；编辑按钮 `Pencil`、重新生成 `RotateCcw`、Tips `Lightbulb` 或 `Info`。无 emoji。

## 6. 各步骤 body / 是否走 /common 一览

| 步 | 路由 | body（前端构建） | Auth Assertion（开关开时） |
|----|------|------------------|----------------------------|
| Auth | `byok/psp/access-token`（保留） | 无（Basic auth） | 否 |
| Onboarding | `/common` → `/v2/customer/partner-referrals` | partner referral body | 是（都挂） |
| Create Order | `/common` → `/v2/checkout/orders` | order body | 是 |
| Capture | `/common` → `/v2/checkout/orders/{orderId}/capture` | 无 body | 是 |
| Disburse | `/common` → `/v1/payments/referenced-payouts-items` | `{reference_type,reference_id}` | 是 |
| Refund | `/common` → `/v2/payments/captures/{captureId}/refund` | `{}` | 是 |

## 7. 安全 / 敏感值处理

- `/api/common` 仅转发到 sandbox host（§3）。
- Headers 回显里 `Authorization` 的 Bearer token 默认**部分打码**（显示前后若干字符），避免整串 token 直接铺在屏幕上；提供一个"显示完整"的小开关（sandbox 学习工具，允许查看）。`PayPal-Auth-Assertion` 为 alg=none 的非签名 JWT，可完整显示。
- 默认凭证仍来自 `config/default-credentials.ts`（sandbox）。

## 8. 测试

- **后端** `src/app/api/common/route.ts`：mock `fetch` 单测——(a) 正常 path 拼成 `PAYPAL_SANDBOX_BASE+path` 并透传 method/body/白名单 headers；(b) 传入非 sandbox host / 带协议的 path → 400；(c) `OPTIONS` 返回 CORS 头。
- **前端** `src/lib/psp-requests.ts`：纯函数单测（body 结构，含 partner referral 的 `DELAY_FUNDS_DISBURSEMENT`、referenced-payout 的 `TRANSACTION_ID`）。
- **前端** `src/lib/auth-assertion.ts`：单测——JWT 三段式、payload 解码出 `iss`/`payer_id`。
- **前端** flow store：`requestBodies`/`bodyEditing`/新 config 字段的读写 + `reset` 清空。
- 既有 store/psp 单测保持绿；手动 sandbox E2E 由用户走一遍（含 Auth Assertion 勾/不勾对比）。

## 9. 非目标（YAGNI）

- 不删除 `psp.ts` 与现有 `byok/psp/*` 路由（保留可直用）。
- `/api/common` 不做通用鉴权/限流/多环境（仅 sandbox host 白名单）。
- 结构化字段 ↔ 原始 JSON 不做持续双向同步：字段是初值/重生成来源，原始 JSON 编辑后即为最终真相（"重新生成"可回退）。
- 不改 Auth 步骤的实现（保留 access-token 专用路由）。

## 10. 交付顺序（供 writing-plans 展开）

1. 后端 `/api/common` 路由 + CORS 增补 + mock 单测
2. 前端 `psp-requests.ts` + `auth-assertion.ts`（+ 单测）
3. flow store 扩展（config.payerId/authAssertionEnabled、requestBodies/bodyEditing/actions）（+ 单测）
4. `api.ts` 改造为 `callCommon`（保留 fetchAccessToken）
5. `StepTips.tsx` 新增；删除 `ConceptPanel.tsx`
6. `StepDetail.tsx` 改写（结构化输入 + 可编辑 body + headers 回显 + response 下移）
7. `PlaygroundPage.tsx` 改两栏 flex 布局
8. 构建/测试 + 手动 sandbox E2E + push 提醒（本次也动了 `paypal-backend-api/`）
