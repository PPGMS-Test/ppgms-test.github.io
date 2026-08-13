import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderOpen, RotateCcw, AlertCircle } from 'lucide-react'
import { useSftpSyncStore } from '@/store/sftp-sync'
import { useActivePresetStore } from '@/store/active-preset'
import { getPresetById } from '@/config/credential-presets'
import {
  triggerSftpSync,
  getSftpSyncStatus,
  fetchListingAfterSync,
  fetchCachedListing,
  fetchDownloadedFile,
  fetchDownloadedFileAfterSync,
  rawFileUrl,
} from '@/lib/sftp-api'
import { parseReconReport } from '@/lib/recon-report'
import { SyncLoading } from '@/components/SyncLoading'
import { SftpFileList } from '@/components/SftpFileList'
import { ReconReportView } from '@/components/ReconReportView'

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

  // useSftpSyncStore 是全局单例：凭证管理页切换 activePresetId 时本组件不会卸载，
  // 若不重置，会残留上一个凭证的浏览/下载状态——轻则显示旧数据，重则点旧列表里的
  // 文件名去拉新凭证的路径（凭证间日期文件名很可能撞名，拉到的内容会文不对题）。
  useEffect(() => {
    store.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePresetId])

  const listingElapsed = usePolling(store.requestId, isListingPolling, async (ok) => {
    if (!ok) {
      store.setError('同步超时或失败，请重试')
      return
    }
    try {
      const listing = await fetchListingAfterSync(activePresetId)
      store.setListing(listing.files)
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
      const content = await fetchDownloadedFileAfterSync(activePresetId, store.downloadingFileName ?? '')
      store.setDownloaded(content)
    } catch {
      store.setError('拉取文件内容失败')
    }
  })

  async function handleBrowse(forceRefresh = false) {
    setIsTriggering(true)
    try {
      if (!forceRefresh) {
        const cached = await fetchCachedListing(activePresetId)
        if (cached) {
          store.setListing(cached)
          return
        }
      }
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
      try {
        const content = await fetchDownloadedFile(activePresetId, fileName)
        store.setDownloadedFile(fileName, content) // 缓存命中：一步到 ready
        return
      } catch {
        // 缓存 miss，落到下面走 download action
      }
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

  // 错误页「重试」：按错误发生的上下文重试对应的那一步，而不是整个重置
  // （downloadingFileName 在下载/展示阶段的错误里仍保留，可用来判断是重试下载还是重试浏览）
  function handleRetry() {
    if (store.downloadingFileName) {
      handleSelectFile(store.downloadingFileName)
    } else {
      handleBrowse(true)
    }
  }

  const parsed =
    store.csvContent !== null && store.downloadingFileName
      ? parseReconReport(store.csvContent, store.downloadingFileName)
      : null

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
          onClick={() => handleBrowse()}
          disabled={isTriggering}
          className="flex w-fit items-center gap-2 rounded-full border border-line px-4 py-2 text-ink transition hover:border-accent/50 hover:bg-surface2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen size={16} /> 浏览 SFTP 目录
        </button>
      )}

      {(isListingPolling || isDownloadingPolling) && (
        <SyncLoading
          context={isListingPolling ? 'list' : 'download'}
          elapsedSec={isListingPolling ? listingElapsed : downloadElapsed}
          fileName={store.downloadingFileName}
        />
      )}

      {store.phase === 'browsing' && (
        <SftpFileList
          files={store.files}
          onSelect={handleSelectFile}
          onRefresh={() => handleBrowse(true)}
          disabled={isTriggering}
        />
      )}

      {store.phase === 'ready' && parsed && (
        <ReconReportView
          report={parsed}
          fileName={store.downloadingFileName ?? ''}
          downloadUrl={rawFileUrl(activePresetId, store.downloadingFileName ?? '')}
          onBack={() => store.backToList()}
        />
      )}

      {store.phase === 'error' && (
        <div className="flex items-center gap-3 rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-danger">
          <AlertCircle size={16} />
          <span>{store.error}</span>
          <div className="ml-auto flex items-center gap-2">
            {store.files.length > 0 && (
              <button
                type="button"
                onClick={() => store.backToList()}
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-ink transition hover:border-accent/50 hover:bg-surface2"
              >
                <ArrowLeft size={14} /> 返回列表
              </button>
            )}
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-ink transition hover:border-accent/50 hover:bg-surface2"
            >
              <RotateCcw size={14} /> 重试
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
