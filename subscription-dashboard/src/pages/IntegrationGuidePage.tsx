// subscription-dashboard/src/pages/IntegrationGuidePage.tsx
import type { ReactNode } from 'react'
import { TopBar } from '@/components/TopBar'
import { Card } from '@/components/ui/Card'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink/90">{children}</div>
    </Card>
  )
}

export function IntegrationGuidePage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <TopBar />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
        <Section title="1. 后端一次性准备">
          <p>
            创建 Product（一次性，之后复用）：<code>POST /v1/catalogs/products</code>
          </p>
          <p>
            为每种定价方案创建 Plan（billing_cycles + payment_preferences + taxes）：<code>POST /v1/billing/plans</code>
          </p>
          <p className="text-danger">
            ⚠️ NGS（<code>/v1/billing/plans</code> + <code>/v1/billing/subscriptions</code>）是唯一前进方向。NVP/SOAP、Legacy
            REST（<code>/v1/payments/billing-plans</code>）、WPS 均已废弃，新接入不要碰。
          </p>
        </Section>

        <Section title="2. 每个买家的下单流程">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              后端用 <code>POST /v1/billing/subscriptions</code> 创建订阅，拿到 <code>id</code>（状态 <code>APPROVAL_PENDING</code>）
            </li>
            <li>
              前端加载 JS SDK v6：sandbox 用 <code>https://www.sandbox.paypal.com/web-sdk/v6/core</code>，正式环境用{' '}
              <code>https://www.paypal.com/web-sdk/v6/core</code>
            </li>
            <li>
              用 <code>paypal.createInstance({'{ clientId, components: [\'paypal-subscriptions\'] }'})</code> 拿到 SDK 实例
            </li>
            <li>
              <code>createPayPalSubscriptionPaymentSession(...)</code> 渲染按钮，<code>start()</code> 时把上一步的 subscriptionId
              传进去，而不是重新建
            </li>
            <li>
              <code>onApprove</code> 回调后，调后端 <code>GET /v1/billing/subscriptions/{'{id}'}</code> 确认状态变成{' '}
              <code>ACTIVE</code>
            </li>
          </ol>
        </Section>

        <Section title="3. 移动端（iOS / Android）">
          <p>移动端走 Braintree SDK，不是 PayPal 原生 SDK。</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 text-left">平台</th>
                <th className="py-1 text-left">最低版本</th>
                <th className="py-1 text-left">SDK</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-1">Web</td>
                <td>v3+（推荐 v6）</td>
                <td>PayPal JS SDK</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="py-1">iOS</td>
                <td>v6+</td>
                <td>Braintree iOS SDK</td>
              </tr>
              <tr>
                <td className="py-1">Android</td>
                <td>v5+</td>
                <td>Braintree Android SDK</td>
              </tr>
            </tbody>
          </table>
          <p>
            核心机制是 Billing Agreement：买家批准后拿到 Payment Token 代理 Billing Agreement ID，商户存起来用于后续扣款；支持
            App Switch（跳 PayPal App 批准再跳回）。
          </p>
        </Section>

        <Section title="4. FraudNet 决策树">
          <p>
            标准 NGS 流程（买家在 PayPal 托管页面批准）：<b className="text-ok">不需要</b>集成 FraudNet，PCI 影响 None。
          </p>
          <p>如果涉及以下情况，需要考虑 FraudNet / risk correlation 集成：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Unbranded card processing（买家直接在商户页面输卡号，绕过 PayPal 界面）</li>
            <li>Advanced credit/debit card fields（hosted fields）</li>
          </ul>
        </Section>

        <Section title="5. Webhook 事件清单">
          <p>生命周期变化要靠 webhook 兜底，建议至少监听：</p>
          <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
            <li>BILLING.SUBSCRIPTION.ACTIVATED</li>
            <li>BILLING.SUBSCRIPTION.CANCELLED</li>
            <li>BILLING.SUBSCRIPTION.SUSPENDED</li>
            <li>BILLING.SUBSCRIPTION.PAYMENT.FAILED</li>
            <li>BILLING.SUBSCRIPTION.EXPIRED</li>
            <li>BILLING.SUBSCRIPTION.UPDATED</li>
          </ul>
          <p>仓库里已有 webhook-listener 工具可以直接拿来验证收到的事件。</p>
        </Section>

        <Section title="6. 与 Orders v2 + Vault v3 的选型对比">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 text-left">维度</th>
                <th className="py-1 text-left">Subscriptions API</th>
                <th className="py-1 text-left">Orders v2 + Vault v3</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-1">谁管理扣款</td>
                <td>PayPal 自动按 Plan 扣款</td>
                <td>商户自己发起每次扣款</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="py-1">适用场景</td>
                <td>固定周期、固定金额的订阅</td>
                <td>灵活的、不定期的后续收费</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="py-1">API 层级</td>
                <td>Product → Plan → Subscription</td>
                <td>Order → Vault → Payment Token</td>
              </tr>
              <tr className="border-b border-line/60">
                <td className="py-1">自动重试</td>
                <td>PayPal 内置自动重试</td>
                <td>商户需要自己实现</td>
              </tr>
              <tr>
                <td className="py-1">Webhook 事件</td>
                <td>丰富的订阅生命周期事件</td>
                <td>需要自己跟踪</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </main>
    </div>
  )
}
