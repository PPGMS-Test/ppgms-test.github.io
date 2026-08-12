import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, RotateCcw, AlertCircle } from 'lucide-react'
import { useSftpSyncStore } from '@/store/sftp-sync'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById } from '@/config/credential-presets'
import { triggerSftpSync, getSftpSyncStatus, fetchListing, fetchDownloadedFile, rawFileUrl } from '@/lib/sftp-api'
import { parseCsv } from '@/lib/csv-parse'
import { cn } from '@/lib/utils'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 120_000

function usePolling(requestId: string | null, active: boolean, onDone: (ok: boolean) => void) {
  const startedAt = useRef<number>(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!active || !requestId) return
    startedAt.current = Date.now()
    setElapsedSec(0)
    let done = false

    const interval = setInterval(async () => {
      if (done) return
      const elapsed = Date.now() - startedAt.current
      setElapsedSec(Math.floor(elapsed / 1000))

      if (elapsed > POLL_TIMEOUT_MS) {
        done = true
        clearInterval(interval)
        onDone(false)
        return
      }

      const result = await getSftpSyncStatus(requestId)
      if (done) return
      if (result.status === 'completed') {
        done = true
        clearInterval(interval)
        onDone(result.conclusion === 'success')
      }
    }, POLL_INTERVAL_MS)

    return () => {
      done = true
      clearInterval(interval)
    }
    // onDone 有意排除在依赖外：避免父组件每次渲染都重启轮询定时器。
    // 之所以安全，是因为每次触发都会产生全新的 requestId（见 startListing/startDownloading），
    // requestId 变化会让这个 effect 重新执行，从而绑定到新的 onDone 闭包——不存在"用旧闭包轮询新请求"的风险。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, active])

  return elapsedSec
}

export function SftpSyncPanel() {
  const store = useSftpSyncStore()
  const activePresetId = useActivePresetStore((s) => s.activePresetId)
  const activePreset = getPresetById(activePresetId)
  const sftpUser = activePreset.loginInfo?.sftpUser
  const isListingPolling = store.phase === 'listing'
  const isDownloadingPolling = store.phase === 'downloading'
  const [isTriggering, setIsTriggering] = useState(false)

  const listingElapsed = usePolling(store.requestId, isListingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const files = await fetchListing()
      store.setListing(files)
    } catch {
      store.setError('拉取目录列表失败')
    }
  })

  const downloadElapsed = usePolling(store.requestId, isDownloadingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const content = await fetchDownloadedFile(store.downloadingFileName ?? '')
      store.setDownloaded(content)
    } catch {
      store.setError('拉取文件内容失败')
    }
  })

  async function handleBrowse() {
    setIsTriggering(true)
    try {
      const result = await triggerSftpSync('list', activePresetId)
      if (result.requestId) {
        store.startListing(result.requestId)
      } else {
        store.setError(result.error ?? '触发同步失败')
      }
    } catch {
      store.setError('触发同步失败，请检查网络连接')
    } finally {
      setIsTriggering(false)
    }
  }

  async function handleSelectFile(fileName: string) {
    setIsTriggering(true)
    try {
      const result = await triggerSftpSync('download', activePresetId, fileName)
      if (result.requestId) {
        store.startDownloading(result.requestId, fileName)
      } else {
        store.setError(result.error ?? '触发同步失败')
      }
    } catch {
      store.setError('触发同步失败，请检查网络连接')
    } finally {
      setIsTriggering(false)
    }
  }

  const parsed = store.csvContent ? parseCsv(store.csvContent) : null

  return (
    <div className="flex flex-col gap-4">
      {store.phase === 'idle' && !sftpUser && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-surface2/60 px-4 py-3 text-sm text-muted">
          <AlertCircle size={16} />
          <span>
            当前凭证「{activePreset.label}」未配置 SFTP 账号，请先在凭证管理页切换到已配置 SFTP 的凭证。
          </span>
        </div>
      )}

      {store.phase === 'idle' && sftpUser && (
        <button
          type="button"
          onClick={handleBrowse}
          disabled={isTriggering}
          className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={16} /> 浏览 SFTP 目录
        </button>
      )}

      {(isListingPolling || isDownloadingPolling) && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          同步中…（{isListingPolling ? listingElapsed : downloadElapsed}s）
        </div>
      )}

      {store.phase === 'browsing' && (
        <ul className="flex flex-col gap-2">
          {store.files.map((file) => (
            <li key={file.name}>
              <button
                type="button"
                onClick={() => handleSelectFile(file.name)}
                disabled={isTriggering}
                className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2 text-left text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{file.name}</span>
                <span className="font-mono text-xs text-muted">{file.size} bytes</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {store.phase === 'ready' && parsed && (
        <div className="flex flex-col gap-3">
          <a
            href={rawFileUrl(store.downloadingFileName ?? '')}
            download={store.downloadingFileName ?? undefined}
            className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2"
          >
            <Download size={16} /> 下载 {store.downloadingFileName}
          </a>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface2">
                <tr>
                  {parsed.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-mono text-xs uppercase text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, i) => (
                  <tr key={i} className={cn(i % 2 === 0 ? 'bg-transparent' : 'bg-surface2/40')}>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-ink">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {store.phase === 'error' && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-danger">
          <AlertCircle size={16} />
          <span>{store.error}</span>
          <button
            type="button"
            onClick={() => store.reset()}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-ink transition hover:border-accent/50 hover:bg-surface2"
          >
            <RotateCcw size={14} /> 重试
          </button>
        </div>
      )}
    </div>
  )
}
