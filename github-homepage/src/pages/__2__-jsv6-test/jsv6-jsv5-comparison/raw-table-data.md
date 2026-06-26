
# PayPal JS SDK v6 vs v5

## A. 产品功能覆盖指标

| 功能 | v6 | v5 |
|------|----|----|
| PayPal Wallet | ✅ | ✅ |
| Pay Later | ✅ | ✅ |
| Pay Later Message | ✅（cross-border-messaging） | ✅ |
| BCDC Standalone Button | ✅（inline/auto expansion有问题） | ✅ |
| ACDC 信用卡支付 | ✅ | ✅ |
| Apple Pay | ✅ | ✅ |
| Google Pay | ✅ | ✅ |
| APM | 已发布6个 | ✅ |
| Vault / Fastlane | ✅（必须用 clientToken 初始化） | ✅ |

## B. 产品技术性能指标

| 指标 | v6 | v5 |
|------|----|----|
| PayPal买家支付体验 | ✅ 支持所有主流浏览器行为 | 不支持Payment Handler、Redirect等新特性 |
| 开发者友好程度 | ✅ 代码可读性高，与Stripe/Apple Pay/Google Pay规范一致 | 未引入Payment Session概念 |
| 加载速度 | ✅ 资源包仅v5的12% | — |
| 代码实现 | ✅ 支持模块化设计，加载几乎瞬间 | — |
| UI兼容性 | ✅ 使用Shadow DOM，对iframe更友好 | 无法做到iframe的嵌套 |
| 定制化 | ✅ 可以使用客制化的按钮 | 必须使用PayPal按钮 |




---






# PayPal JS SDK v6 vs v5

## A. 产品功能覆盖指标

| 功能                     | v6                                      | v5           |
|--------------------------|-----------------------------------------|--------------|
| PayPal Wallet            | ✅                                       | ✅            |
| Pay Later                | ✅                                       | ✅            |
| Pay Later Message        | ✅ <br><sub>已支持跨境消息 (cross-border-messaging)</sub> | ✅            |
| BCDC Standalone Button   | ❌ <br><sub>inline 模式下 auto expansion 有问题</sub> | ✅            |
| ACDC 信用卡支付          | ✅                                       | ✅            |
| Apple Pay                | ✅                                       | ✅            |
| Google Pay               | ✅                                       | ✅            |
| APM（本地支付方式）      | 已发布 6 个                              | ✅            |
| Vault / Fastlane         | ✅ <br><sub>必须使用 <code>clientToken</code> 初始化</sub> | ✅            |

## B. 产品技术性能指标

| 指标                 | v6                                                                 | v5                                     |
|----------------------|--------------------------------------------------------------------|----------------------------------------|
| PayPal 买家支付体验   | <span style="color:#2e7d32; font-weight:bold">✅ 支持所有主流浏览器行为</span> | 不支持 Payment Handler、Redirect 等新特性 |
| 开发者友好程度        | <span style="color:#2e7d32; font-weight:bold">✅ 代码可读性高，与 Stripe/Apple Pay/Google Pay 规范一致</span> | 未引入 Payment Session 概念             |
| 加载速度             | <span style="color:#2e7d32; font-weight:bold">✅ 资源包仅 v5 的 12%</span>     | —                                      |
| 代码实现             | <span style="color:#2e7d32; font-weight:bold">✅ 支持模块化与设计模式，加载近乎瞬时</span> | —                                      |
| UI 兼容性            | <span style="color:#2e7d32; font-weight:bold">✅ 使用 Shadow DOM，对 iframe 更友好</span> | 无法嵌套 iframe                        |
| 定制化               | <span style="color:#2e7d32; font-weight:bold">✅ 支持自定义按钮样式</span>      | 必须使用 PayPal 官方按钮               |

---

## C. 认证模型（v6 新变化）

> v6 SDK 6.54.5 起，`paypal.createInstance()` 同时支持 `clientId` 和 `clientToken`，二者**互斥**（同时传入会抛 `must provide only clientToken or clientId`）。

| 维度 | v6 — clientId 模式 | v6 — clientToken 模式 | v5 |
|------|--------------------|------------------------|----|
| 适用场景 | Wallet / ACDC / BCDC / Apple Pay / Google Pay / Pay Later / APM | **Vault、Fastlane 必须**；其它场景可选 | 所有场景 |
| 凭证形态 | 直接传入字符串 `clientId` | 后端生成的短效 JWT | URL 参数 `client-id=xxx` |
| 前端是否暴露 client-id | 是（与 v5 等价） | 否 | 是 |
| 需要后端额外接口 | 否 | 是（`/api/auth/...-client-token`） | 否 |
| 内部 auth 类型 | `MERCHANT_AUTH_TYPE.CLIENT_ID_ONLY` | `PAYPAL_CLIENT_TOKEN` / `BRAINTREE_CLIENT_TOKEN` | — |