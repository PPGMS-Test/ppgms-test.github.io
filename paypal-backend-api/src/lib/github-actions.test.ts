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
  it('POST 到 dispatches 端点，带 action/remote_path/client_request_id', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', clientRequestId: 'req-1' })

    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(
      'https://api.github.com/repos/PPGMS-Test/ppgms-test.github.io/actions/workflows/sftp-sync.yml/dispatches',
    )
    const options = init as RequestInit
    expect(options.method).toBe('POST')
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer ghp_test')
    const body = JSON.parse(options.body as string)
    expect(body.ref).toBe('master')
    expect(body.inputs).toEqual({ action: 'list', remote_path: '', client_request_id: 'req-1' })
  })

  it('download 模式带 remote_path', async () => {
    const spy = mockFetchOnce(204)
    await dispatchSftpWorkflow({
      pat: 'ghp_test',
      action: 'download',
      remotePath: '/recon/2026-08-11.csv',
      clientRequestId: 'req-2',
    })
    const [, init] = spy.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.inputs.remote_path).toBe('/recon/2026-08-11.csv')
  })

  it('GitHub API 返回非 2xx 时抛错', async () => {
    mockFetchOnce(422, { message: 'bad request' })
    await expect(
      dispatchSftpWorkflow({ pat: 'ghp_test', action: 'list', clientRequestId: 'req-3' }),
    ).rejects.toThrow('Failed to dispatch workflow: 422')
  })
})

describe('findRunByName', () => {
  it('在 runs 列表里按 name 精确匹配，返回 status/conclusion', async () => {
    mockFetchOnce(200, {
      workflow_runs: [
        { name: 'sftp-sync-other', status: 'completed', conclusion: 'success' },
        { name: 'sftp-sync-req-1', status: 'in_progress', conclusion: null },
      ],
    })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-1')
    expect(result).toEqual({ status: 'in_progress', conclusion: null })
  })

  it('找不到匹配的 run 时返回 null（run 可能还没出现在列表里）', async () => {
    mockFetchOnce(200, { workflow_runs: [] })
    const result = await findRunByName('ghp_test', 'sftp-sync-req-404')
    expect(result).toBeNull()
  })
})
