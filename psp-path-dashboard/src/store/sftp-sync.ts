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
  setDownloaded: (content) => set({ phase: 'ready', csvContent: content }),
  setDownloadedFile: (fileName, content) =>
    set({
      phase: 'ready',
      downloadingFileName: fileName,
      csvContent: content,
      requestId: null,
      error: null,
    }),
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
