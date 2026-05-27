/**
 * 支付结果展示组件。
 *
 * 作用：
 *   在支付完成后（成功或支付级别失败）显示结果卡片：
 *   - 成功：绿色卡片 + Transaction ID（可复制）+ 重新测试按钮
 *   - 失败（支付阶段）：红色卡片 + 错误信息 + 重试按钮
 *   - 初始化失败（result === null 的 error）或非终态：不渲染任何内容
 *
 * 被使用处：
 *   - src/App.tsx — 页面底部渲染，onReset 回调触发 usePaymentFlow 的 reset()
 *
 * 注意：初始化错误（SDK 加载失败等）由 App.tsx 单独渲染内联错误卡片，不经过此组件。
 */
import { CheckCircle2, XCircle, Copy } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCredentialsStore } from '@/store/credentials'
import type { PaymentResult as Result, PaymentStatus } from '@/hooks/usePaymentFlow'

interface PaymentResultProps {
  status: PaymentStatus
  result: Result | null
  error: string | null
  onReset: () => void
}

export function PaymentResult({ status, result, error, onReset }: PaymentResultProps) {
  const [copied, setCopied] = useState(false)
  const { lastVaultId, lastCustomerId } = useCredentialsStore()

  // Only show for payment-level outcomes, not initialization errors
  if (status !== 'success' && status !== 'error') return null
  if (status === 'error' && result === null) return null

  const copyTxId = () => {
    if (!result?.transactionId) return
    void navigator.clipboard.writeText(result.transactionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'success' && result) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold text-green-800">支付成功 🎉</h3>
            <p className="text-sm text-green-600 mt-1">您的付款已成功处理</p>
          </div>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-green-200 px-3 py-2 max-w-sm mx-auto">
            <span className="text-xs text-muted-foreground flex-shrink-0">Transaction ID:</span>
            <code className="text-xs font-mono flex-1 truncate">{result.transactionId}</code>
            <button
              type="button"
              onClick={copyTxId}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {copied && <p className="text-xs text-green-600">已复制到剪贴板</p>}

          {/* Vault 信息回显 — 仅 one-time-vault 成功后有值 */}
          {lastVaultId && (
            <div className="w-full max-w-sm mx-auto space-y-1.5 text-left">
              <p className="text-xs font-medium text-green-700">Vault 信息（已自动填入 MIT 配置）</p>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-green-200 px-3 py-2">
                <span className="text-xs text-muted-foreground flex-shrink-0 w-20">Vault ID:</span>
                <code className="text-xs font-mono flex-1 truncate">{lastVaultId}</code>
              </div>
              {lastCustomerId && (
                <div className="flex items-center gap-2 bg-white rounded-lg border border-green-200 px-3 py-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0 w-20">Customer ID:</span>
                  <code className="text-xs font-mono flex-1 truncate">{lastCustomerId}</code>
                </div>
              )}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={onReset}>
            重新测试
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="pt-6 text-center space-y-4">
        <XCircle className="mx-auto h-12 w-12 text-red-500" />
        <div>
          <h3 className="text-lg font-semibold text-red-800">支付失败</h3>
          <p className="text-sm text-red-600 mt-1 font-mono">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          重试
        </Button>
      </CardContent>
    </Card>
  )
}
