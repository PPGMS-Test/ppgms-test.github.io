# PSP Path Playground — 设计文档

- **日期**：2026-07-09
- **作者**：Yuncong Qiang（+ Claude 协作 brainstorming）
- **状态**：待用户 review

## 1. 背景与目标

公司关于 **PSP Path** 的三份材料（`enhance-context-page/`）对使用者来说过于复杂：

- `PSP Path – Configuration & Onboarding Guide ….mhtml`（16 章 + FAQ 的完整概念文档）
- `PSP Path 2.0 - Knowly ….mhtml`（知识库）
- `PSP PATH Collection - HK.postman_collection 1.json`（真实 API collection）

**目标**：做一个**交互式分步演练台（playground）**，让使用者通过"照着真实 API 流程一步步点、每步配中文讲解"的方式，直观理解 PSP Path 的资金流、角色分工与核心概念（PSA / ELMO / BN code / Consent / delay disbursement）。

playground 本身即是那份 Guide 的**可交互索引**：每一步都标注"对应文档第几节"。

### PSP Path 一句话理解（来自 Guide §1）

PSP Path 是 PayPal 的一种集成模式：持牌 PSP 从 PayPal 拿到结算资金，自己负责给下游商户打款并**承担全部风险**（退款/争议/拒付）。是 Connected Path 的升级版。三段式资金流：

1. **PayPal 收款**：买家用 PayPal/Guest(BCDC)/Pay Later 付款，钱进商户 PayPal GL（商户余额保持 $0）
2. **PayPal 划款给 PSP**：自动把钱从商户 GL 划到 PSP 的 **PSA（Partner Settlement Account，Type 5 omnibus 账户）**，每日 EOD sweep 到 PSP 银行账户
3. **PSP 打款 + 担风险**：PSP 聚合资金、用自己的通道付给卖家，并对退款/争议/拒付负全责

## 2. 已确认的决策（brainstorming 结论）

| 维度 | 决策 |
|------|------|
| 核心形态 | **API 流程分步演练台**（照 Postman collection 一步步点） |
| 数据来源 | **真实 sandbox 调用**（不是 mock） |
| 流程范围 | **主链路 Capture Intent 全程**：Auth → Onboarding → Create Order → Capture → Disburse → Refund（Auth Intent 分支、Webhooks 暂不做） |
| 凭证方式 | **BYOK**：页面手动粘贴 client id/secret，存 sessionStorage，不写进代码 |
| token 处理 | **方案 A**：显式 Token 步骤作为第 1 步，完全对齐 Postman；access_token 在前端 flow 内串联复用（sandbox 学习工具可接受） |
| 前端栈 | 纯前端 React 18 + Vite 5 + TS + Tailwind（自己无后端，复用 `paypal-backend-api`），对齐 applepay/bopis |
| 配套工具链 | `class-variance-authority` + `clsx` + `tailwind-merge` + `tailwindcss-animate` + `lucide-react`（沿用现有 dashboard 的 shadcn 风格） |
| 状态管理 | **zustand**（先例：`applepay-dashboard/src/store/credentials.ts` 就是 zustand BYOK store） |
| 路由 | **react-router-dom**（因为凭证管理是独立 sub-page） |
| 图标 | 全部 **lucide-react 线条图标，禁用 emoji**；lucide 缺时才补 `@tabler/icons-react` |
| 布局 | **移动端优先 + flex**，三栏窄屏塌缩单列 |

## 3. 架构

### 3.1 Monorepo 定位

```
ppgms-test.github.io/
├── psp-path-dashboard/    ← 新增：纯前端 playground（本设计主体）
├── paypal-backend-api/    ← 复用：Next.js(Edge) 代理，补 3 个 PSP 端点
└── pnpm-workspace.yaml    ← 加入 psp-path-dashboard
```

新 subrepo 加入 `pnpm-workspace.yaml` 的 `packages` 列表。

### 3.2 后端（`paypal-backend-api` 复用 + 新增）

**复用现有能力**（`src/lib/paypal-rest.ts`）：`PAYPAL_SANDBOX_BASE`、`parseBasicAuth`（BYOK 取 client id/secret）、`getAccessToken`、`createOrder`、`captureOrder`、`getClientToken`；`cors.ts` 的 `corsJson`/`corsOptions`。

**新增 route（全部 `runtime = 'edge'`，走 BYOK/`parseBasicAuth`，风格照 `byok/` 现有 route）：**

