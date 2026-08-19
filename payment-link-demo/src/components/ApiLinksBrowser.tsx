import { useState } from 'react'
import { RefreshCw, ExternalLink, ListFilter, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useCredentialsStore } from '@/store/credentials'
import {
  ApiError,
  extractPayUrl,
  extractNextPageToken,
  type PaymentResource,
} from '@/lib/api/types'

interface ApiLinksBrowserProps {
  className?: string
  /** 由父级（MerchantConsole）注入，点击 Details 时唤起 LinkDetailsDialog */
  onInspect?: (resourceId: string) => void
}

/** ACTIVE 走 verified 配色，其余走 muted */
function statusPillClass(status?: string): string {
  if (status === 'ACTIVE') return 'bg-verified/10 text-verified border border-verified/30'
  return 'bg-muted text-muted-foreground border border-border'
}

function formatError(e: unknown): string {
  if (e instanceof ApiError) {
    return `${e.message} (HTTP ${e.status}${e.debugId ? ` · debug_id ${e.debugId}` : ''})`
  }
  return e instanceof Error ? e.message : String(e)
}

/** 状态过滤可选项（含空=All） */
const STATUS_OPTIONS = ['', 'ACTIVE', 'INACTIVE'] as const

export default function ApiLinksBrowser({ className, onInspect }: ApiLinksBrowserProps) {
  const { client } = useCredentialsStore()

  const [resources, setResources] = useState<PaymentResource[]>([])
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [pageSize, setPageSize] = useState<number>(10)
  const [loaded, setLoaded] = useState(false) // 是否至少 Load 过一次
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Load：重置列表拉第一页
  async function load() {
    setLoading(true)
    setError(null)
    console.log('[ApiLinksBrowser] load', { pageSize, status: status || undefined })
    try {
      const res = await client.listLinks({ pageSize, status: status || undefined })
      setResources(res.resources ?? [])
      setNextToken(extractNextPageToken(res))
      setLoaded(true)
    } catch (e) {
      console.error('[ApiLinksBrowser] load failed', e instanceof ApiError ? e.data : e)
      setError(formatError(e))
    } finally {
      setLoading(false)
    }
  }

  // Load more：用 nextToken 追加下一页
  async function loadMore() {
    if (!nextToken) return
    setLoading(true)
    setError(null)
    console.log('[ApiLinksBrowser] loadMore', { pageSize, status: status || undefined, pageToken: nextToken })
    try {
      const res = await client.listLinks({ pageSize, status: status || undefined, pageToken: nextToken })
      setResources((prev) => [...prev, ...(res.resources ?? [])])
      setNextToken(extractNextPageToken(res))
    } catch (e) {
      console.error('[ApiLinksBrowser] loadMore failed', e instanceof ApiError ? e.data : e)
      setError(formatError(e))
    } finally {
      setLoading(false)
    }
  }

  // Delete：真实调用 DELETE /{id}，成功后从当前列表移除该项（不重新拉全量）
  async function del(res: PaymentResource) {
    if (!window.confirm(`Delete ${res.id}? This calls DELETE on PayPal and cannot be undone.`)) return
    setDeletingId(res.id)
    setDeleteError(null)
    console.log('[ApiLinksBrowser] delete', res.id)
    try {
      await client.deleteLink(res.id)
      setResources((prev) => prev.filter((r) => r.id !== res.id))
    } catch (e) {
      console.error('[ApiLinksBrowser] delete failed', e instanceof ApiError ? e.data : e)
      setDeleteError(`Failed to delete ${res.id}: ${formatError(e)}`)
    } finally {
      setDeletingId(null)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === resources.length ? new Set() : new Set(resources.map((r) => r.id)),
    )
  }

  // 批量删除：逐个 DELETE，用 allSettled 保证一个失败不影响其余；成功的从列表和选中态里摘掉
  async function bulkDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (!window.confirm(`Delete ${ids.length} resource(s)? This calls DELETE on PayPal for each and cannot be undone.`)) return
    setBulkDeleting(true)
    setDeleteError(null)
    console.log('[ApiLinksBrowser] bulkDelete', ids)
    const results = await Promise.allSettled(ids.map((id) => client.deleteLink(id)))
    const failed: string[] = []
    const succeeded: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') succeeded.push(ids[i])
      else {
        failed.push(ids[i])
        console.error('[ApiLinksBrowser] bulkDelete failed', ids[i], r.reason instanceof ApiError ? r.reason.data : r.reason)
      }
    })
    setResources((prev) => prev.filter((r) => !succeeded.includes(r.id)))
    setSelected((prev) => {
      const next = new Set(prev)
      succeeded.forEach((id) => next.delete(id))
      return next
    })
    if (failed.length > 0) {
      setDeleteError(`Failed to delete ${failed.length} of ${ids.length}: ${failed.join(', ')}`)
    }
    setBulkDeleting(false)
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* 控件行 */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            <ListFilter className="h-3.5 w-3.5" /> Status
          </span>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>{s || 'All'}</option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Page size</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="w-24"
          >
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </Select>
        </label>

        <Button variant="outline" loading={loading} onClick={load}>
          <RefreshCw className="h-4 w-4" /> Load
        </Button>
      </div>

      {/* 错误 */}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <p className="mt-1 text-xs opacity-80">
            A 403 here is expected in sandbox when partner authorization isn&apos;t fully wired.
          </p>
        </div>
      )}

      {/* 删除错误 */}
      {deleteError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {/* 列表 / 空状态 */}
      {!loaded && !error && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No resources loaded. Click Load to fetch from PayPal.
        </div>
      )}

      {loaded && resources.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No payment resources found for this filter.
        </div>
      )}

      {resources.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={selected.size === resources.length}
                ref={(el) => {
                  if (el) el.indeterminate = selected.size > 0 && selected.size < resources.length
                }}
                onChange={toggleSelectAll}
              />
              Select all
            </label>
            {selected.size > 0 && (
              <Button size="sm" variant="destructive" loading={bulkDeleting} onClick={bulkDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete selected ({selected.size})
              </Button>
            )}
          </div>

          {resources.map((res) => (
            <ResourceRow
              key={res.id}
              res={res}
              onInspect={onInspect}
              onDelete={del}
              deleting={deletingId === res.id}
              selected={selected.has(res.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* 加载更多 */}
      {nextToken && (
        <div className="flex justify-center">
          <Button variant="ghost" loading={loading} onClick={loadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  )
}

/** 单行紧凑卡片 */
function ResourceRow({
  res,
  onInspect,
  onDelete,
  deleting,
  selected,
  onToggleSelect,
}: {
  res: PaymentResource
  onInspect?: (resourceId: string) => void
  onDelete: (res: PaymentResource) => void
  deleting: boolean
  selected: boolean
  onToggleSelect: (id: string) => void
}) {
  const payUrl = extractPayUrl(res)
  const first = res.line_items?.[0]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <input
          type="checkbox"
          className="mt-1.5 shrink-0"
          checked={selected}
          onChange={() => onToggleSelect(res.id)}
        />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{res.id}</span>
            <span className={cn('rounded-full px-2 py-0.5 text-xs', statusPillClass(res.status))}>
              {res.status ?? 'UNKNOWN'}
            </span>
            {res.reusable && <span className="text-xs text-muted-foreground">{res.reusable}</span>}
            {res.type && <span className="text-xs text-muted-foreground">{res.type}</span>}
          </div>
          <div className="text-sm text-foreground">
            {first ? (
              <>
                <span className="font-medium">{first.name}</span>
                {first.unit_amount && (
                  <span className="ml-2 font-mono text-muted-foreground">
                    {first.unit_amount.currency_code} {first.unit_amount.value}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No line items</span>
            )}
          </div>
          {payUrl && (
            <a
              href={payUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="truncate">{payUrl}</span>
            </a>
          )}
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        {onInspect && (
          <Button size="sm" variant="outline" onClick={() => onInspect(res.id)}>
            Details
          </Button>
        )}
        <Button size="sm" variant="destructive" loading={deleting} onClick={() => onDelete(res)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  )
}
