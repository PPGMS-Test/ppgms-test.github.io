import { create } from 'zustand'
import type { FileEntry } from '@/lib/sftp-api'

export type SftpSyncPhase = 'idle' | 'listing' | 'browsing' | 'downloading' | 'ready' | 'error'

interface SftpSyncState {
  phase: SftpSyncPhase
  requestId: string | null
  files: FileEntry[]
  downloadingFileName: string | null
  csvContent: string | null
  error: string | null
  startListing: (requestId: string) => void
  setListing: (files: FileEntry[]) => void
  startDownloading: (requestId: string, fileName: string) => void
  setDownloaded: (content: string) => void
  setError: (message: string) => void
  reset: () => void
}

const initialState = {
  phase: 'idle' as SftpSyncPhase,
  requestId: null,
  files: [],
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
      csvContent: null,
      downloadingFileName: null,
    }),
  setListing: (files) => set({ phase: 'browsing', files }),
  startDownloading: (requestId, fileName) =>
    set({
      phase: 'downloading',
      requestId,
      downloadingFileName: fileName,
      error: null,
      csvContent: null,
    }),
  setDownloaded: (content) => set({ phase: 'ready', csvContent: content }),
  setError: (message) => set({ phase: 'error', error: message }),
  reset: () => set({ ...initialState }),
}))
