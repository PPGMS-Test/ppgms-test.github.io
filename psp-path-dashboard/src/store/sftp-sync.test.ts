import { beforeEach, describe, expect, it } from 'vitest'
import { useSftpSyncStore } from './sftp-sync'

beforeEach(() => {
  useSftpSyncStore.getState().reset()
})

describe('useSftpSyncStore', () => {
  it('初始状态是 idle', () => {
    expect(useSftpSyncStore.getState().phase).toBe('idle')
  })

  it('startListing 把 phase 设为 listing 并记录 requestId', () => {
    useSftpSyncStore.getState().startListing('req-1')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('listing')
    expect(state.requestId).toBe('req-1')
    expect(state.error).toBeNull()
  })

  it('setListing 把结果写入并把 phase 设为 browsing', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setListing([{ name: 'a.csv', size: 10, modifyTime: 0 }])
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('browsing')
    expect(state.files).toEqual([{ name: 'a.csv', size: 10, modifyTime: 0 }])
  })

  it('startDownloading 把 phase 设为 downloading 并记录目标文件名', () => {
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('downloading')
    expect(state.requestId).toBe('req-2')
    expect(state.downloadingFileName).toBe('a.csv')
  })

  it('setDownloaded 把内容写入并把 phase 设为 ready', () => {
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    useSftpSyncStore.getState().setDownloaded('name,amount\nAlice,100')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('ready')
    expect(state.csvContent).toBe('name,amount\nAlice,100')
  })

  it('startListing 清除上一轮遗留的 files 和 csvContent', () => {
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    useSftpSyncStore.getState().setDownloaded('name,amount\nAlice,100')
    useSftpSyncStore.getState().startListing('req-3')
    const state = useSftpSyncStore.getState()
    expect(state.files).toEqual([])
    expect(state.csvContent).toBeNull()
    expect(state.downloadingFileName).toBeNull()
  })

  it('startDownloading 清除上一轮遗留的 csvContent 但保留 files', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setListing([{ name: 'a.csv', size: 10, modifyTime: 0 }])
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    useSftpSyncStore.getState().setDownloaded('name,amount\nAlice,100')
    useSftpSyncStore.getState().startDownloading('req-3', 'b.csv')
    const state = useSftpSyncStore.getState()
    expect(state.csvContent).toBeNull()
    expect(state.files).toEqual([{ name: 'a.csv', size: 10, modifyTime: 0 }])
  })

  it('setError 把 phase 设为 error 并记录错误信息', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setError('连接超时')
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('error')
    expect(state.error).toBe('连接超时')
  })

  it('reset 恢复到初始状态', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setError('失败')
    useSftpSyncStore.getState().reset()
    const state = useSftpSyncStore.getState()
    expect(state.phase).toBe('idle')
    expect(state.requestId).toBeNull()
    expect(state.error).toBeNull()
    expect(state.files).toEqual([])
  })
})

describe('useSftpSyncStore.setDownloadedFile', () => {
  it('缓存命中：一步进入 ready，带上文件名与内容，且清空进行中的 requestId（不触发轮询）', () => {
    // 先制造一个进行中的 requestId，验证 setDownloadedFile 确实把它清空
    useSftpSyncStore.getState().startDownloading('req-x', 'old.csv')
    useSftpSyncStore.getState().setDownloadedFile('2026-08-11.csv', 'a,b\n1,2')
    const s = useSftpSyncStore.getState()
    expect(s.phase).toBe('ready')
    expect(s.downloadingFileName).toBe('2026-08-11.csv')
    expect(s.csvContent).toBe('a,b\n1,2')
    expect(s.requestId).toBeNull()
    expect(s.error).toBeNull()
  })
})

describe('useSftpSyncStore.backToList', () => {
  it('从 ready 返回 browsing，保留已拉取的 files，清空当前文件相关状态', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setListing([{ name: 'a.csv', size: 10, modifyTime: 0 }])
    useSftpSyncStore.getState().startDownloading('req-2', 'a.csv')
    useSftpSyncStore.getState().setDownloaded('name,amount\nAlice,100')

    useSftpSyncStore.getState().backToList()
    const s = useSftpSyncStore.getState()
    expect(s.phase).toBe('browsing')
    expect(s.files).toEqual([{ name: 'a.csv', size: 10, modifyTime: 0 }])
    expect(s.downloadingFileName).toBeNull()
    expect(s.csvContent).toBeNull()
    expect(s.requestId).toBeNull()
    expect(s.error).toBeNull()
  })
})

describe('下载完成后乐观并入 cachedFileNames（返回列表即见蓝点）', () => {
  it('setDownloaded 把当前 downloadingFileName 并入 cachedFileNames，backToList 后仍在', () => {
    useSftpSyncStore.getState().startListing('req-1')
    useSftpSyncStore.getState().setListing([{ name: 'new.csv', size: 10, modifyTime: 0 }])
    // 浏览时该文件尚未缓存
    useSftpSyncStore.getState().setCachedFileNames([])
    useSftpSyncStore.getState().startDownloading('req-2', 'new.csv')
    useSftpSyncStore.getState().setDownloaded('a,b\n1,2')

    useSftpSyncStore.getState().backToList()
    expect(useSftpSyncStore.getState().cachedFileNames).toContain('new.csv')
  })

  it('setDownloadedFile（缓存命中）也并入，且不重复', () => {
    useSftpSyncStore.getState().setCachedFileNames(['x.csv'])
    useSftpSyncStore.getState().setDownloadedFile('x.csv', 'a,b\n1,2')
    expect(useSftpSyncStore.getState().cachedFileNames).toEqual(['x.csv']) // 去重
    useSftpSyncStore.getState().setDownloadedFile('y.csv', 'a,b\n3,4')
    expect(useSftpSyncStore.getState().cachedFileNames).toEqual(['x.csv', 'y.csv'])
  })
})
