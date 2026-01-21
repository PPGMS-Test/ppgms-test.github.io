
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
| APM | 已发布5个 | ✅ |
| Vault | ❌（Wallet无Returning UX） | ✅ |

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
| Pay Later Message        | ❌ <br><sub>不支持跨境消息 (cross-border-message)</sub> | ✅            |
| BCDC Standalone Button   | ❌ <br><sub>inline 模式下 auto expansion 有问题</sub> | ✅            |
| ACDC 信用卡支付          | ✅                                       | ✅            |
| Apple Pay                | ✅                                       | ✅            |
| Google Pay               | ✅                                       | ✅            |
| APM（本地支付方式）      | 已发布 5 个                              | ✅            |
| Vault（Returning UX）    | ❌ <br><sub>Wallet 无 Returning 用户体验</sub> | ✅            |

## B. 产品技术性能指标

| 指标                 | v6                                                                 | v5                                     |
|----------------------|--------------------------------------------------------------------|----------------------------------------|
| PayPal 买家支付体验   | <span style="color:#2e7d32; font-weight:bold">✅ 支持所有主流浏览器行为</span> | 不支持 Payment Handler、Redirect 等新特性 |
| 开发者友好程度        | <span style="color:#2e7d32; font-weight:bold">✅ 代码可读性高，与 Stripe/Apple Pay/Google Pay 规范一致</span> | 未引入 Payment Session 概念             |
| 加载速度             | <span style="color:#2e7d32; font-weight:bold">✅ 资源包仅 v5 的 12%</span>     | —                                      |
| 代码实现             | <span style="color:#2e7d32; font-weight:bold">✅ 支持模块化与设计模式，加载近乎瞬时</span> | —                                      |
| UI 兼容性            | <span style="color:#2e7d32; font-weight:bold">✅ 使用 Shadow DOM，对 iframe 更友好</span> | 无法嵌套 iframe                        |
| 定制化               | <span style="color:#2e7d32; font-weight:bold">✅ 支持自定义按钮样式</span>      | 必须使用 PayPal 官方按钮               |