import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  rawFileUrl,
  fetchCachedListing,
  fetchCachedFileNames,
  fetchDownloadedFile,
  sortFilesByNameDesc,
  todayUtc,
  type FileEntry,
} from './sftp-api'

describe('rawFileUrl', () => {
  it('下载直链带 credentialId 段（仅用于 <a href> 下载）', () => {
    expect(rawFileUrl('hkpsp', '2026-08-11.csv')).toBe(
      'https://raw.githubusercontent.com/PPGMS-Test/ppgms-test.github.io/sftp-data/sftp-data/hkpsp/2026-08-11.csv',
    )
  })
})

describe('sortFilesByNameDesc', () => {
  it('按文件名降序（最新日期在前），不改原数组', () => {
    const input: FileEntry[] = [
      { name: '2026-08-10.csv', size: 1, modifyTime: 1 },
      { name: '2026-08-12.csv', size: 1, modifyTime: 1 },
      { name: '2026-08-11.csv', size: 1, modifyTime: 1 },
    ]
    const out = sortFilesByNameDesc(input)
    expect(out.map((f) => f.name)).toEqual(['2026-08-12.csv', '2026-08-11.csv', '2026-08-10.csv'])
    expect(input[0].name).toBe('2026-08-10.csv') // 原数组未被 mutate
  })
})

describe('fetchCachedListing（读取走后端 /api/sftp/file，强一致）', () => {
  afterEach(() => vi.restoreAllMocks())

  it('命中后端 /api/sftp/file?fileName=listing.json 且 generatedAt 是今天 → 返回 files', async () => {
    const today = todayUtc()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        generatedAt: today,
        credentialId: 'hkpsp',
        files: [{ name: 'a.csv', size: 1, modifyTime: 2 }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await fetchCachedListing('hkpsp')).toEqual([{ name: 'a.csv', size: 1, modifyTime: 2 }])
    expect(fetchMock.mock.calls[0][0]).toContain('/api/sftp/file?credentialId=hkpsp&fileName=listing.json')
  })

  it('generatedAt 非今天 → 返回 null（陈旧）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ generatedAt: '2000-01-01', credentialId: 'hkpsp', files: [] }),
      }),
    )
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })

  it('404 → 返回 null（miss）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })

  it('网络异常 → 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchCachedListing('hkpsp')).toBeNull()
  })
})

describe('fetchDownloadedFile（读取走后端 /api/sftp/file，强一致）', () => {
  afterEach(() => vi.restoreAllMocks())

  it('200 → 返回文本内容，且请求命中后端 file 端点', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'a,b\n1,2' })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchDownloadedFile('hkpsp', 'x.csv')).toBe('a,b\n1,2')
    expect(fetchMock.mock.calls[0][0]).toContain('/api/sftp/file?credentialId=hkpsp&fileName=x.csv')
  })

  it('404 → 抛错', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    await expect(fetchDownloadedFile('hkpsp', 'x.csv')).rejects.toThrow()
  })
})

describe('fetchCachedFileNames（后端目录列表，用于蓝点）', () => {
  afterEach(() => vi.restoreAllMocks())

  it('命中 /api/sftp/dir → 返回文件名数组', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: ['a.csv', 'b.csv'] }) })
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchCachedFileNames('hkpsp')).toEqual(['a.csv', 'b.csv'])
    expect(fetchMock.mock.calls[0][0]).toContain('/api/sftp/dir?credentialId=hkpsp')
  })

  it('非 2xx → 返回空数组（不影响列表展示）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    expect(await fetchCachedFileNames('hkpsp')).toEqual([])
  })

  it('网络异常 → 返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchCachedFileNames('hkpsp')).toEqual([])
  })
})
