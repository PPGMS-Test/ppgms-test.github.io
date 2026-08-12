const GITHUB_OWNER = 'PPGMS-Test'
const GITHUB_REPO = 'ppgms-test.github.io'
const WORKFLOW_FILE = 'sftp-sync.yml'
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`

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
  const res = await fetch(`${API_BASE}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
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
    signal: AbortSignal.timeout(10_000),
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
  const res = await fetch(`${API_BASE}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&per_page=20`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    throw new Error(`Failed to list workflow runs: ${res.status}`)
  }
  const data = (await res.json()) as { workflow_runs: Array<{ name: string; status: string; conclusion: string | null }> }
  const match = data.workflow_runs.find((run) => run.name === runName)
  if (!match) return null
  return { status: match.status, conclusion: match.conclusion }
}
