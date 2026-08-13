import { create } from 'zustand'
import type { FileEntry } from '@/lib/sftp-api'

export type SftpSyncPhase = 'idle' | 'listing' | 'browsing' | 'downloading' | 'ready' | 'error'

interface SftpSyncState {
  phase: SftpSyncPhase
  requestId: string | null
  files: FileEntry[]
  cachedFileNames: string[]
  downloadingFileName: string | null
  csvContent: string | null
  error: string | null
  startListing: (requestId: string) => void
  setListing: (files: FileEntry[]) => void
  setCachedFileNames: (names: string[]) => void
  startDownloading: (requestId: string, fileName: string) => void
  setDownloaded: (content: string) => void
  setDownloadedFile: (fileName: string, content: string) => void
  backToList: () => void
  setError: (message: string) => void
  reset: () => void
}

const initialState = {
  phase: 'idle' as SftpSyncPhase,
  requestId: null,
  files: [],
  cachedFileNames: [],
  downloadingFileName: null,
  csvContent: null,
  error: null,
}

/** 把文件名并入集合（去重，不改原数组） */
function addUnique(names: string[], name: string): string[] {
  return names.includes(name) ? names : [...names, name]
}

export const useSftpSyncStore = create<SftpSyncState>()((set) => ({
  ...initialState,
  startListing: (requestId) =>
    set({
      phase: 'listing',
      requestId,
      error: null,
      files: [],
      cachedFileNames: [],
      csvContent: null,
      downloadingFileName: null,
    }),
  setListing: (files) => set({ phase: 'browsing', files }),
  setCachedFileNames: (names) => set({ cachedFileNames: names }),
  startDownloading: (requestId, fileName) =>
    set({
      phase: 'downloading',
      requestId,
      downloadingFileName: fileName,
      error: null,
      csvContent: null,
    }),
  // 进入 ready 说明该文件内容已成功读到 → 它此刻确实已缓存，乐观地并入 cachedFileNames，
  // 这样下载新文件后 backToList 回到列表就能立刻看到蓝点（无需重新浏览触发目录列举）。
  setDownloaded: (content) =>
    set((state) => ({
      phase: 'ready',
      csvContent: content,
      cachedFileNames: state.downloadingFileName
        ? addUnique(state.cachedFileNames, state.downloadingFileName)
        : state.cachedFileNames,
    })),
  setDownloadedFile: (fileName, content) =>
    set((state) => ({
      phase: 'ready',
      downloadingFileName: fileName,
      csvContent: content,
      requestId: null,
      error: null,
      cachedFileNames: addUnique(state.cachedFileNames, fileName),
    })),
  // 从「ready」返回「browsing」：保留 files（已经拉过的目录列表），只清掉与具体文件相关的状态
  backToList: () =>
    set({
      phase: 'browsing',
      downloadingFileName: null,
      csvContent: null,
      requestId: null,
      error: null,
    }),
  setError: (message) => set({ phase: 'error', error: message }),
  reset: () => set({ ...initialState }),
}))
