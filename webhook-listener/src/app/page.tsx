'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Radio,
  Copy,
  Check,
  Trash2,
  LogOut,
  Settings,
  RefreshCw,
  Filter,
  Clock,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Tabs } from '@/components/Tabs'
import { CopyButton } from '@/components/CopyButton'
import { cn, formatTimestamp, formatJSON } from '@/lib/utils'
import type { WebhookEvent as WebhookEventType, Endpoint } from '@/lib/db'

interface User {
  id: number
  email: string
  role: 'admin' | 'user'
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)

  const [events, setEvents] = useState<WebhookEventType[]>([])
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [pollError, setPollError] = useState(false)
  // Polling is off by default to save requests (free Cloudflare tier).
  // Click to run a timed burst; re-click resets the countdown.
  const [polling, setPolling] = useState(false)
  const [durationMin, setDurationMin] = useState(1) // 1 | 3 | 5
  const [remaining, setRemaining] = useState(0) // seconds left in current burst
  // Pagination for viewing older events on demand
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [tab, setTab] = useState('body')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // View mode: 'all' or 'by-endpoint'
  const [viewMode, setViewMode] = useState<'all' | 'by-endpoint'>('all')
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null)

  const maxIdRef = useRef(0)
  const minIdRef = useRef(0) // smallest event id currently loaded (0 = none yet)
  const pollEndRef = useRef(0) // timestamp (ms) when the current burst stops
  const hiddenRef = useRef(false)

  // Load user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) { router.push('/login'); return }
        return res.json()
      })
      .then((data) => {
        if (data?.user) setUser(data.user)
        else router.push('/login')
      })
      .catch(() => router.push('/login'))
      .finally(() => setUserLoading(false))
  }, [router])

  // Load endpoints
  useEffect(() => {
    fetch('/api/endpoints')
      .then((res) => res.json())
      .then((data) => {
        if (data.endpoints) setEndpoints(data.endpoints)
      })
      .catch(() => {})
  }, [])

  // Visibility change
  useEffect(() => {
    const handler = () => { hiddenRef.current = document.hidden }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Polling
  const fetchEvents = useCallback(async () => {
    try {
      const isInitial = maxIdRef.current === 0
      let url = `/api/events?after=${maxIdRef.current}&limit=50`
      if (viewMode === 'by-endpoint' && selectedEndpointId !== null) {
        url += `&endpoint_id=${selectedEndpointId}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        setPollError(true)
        return
      }
      setPollError(false)
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const newEvents = data.events.filter((e: WebhookEventType) => !existingIds.has(e.id))
          return [...newEvents, ...prev]
        })
        for (const ev of data.events) {
          if (ev.id > maxIdRef.current) maxIdRef.current = ev.id
          if (minIdRef.current === 0 || ev.id < minIdRef.current) minIdRef.current = ev.id
        }
      }
      // On the first load, a full page (50) implies older events exist to page into.
      if (isInitial) setHasMore((data.events?.length ?? 0) >= 50)
    } catch {
      setPollError(true)
    }
  }, [router, viewMode, selectedEndpointId])

  // Load a page of older events (id < smallest loaded) on demand.
  const loadOlder = useCallback(async () => {
    if (loadingOlder || minIdRef.current === 0) return
    setLoadingOlder(true)
    try {
      let url = `/api/events?before=${minIdRef.current}&limit=50`
      if (viewMode === 'by-endpoint' && selectedEndpointId !== null) {
        url += `&endpoint_id=${selectedEndpointId}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 401) router.push('/login')
        return
      }
      const data = await res.json()
      const older: WebhookEventType[] = data.events ?? []
      if (older.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const fresh = older.filter((e) => !existingIds.has(e.id))
          return [...prev, ...fresh]
        })
        for (const ev of older) {
          if (minIdRef.current === 0 || ev.id < minIdRef.current) minIdRef.current = ev.id
        }
      }
      setHasMore(older.length >= 50)
    } catch {
      // ignore; user can retry
    } finally {
      setLoadingOlder(false)
    }
  }, [router, viewMode, selectedEndpointId, loadingOlder])

  useEffect(() => {
    maxIdRef.current = 0
    minIdRef.current = 0
    setEvents([])
    setSelectedId(null)
    setHasMore(false)
    fetchEvents()
  }, [viewMode, selectedEndpointId])

  useEffect(() => {
    if (!polling) return
    fetchEvents() // fetch once immediately when a burst starts
    const fetchId = setInterval(() => { if (!hiddenRef.current) fetchEvents() }, 2000)
    const tickId = setInterval(() => {
      const rem = Math.ceil((pollEndRef.current - Date.now()) / 1000)
      if (rem <= 0) {
        setPolling(false)
        setRemaining(0)
      } else {
        setRemaining(rem)
      }
    }, 250)
    return () => { clearInterval(fetchId); clearInterval(tickId) }
  }, [polling, fetchEvents])

  // Webhook URL
  const getWebhookUrl = () => {
    if (typeof window === 'undefined') return '/api/webhook/default'
    const ep = viewMode === 'by-endpoint' && selectedEndpointId
      ? endpoints.find(e => e.id === selectedEndpointId)
      : endpoints.find(e => e.slug === 'default')
    const slug = ep?.slug || 'default'
    return `${window.location.origin}/api/webhook/${slug}`
  }

  const webhookUrl = getWebhookUrl()

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {}
  }

  // Start a polling burst, or reset the countdown if one is already running.
  const togglePolling = () => {
    pollEndRef.current = Date.now() + durationMin * 60_000
    setRemaining(durationMin * 60)
    setPollError(false)
    if (!polling) setPolling(true)
  }

  const fmtRemaining = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Clear events (respects current filter)
  const handleClear = async () => {
    if (!confirm('Delete all visible webhook events?')) return
    // Delete events one by one for the current filter
    const filtered = verifiedOnly ? events.filter(e => e.verification === 'verified') : events
    for (const ev of filtered) {
      await fetch(`/api/events/${ev.id}`, { method: 'DELETE' })
    }
    setEvents([])
    setSelectedId(null)
    maxIdRef.current = 0
  }

  // Delete single
  const handleDelete = async (id: number) => {
    await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setEvents((prev) => prev.filter((e) => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const filteredEvents = verifiedOnly
    ? events.filter((e) => e.verification === 'verified')
    : events

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null

  // Full address this event was received on (for echo in the detail pane)
  const eventAddress = selectedEvent
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/${selectedEvent.endpoint_slug ?? 'default'}`
    : ''

  // Helper to find endpoint label
  const getEndpointLabel = (slug: string | null) => {
    if (!slug) return 'unknown'
    const ep = endpoints.find(e => e.slug === slug)
    return ep?.label || slug
  }

  // ── Loading ──
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  // ── Empty state (no endpoints) ──
  if (endpoints.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Webhook Listener</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
              <Settings className="w-4 h-4" /> Admin
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <Radio className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No webhook endpoints configured</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Go to the Admin panel to register webhook endpoints. Each endpoint gets its own URL and optional PayPal verification credentials.
            </p>
            <Button onClick={() => router.push('/admin')}>
              <Settings className="w-4 h-4" />
              Open Admin
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Normal dashboard ──
  return (
    <div className="min-h-screen bg-background flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex flex-col border-b border-border shrink-0">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              <h1 className="font-semibold text-sm">Webhook Listener</h1>
            </div>

            {/* Webhook URL copy */}
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 py-1.5">
              <code className="text-xs text-muted-foreground max-w-[320px] truncate font-mono">
                {webhookUrl}
              </code>
              <button onClick={copyWebhookUrl} className="p-0.5 rounded hover:bg-accent transition-colors shrink-0">
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Polling control — off by default; click to run a timed burst */}
            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={togglePolling}
                title={polling ? '点击重置倒计时' : '点击开始轮询'}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium transition-colors',
                  polling
                    ? pollError
                      ? 'border-destructive/40 bg-destructive/10 text-destructive'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', polling && 'animate-spin')} />
                {polling
                  ? pollError
                    ? `重连中 ${fmtRemaining(remaining)}`
                    : `轮询中 ${fmtRemaining(remaining)}`
                  : '轮询'}
              </button>
              {/* Duration presets */}
              <div className="flex items-center bg-secondary rounded-md p-0.5">
                {[1, 3, 5].map((m) => (
                  <button
                    key={m}
                    onClick={() => setDurationMin(m)}
                    title={`每次轮询 ${m} 分钟`}
                    className={cn(
                      'px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors',
                      durationMin === m
                        ? 'bg-card text-foreground shadow'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-secondary rounded-md p-0.5 mr-2">
              <button
                onClick={() => setViewMode('all')}
                className={cn(
                  'px-3 py-1 text-xs rounded font-medium transition-colors',
                  viewMode === 'all' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All Events
              </button>
              <button
                onClick={() => {
                  setViewMode('by-endpoint')
                  if (!selectedEndpointId && endpoints.length > 0) {
                    setSelectedEndpointId(endpoints[0].id)
                  }
                }}
                className={cn(
                  'px-3 py-1 text-xs rounded font-medium transition-colors',
                  viewMode === 'by-endpoint' ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                By Endpoint
              </button>
            </div>

            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                verifiedOnly ? 'bg-emerald-500/15 text-emerald-400' : 'bg-secondary text-muted-foreground hover:text-foreground'
              )}
            >
              <Filter className="w-3.5 h-3.5" /> Verified only
            </button>

            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>

            <span className="text-xs text-muted-foreground">{user?.email}</span>

            {user?.role === 'admin' && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Endpoint tabs (By Endpoint mode) */}
        {viewMode === 'by-endpoint' && (
          <div className="flex items-center gap-1 px-6 py-2 border-t border-border/50 overflow-x-auto">
            {endpoints.filter(e => !!e.enabled).map((ep) => (
              <button
                key={ep.id}
                onClick={() => setSelectedEndpointId(ep.id)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md font-medium whitespace-nowrap transition-colors',
                  selectedEndpointId === ep.id
                    ? 'bg-primary/15 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {ep.label}
                <span className="ml-1.5 text-[10px] opacity-60">{ep.paypal_env}</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Event list */}
        <aside className="w-80 border-r border-border overflow-y-auto shrink-0">
          {filteredEvents.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center mt-8">
              No events yet. Send a POST to the webhook URL above.
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => setSelectedId(event.id)}
                className={cn(
                  'px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-accent/50',
                  selectedId === event.id && 'bg-accent border-l-2 border-l-primary'
                )}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(event.received_at)}
                  </span>
                  <VerificationBadge status={event.verification} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {event.event_type || event.method}
                  </span>
                  {event.resource_type && (
                    <Badge variant="info">{event.resource_type}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  {event.endpoint_slug && (
                    <Badge variant="default" className="text-[10px]">
                      <Layers className="w-2.5 h-2.5 mr-0.5" />
                      {getEndpointLabel(event.endpoint_slug)}
                    </Badge>
                  )}
                  {event.source_ip && <span className="truncate">{event.source_ip}</span>}
                </div>
              </div>
            ))
          )}
          {events.length > 0 && hasMore && (
            <button
              onClick={loadOlder}
              disabled={loadingOlder}
              className="w-full px-4 py-3 text-xs text-center text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-50"
            >
              {loadingOlder ? '加载中…' : '加载更早'}
            </button>
          )}
        </aside>

        {/* Right: Event detail */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedEvent ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Event #{selectedEvent.id}</span>
                  <VerificationBadge status={selectedEvent.verification} />
                  {selectedEvent.event_type && (
                    <Badge variant="default">{selectedEvent.event_type}</Badge>
                  )}
                  {selectedEvent.resource_type && (
                    <Badge variant="info">{selectedEvent.resource_type}</Badge>
                  )}
                  {selectedEvent.endpoint_slug && (
                    <Badge variant="default" className="text-xs">
                      <Layers className="w-3 h-3 mr-1" />
                      {getEndpointLabel(selectedEvent.endpoint_slug)}
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedEvent.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>

              <div className="px-6 py-2 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-4">
                <span>Received: {new Date(selectedEvent.received_at).toLocaleString()}</span>
                {selectedEvent.source_ip && <span>IP: {selectedEvent.source_ip}</span>}
                {selectedEvent.content_type && <span>Content-Type: {selectedEvent.content_type}</span>}
              </div>

              <div className="px-6 py-2 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="shrink-0">Address:</span>
                <code className="font-mono text-foreground/80 truncate">{eventAddress}</code>
                <div className="shrink-0"><CopyButton text={eventAddress} /></div>
              </div>

              <Tabs
                tabs={[
                  { id: 'body', label: 'Body' },
                  { id: 'headers', label: 'Headers' },
                  { id: 'raw', label: 'Raw' },
                ]}
                active={tab}
                onChange={setTab}
              />

              <div className="flex-1 overflow-auto p-6">
                {tab === 'body' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0"><CopyButton text={formatJSON(selectedEvent.raw_body)} /></div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">{formatJSON(selectedEvent.raw_body)}</pre>
                  </div>
                )}
                {tab === 'headers' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0"><CopyButton text={formatJSON(selectedEvent.headers)} /></div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">{formatJSON(selectedEvent.headers)}</pre>
                  </div>
                )}
                {tab === 'raw' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0"><CopyButton text={selectedEvent.raw_body} /></div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">{selectedEvent.raw_body}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Select an event from the list to view details
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
    verified: { label: '\u2713 Verified', variant: 'success' },
    failed: { label: '\u2717 Failed', variant: 'error' },
    skipped: { label: 'Skipped', variant: 'default' },
    error: { label: 'Error', variant: 'warning' },
  }
  const info = map[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={info.variant}>{info.label}</Badge>
}