| 步骤 | 新增 route | 打的 PayPal 接口 | 状态 |
|------|-----------|-----------------|------|
| ① Auth | 复用 `byok/auth`（换发 OAuth access_token；如现有只发 client-token，则补一个 `byok/auth/access-token`） | `POST /v1/oauth2/token` (client_credentials) | 复用/薄补 |
| ② Onboarding | `POST /api/byok/psp/partner-referrals` | `POST /v2/customer/partner-referrals` | **新增** |
| ③ Create Order | 复用/薄封装 `createOrder`（PSP 专属 body：payee/platform_fees 等） | `POST /v2/checkout/orders` | 薄补 |
| ④ Capture | 复用 `captureOrder` 的 BYOK 版 | `POST /v2/checkout/orders/{id}/capture` | 复用 |
| ⑤ Disburse | `POST /api/byok/psp/referenced-payouts-items` | `POST /v1/payments/referenced-payouts-items` | **新增** |
| ⑥ Refund | `POST /api/byok/psp/captures/[captureId]/refund` | `POST /v2/payments/captures/{id}/refund` | **新增** |

**共享逻辑**：`src/lib/psp.ts` —— PSP 专属 request body 模板（partner-referral 的 features 列表、referenced-payouts-items 的 `{reference_type:"TRANSACTION_ID", reference_id}` 等，取自 Postman collection）+ 讲解用注释。

> ⚠️ **动了 `paypal-backend-api`**：按用户偏好（[[feedback_push_reminder]]），实现完成后必须**明确提醒用户 push**。

### 3.3 前端 subrepo 结构

```
psp-path-dashboard/
├── index.html
├── vite.config.ts / tailwind.config.ts / postcss.config.js / tsconfig*.json
├── package.json
├── public/favicon.svg
└── src/
    ├── main.tsx                 ← react-router-dom 挂载
    ├── App.tsx                  ← 路由：/ 演练台, /credentials 凭证页
    ├── index.css                ← Tailwind + 主题 CSS 变量(paper/ink/accent/ok)
    ├── store/
    │   ├── credentials.ts       ← zustand: BYOK client id/secret (sessionStorage)
    │   └── flow.ts              ← zustand: accessToken→merchantId→orderId→captureId→refundId + 每步状态
    ├── lib/
    │   ├── api.ts               ← 调 paypal-backend-api 的封装（带 BYOK Basic auth）
    │   ├── steps.ts             ← 6 步定义(名称/图标/接口/请求模板/文档§号)
    │   └── concepts.ts          ← 预置概念讲解内容(PSA/ELMO/BN code/Consent…) 从 Guide 提炼
    ├── pages/
    │   ├── PlaygroundPage.tsx   ← 三栏主页面
    │   └── CredentialsPage.tsx  ← BYOK 凭证管理 sub-page
    └── components/
        ├── TopBar.tsx           ← logo + 流程 tab + KeyRound 入口 + Sandbox 状态点
        ├── StepRail.tsx         ← 左：竖向步骤流(分组/状态/§号)
        ├── FundFlowBar.tsx      ← 中顶：资金流条 Buyer→GL→PSA→PSP→Seller
        ├── StepDetail.tsx       ← 中：讲解卡 + 请求预览卡(可编辑) + 响应卡
        ├── ConceptPanel.tsx     ← 右：概念讲解官(卡片 + §号 + 折叠问答)
        └── ui/                  ← Badge / Card / Button (CVA + clsx + tailwind-merge)
```

## 4. UI 设计（套用 OFFROUTE.AI 视觉语言）

### 视觉 DNA
米色纸张底 + 深藏青墨色 + 红色点缀 + 细边框圆角卡片 + 年鉴/编辑感排版 + 三栏布局。

主题 CSS 变量：`--paper`(米底) / `--ink`(藏青，主色) / `--accent`(红：风险/PSP 担责/警告) / `--ok`(绿：成功响应)。

### 三栏布局（桌面）

```
┌─────────────────────────────────────────────────────────────────────┐
│ [logo] PSP Path Playground   [Capture Intent]      [KeyRound] ●Sandbox│ TopBar
├───────────────┬─────────────────────────────────────┬────────────────┤
│ StepRail      │  FundFlowBar: Buyer→GL→[PSA]→PSP→Seller│ ConceptPanel   │
│ (facet 风格)  │  ┌───────────────────────────────────┐│ (讲解官)        │
│ AUTH          │  │ 讲解卡：干什么/钱在哪/谁担风险      ││ [BookOpen]     │
│  ① Get token  │  └───────────────────────────────────┘│ ┌────────────┐ │
│ ONBOARDING    │  ┌───────────────────────────────────┐│ │ PSA 是什么 │ │
│  ② Partner    │  │ 请求预览卡(可编辑关键字段)         ││ │ §10        │ │
│ ORDER         │  └───────────────────────────────────┘│ └────────────┘ │
│  ③ Create     │  [发送] → ┌────────────────────────┐  │ 折叠问答:       │
│  ④ Capture    │          │ 响应卡(高亮串联字段)    │  │ › 为什么先到PSA│
│ MONEY MOVE    │          └────────────────────────┘  │ › BN code 干嘛 │
│  ⑤ Disburse   │                                       │                │
│  ⑥ Refund     │                                       │                │
└───────────────┴─────────────────────────────────────┴────────────────┘
```

