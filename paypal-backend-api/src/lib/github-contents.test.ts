import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBranchFile, listBranchDir, isSafeSegment } from './github-contents'

afterEach(() => vi.unstubAllGlobals())

describe('isSafeSegment', () => {
  it('接受普通凭证名/文件名', () => {
    expect(isSafeSegment('hkpsp')).toBe(true)
    expect(isSafeSegment('yuncong-hk-psp1')).toBe(true)
    expect(isSafeSegment('PYT.20260812.HKPSP.H.0.2.0.CSV')).toBe(true)
    expect(isSafeSegment('listing.json')).toBe(true)
  })
  it('拒绝含斜杠 / .. / 空 的段（防路径穿越）', () => {
    expect(isSafeSegment('a/b')).toBe(false)
    expect(isSafeSegment('..')).toBe(false)
    expect(isSafeSegment('.')).toBe(false)
    expect(isSafeSegment('')).toBe(false)
    expect(isSafeSegment('a b')).toBe(false)
  })
})

describe('fetchBranchFile', () => {
  it('请求 Contents API 的 raw 媒体类型 + ref=sftp-data，带 Bearer', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('col1,col2\n1,2') })
    vi.stubGlobal('fetch', spy)

    const result = await fetchBranchFile('ghp_test', 'hkpsp', '2026-08-11.csv')

    expect(result).toEqual({ ok: true, content: 'col1,col2\n1,2' })
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/contents/sftp-data/hkpsp/2026-08-11.csv?ref=sftp-data',
    )
    expect(init.headers.Authorization).toBe('Bearer ghp_test')
    expect(init.headers.Accept).toBe('application/vnd.github.raw')
  })

  it('404 → { ok: false, status: 404 }', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') })
    vi.stubGlobal('fetch', spy)
    expect(await fetchBranchFile('ghp_test', 'hkpsp', 'missing.csv')).toEqual({ ok: false, status: 404 })
  })
})

describe('listBranchDir', () => {
  it('返回目录内除 listing.json 外的文件名', async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          { name: 'listing.json', type: 'file' },
          { name: '2026-08-11.csv', type: 'file' },
          { name: '2026-08-12.csv', type: 'file' },
          { name: 'sub', type: 'dir' },
        ]),
    })
    vi.stubGlobal('fetch', spy)

    expect(await listBranchDir('ghp_test', 'hkpsp')).toEqual(['2026-08-11.csv', '2026-08-12.csv'])
    const [url] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/contents/sftp-data/hkpsp?ref=sftp-data',
    )
  })

  it('目录不存在(404) → 返回空数组（尚未同步过任何文件）', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', spy)
    expect(await listBranchDir('ghp_test', 'hkpsp')).toEqual([])
  })

  it('其它非 2xx → 抛错', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
    vi.stubGlobal('fetch', spy)
    await expect(listBranchDir('ghp_test', 'hkpsp')).rejects.toThrow()
  })
})
