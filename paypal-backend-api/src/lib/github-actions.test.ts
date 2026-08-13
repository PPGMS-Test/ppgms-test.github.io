import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispatchSftpWorkflow, findRunByName } from './github-actions'

function mockFetchOnce(status = 200, json: unknown = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(json),
  } as Response)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe('dispatchSftpWorkflow', () => {
  it('POST 到 dispatches 端点，带 action/remote_path/credential_id/client_request_id', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-1' })

    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/dispatches',
    )
    const options = init as RequestInit
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test')
    const body = JSON.parse(options.body as string)
    expect(body.ref).toBe('master')
    expect(body.inputs).toEqual({
      action: 'list',
      remote_path: '',
      credential_id: 'hkpsp',
      client_request_id: 'req-1',
    })
  })

  it('download 模式带 remote_path', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({
      pat: 'ghp_test',
      action: 'download',
      remotePath: '/recon/2026-08-11.csv',
      credentialId: 'hkpsp',
      clientRequestId: 'req-2',
    })
    const [, init] = spy.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.inputs.remote_path).toBe('/recon/2026-08-11.csv')
  })

  it('GitHub API 返回非 2xx 时抛错', async () => {
    mockFetchOnce(422, { message: 'bad request' })
    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-3' }),
    ).rejects.toThrow('Failed to dispatch workflow: 422')
  })

  it('第一次请求网络抖动/超时被拒绝时，自动重试一次并成功', async () => {
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve({}) } as Response)
    vi.stubGlobal('fetch', spy)

    await dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-4' })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('重试后仍然失败则抛出重试后的错误', async () => {
    const spy = vi.fn().mockRejectedValueOnce(new Error('timeout 1')).mockRejectedValueOnce(new Error('timeout 2'))
    vi.stubGlobal('fetch', spy)

    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-5' }),
    ).rejects.toThrow('timeout 2')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('拿到非 2xx 响应时不重试（应用层错误，重试没有意义）', async () => {
    const spy = mockFetchOnce(422, { message: 'bad request' })
    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', credentialId: 'hkpsp', clientRequestId: 'req-6' }),
    ).rejects.toThrow('Failed to dispatch workflow: 422')
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('findRunByName', () => {
  it('在 runs 列表里按 name 精确匹配，返回 status/conclusion', async () => {
    const spy = mockFetchOnce(200, {
      workflow_runs: [
        { name: 'sftp-sync-other', status: 'completed', conclusion: 'success' },
        { name: 'sftp-sync-req-1', status: 'in_progress', conclusion: null },
      ],
    })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-1')
    expect(result).toEqual({ status: 'in_progress', conclusion: null })
    const [url] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/runs?event=workflow_dispatch&per_page=20',
    )
  })

  it('找不到匹配的 run 时返回 null（run 可能还没出现在列表里）', async () => {
    const spy = mockFetchOnce(200, { workflow_runs: [] })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-404')
    expect(result).toBeNull()
    const [url] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/runs?event=workflow_dispatch&per_page=20',
    )
  })

  it('第一次请求网络抖动/超时被拒绝时，自动重试一次并成功', async () => {
    const spy = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ workflow_runs: [{ name: 'sftp-sync-req-1', status: 'completed', conclusion: 'success' }] }),
      } as Response)
    vi.stubGlobal('fetch', spy)

    const result = await findRunByName('ghp_test', 'sftp-sync-req-1')
    expect(result).toEqual({ status: 'completed', conclusion: 'success' })
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
