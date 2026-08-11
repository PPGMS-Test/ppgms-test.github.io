import { TopBar } from '@/components/TopBar'
import { SftpSyncPanel } from '@/components/SftpSyncPanel'

export function SftpSyncPage() {
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-4 font-display text-lg font-semibold text-ink">对账文件同步</h1>
        <SftpSyncPanel />
      </main>
    </div>
  )
}
