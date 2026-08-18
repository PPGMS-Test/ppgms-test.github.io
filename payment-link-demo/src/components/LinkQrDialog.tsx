/**
 * LinkQrDialog：为一条 payment link 生成 / 展示 QR Code。
 *
 * 两条来源：
 *  1) 前端本地生成（可靠，始终可用）：用 `qrcode` 库把买家支付 URL(payUrl) 编码成 PNG。
 *     买家扫码即打开该支付链接——与 PayPal QR_CODE 模式的最终效果一致，且不依赖服务端是否返回 QR。
 *  2) 服务端 QR（若有）：QR_CODE 模式下 PayPal 可能在响应里回一个托管 QR 图片 URL(record.qrCodeUrl)，
 *     一并展示/可打开。
 *
 * 提供下载 PNG、复制支付 URL。
 */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Copy, Check, ExternalLink, QrCode } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PaymentLinkRecord } from '@/store/payment-links'

interface Props {
  record: PaymentLinkRecord | null
  onClose: () => void
}

export function LinkQrDialog({ record, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // record / payUrl 变化时重新生成本地 QR
  useEffect(() => {
    if (!record?.payUrl) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    setError(null)
    setDataUrl(null)
    console.log('[LinkQrDialog] generating QR for', record.payUrl)
    QRCode.toDataURL(record.payUrl, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [record?.id, record?.payUrl])

  async function copyUrl() {
    if (!record?.payUrl) return
    await navigator.clipboard.writeText(record.payUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function download() {
    if (!dataUrl || !record) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${record.resourceId || 'payment-link'}-qr.png`
    a.click()
  }

  return (
    <Dialog
      open={!!record}
      onOpenChange={(o) => !o && onClose()}
      title="Payment QR code"
      description="扫码即打开该支付链接。适合门店/展会/打印物料等线下场景。"
      size="md"
    >
      {record && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl border border-border bg-white p-4">
              {dataUrl ? (
                <img src={dataUrl} alt="Payment QR code" className="h-64 w-64" />
              ) : error ? (
                <div className="flex h-64 w-64 items-center justify-center text-center text-sm text-destructive">
                  {error}
                </div>
              ) : (
                <div className="flex h-64 w-64 items-center justify-center text-muted-foreground">
                  <QrCode className="h-8 w-8 animate-pulse" />
                </div>
              )}
            </div>
            <p className="max-w-full truncate font-mono text-xs text-muted-foreground" title={record.payUrl}>
              {record.payUrl}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" disabled={!dataUrl} onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download PNG
            </Button>
            <Button size="sm" variant="outline" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5 text-verified" /> : <Copy className="h-3.5 w-3.5" />}
              Copy URL
            </Button>
          </div>

          {/* 服务端 QR（QR_CODE 模式返回时）：一并给出托管 QR 图片链接 */}
          {record.qrCodeUrl && (
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <div className="mb-1 font-medium text-foreground">PayPal-hosted QR (QR_CODE mode)</div>
              <a
                href={record.qrCodeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-brand hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {record.qrCodeUrl}
              </a>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