### Reference → 演练台 映射

| OFFROUTE.AI 元素 | 演练台 |
|---|---|
| 左侧 filter facet（分组 + checkbox） | **StepRail**：6 步按阶段分组(AUTH/ONBOARDING/ORDER/MONEY MOVE)，每步带编号、状态图标(CircleCheck/CircleX/LoaderCircle)、文档 §号 |
| 中间 bordered 圆角卡片行 | **StepDetail**：讲解卡 → 请求预览卡(可编辑) → 响应卡(高亮串联字段) + 顶部 **FundFlowBar** 当前段高亮 |
| 右侧企鹅助手聊天面板 | **ConceptPanel**：当前步骤相关概念卡片(PSA/ELMO/BN code/Consent) + "对应文档 §x" + 折叠"为什么"问答。**预置静态内容，不接 LLM** |
| 1A/1C/PC6 badge | 语义色 Badge：藏青=流程步骤 / 红=风险担责 / 绿=成功 |
| 顶栏 tabs + EN + 按钮 | **TopBar**：logo + 流程 tab(先只 Capture Intent) + KeyRound 凭证入口 + Sandbox 环境状态点 |

### 移动端（flex，窄屏塌缩单列）
- StepRail → 顶部横向可滑步骤条
- StepDetail → 主区
- ConceptPanel → 折叠成抽屉/底部展开

### 图标（全 lucide-react，禁 emoji）
KeyRound(凭证) · Store(onboarding) · ShoppingCart(下单) · HandCoins/Banknote(打款) · Landmark(PSA) · ArrowLeftRight(划转) · RefreshCw(退款) · ShieldCheck(风险) · CircleCheck/CircleX/LoaderCircle(状态) · ChevronRight(折叠) · BookOpen(讲解官)。

## 5. 状态与数据流（zustand）

**`credentials` store**（sessionStorage 持久化）：`clientId` / `clientSecret` / `isValid`。凭证管理页增删校验；`api.ts` 每次请求组装成 Basic auth 传给 backend。

**`flow` store**：
```
accessToken   ← ① Auth 产出
merchantId    ← ② Onboarding 产出 (tracking_id → merchant_id)
orderId       ← ③ Create Order 产出
captureId     ← ④ Capture 产出
refundId      ← ⑥ Refund 产出
stepStatus[]  ← 每步: idle | running | success | error + 响应原文
```
每步"发送"成功后把产出写入 store，下一步请求模板自动读取串联。四个面板都用 selector 订阅，避免全量重渲染。

## 6. 概念讲解内容来源

`lib/concepts.ts` 的讲解文字从 `Configuration & Onboarding Guide` 提炼，覆盖：三段式资金流(§1)、PSP vs Connected Path(§1)、1.0→2.0(§3)、风险责任(§4)、PSA/Type5/BN code(§10)、USET/SEAL 11 preferences(§8)、ELMO(§9)、Merchant Consent(§11)、Key Definitions(§13)。每条附对应 §号，形成"文档可交互索引"。

## 7. 测试策略

- **后端新 route**：mock `fetch` 单测，校验目标 URL / body / Basic auth 组装正确，不依赖真实网络。
- **前端**：`flow` store 串联逻辑单测（上一步产出正确喂给下一步的请求模板）；`credentials` store sessionStorage 读写单测。
- **真实 sandbox 端到端**：由用户手动点一遍主链路验证（需真实 PSP sandbox 凭证）。

## 8. 非目标（YAGNI）

- Auth Intent 分支、Webhooks（后续分阶段再补）
- LLM 驱动的可提问助手（本期 ConceptPanel 为预置静态问答）
- 生产环境凭证 / live 调用（仅 sandbox）
- 部署到 GitHub Pages 的自动化（本期先本地 `pnpm dev` 跑通；后端仍走 paypal-backend-api）

## 9. 交付顺序（供后续 writing-plans 展开）

1. 脚手架：`psp-path-dashboard` Vite 工程 + 加入 workspace + 主题/工具链
2. 后端 3 个新 route + `lib/psp.ts` + mock 单测
3. store（credentials / flow）+ `lib/api.ts` + `lib/steps.ts`
4. 凭证 sub-page（CredentialsPage）
5. 三栏骨架（TopBar / StepRail / StepDetail / FundFlowBar / ConceptPanel）+ 移动端塌缩
6. `lib/concepts.ts` 讲解内容填充
7. 真实 sandbox 端到端手测 + push 提醒
