import { FileText, ChevronRight, RotateCcw } from 'lucide-react'
import type { FileEntry } from '@/lib/sftp-api'
import { sortFilesByNameDesc } from '@/lib/sftp-api'
import { describeReconFileName, formatFileSize } from '@/lib/recon-report'

interface SftpFileListProps {
  files: FileEntry[]
  onSelect: (fileName: string) => void
  onRefresh: () => void
  disabled: boolean
}

/** 对账文件列表：每个文件一张可扫读的卡片（图标 + 文件名 + 日期/账户/大小 + 进入箭头）。 */
export function SftpFileList({ files, onSelect, onRefresh, disabled }: SftpFileListProps) {
  const sorted = sortFilesByNameDesc(files)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          共 <span className="font-mono text-ink">{sorted.length}</span> 个文件 · 最新在前
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw size={14} /> 刷新
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          该目录暂无文件
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((file) => {
            const meta = describeReconFileName(file.name)
            return (
              <li key={file.name}>
                <button
                  type="button"
                  onClick={() => onSelect(file.name)}
                  disabled={disabled}
                  className="group flex w-full appearance-none items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-accent/60 hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <FileText size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-mono text-sm text-ink">{file.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                      {meta.dateLabel && <span>{meta.dateLabel}</span>}
                      {meta.account && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{meta.account}</span>
                        </>
                      )}
                      <span className="opacity-40">·</span>
                      <span className="font-mono">{formatFileSize(file.size)}</span>
                    </span>
                  </span>
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent"
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
