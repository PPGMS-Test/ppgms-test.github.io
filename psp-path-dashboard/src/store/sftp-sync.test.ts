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
