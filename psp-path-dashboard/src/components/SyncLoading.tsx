import { RefreshCw } from 'lucide-react'

interface SyncLoadingProps {
  context: 'list' | 'download'
  elapsedSec: number
  fileName?: string | null
}

/**
 * 长等待 loading 卡片：list / download 都会触发 30–90s 的 GitHub Action，
 * 故用带实时计时、说明文案和不确定进度纸带的卡片，替代原来的 12px 转圈。
 */
export function SyncLoading({ context, elapsedSec, fileName }: SyncLoadingProps) {
  const title = context === 'list' ? '正在拉取 SFTP 目录' : '正在下载对账文件'
  const detail =
    context === 'list'
      ? '已触发 GitHub Action 连接 SFTP，首次拉取通常需要 30–90 秒。'
      : `正在从 SFTP 取回 ${fileName ?? '文件'}，请稍候。`

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-6">
      {/* 顶部一条会呼吸的金色高光，呼应「money in motion」 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-accent to-transparent motion-reduce:hidden" />

      <div className="flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-line" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent motion-reduce:animate-none" />
          <RefreshCw size={18} className="text-accent" />
        </div>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold text-ink">{title}</span>
            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-xs tabular-nums text-accent">
              {elapsedSec}s
            </span>
          </div>
          <p className="text-sm text-muted">{detail}</p>
        </div>
      </div>

      {/* 不确定进度纸带 */}
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-surface2">
        <div className="h-full w-1/3 rounded-full bg-accent/70 [animation:ledger-slide_1.4s_ease-in-out_infinite] motion-reduce:w-full motion-reduce:[animation:none]" />
      </div>
    </div>
  )
}
