const GITHUB_OWNER = 'PPGMS-Test'
const GITHUB_REPO = 'ppgms-test.github.io'
const WORKFLOW_FILE = 'sftp-sync.yml'
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`
// GitHub API 请求超时；给公司内网访问 GitHub 的延迟留足余量
const REQUEST_TIMEOUT_MS = 20_000

/**
 * fetch 一次失败（网络抖动/超时）就重试一次；不对拿到响应但非 2xx 的情况重试
 * ——那是应用层错误（如参数不对），重试没有意义。
 * 背景：曾观察到首次触发偶发超时报错，但 GitHub 侧其实已经收到请求并成功跑完 workflow，
 * 说明是网络往返偶发变慢而非请求本身有问题。
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  }
}

interface DispatchParams {
  pat: string
  action: 'list' | 'download'
  remotePath?: string
  credentialId: string
  clientRequestId: string
}

export async function dispatchSftpWorkflow({
  pat,
  action,
  remotePath,
  credentialId,
  clientRequestId,
}: DispatchParams): Promise<void> {
  const res = await fetchWithRetry(`${API_BASE}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: 'master',
      inputs: {
        action,
        remote_path: remotePath ?? '',
        credential_id: credentialId,
        client_request_id: clientRequestId,
      },
    }),
  })
  if (!res.ok) {
    throw new Error(`Failed to dispatch workflow: ${res.status}`)
  }
}

export interface RunStatus {
  status: string
  conclusion: string | null
}

export async function findRunByName(pat: string, runName: string): Promise<RunStatus | null> {
  const res = await fetchWithRetry(
    `${API_BASE}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=20`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
      },
    },
  )
  if (!res.ok) {
    throw new Error(`Failed to list workflow runs: ${res.status}`)
  }
  const data = (await res.json()) as { workflow_runs: Array<{ name: string; status: string; conclusion: string | null }> }
  const match = data.workflow_runs.find((run) => run.name === runName)
  if (!match) return null
  return { status: match.status, conclusion: match.conclusion }
}
