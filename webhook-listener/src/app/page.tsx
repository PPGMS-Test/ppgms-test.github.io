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
  Wifi,
  WifiOff,
  Filter,
  ChevronRight,
  Clock,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Tabs } from '@/components/Tabs'
import { CopyButton } from '@/components/CopyButton'
import { cn, formatTimestamp, formatJSON } from '@/lib/utils'
import type { WebhookEvent as WebhookEventType } from '@/lib/db'

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
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [polling, setPolling] = useState(true)
  const [pollError, setPollError] = useState(false)
  const [tab, setTab] = useState('body')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const maxIdRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hiddenRef = useRef(false)

  // Load current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login')
          return
        }
        return res.json()
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setUserLoading(false))
  }, [router])

  // Visibility change handler
  useEffect(() => {
    const handler = () => {
      hiddenRef.current = document.hidden
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [])

  // Polling
  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/events?after=${maxIdRef.current}&limit=50`)
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setPollError(true)
        return
      }
      setPollError(false)
      const data = await res.json()
      if (data.events && data.events.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const newEvents = data.events.filter((e: WebhookEventType) => !existingIds.has(e.id))
          const merged = [...newEvents, ...prev]
          // Enforce local limit of 500 to prevent runaway memory
          return merged.slice(0, 500)
        })
        // Update max id
        for (const ev of data.events) {
          if (ev.id > maxIdRef.current) maxIdRef.current = ev.id
        }
      }
    } catch {
      setPollError(true)
    }
  }, [router])

  useEffect(() => {
    // Initial load
    fetchEvents()

    pollingRef.current = setInterval(() => {
      if (!hiddenRef.current) {
        fetchEvents()
      }
    }, 2000)

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [fetchEvents])

  // Webhook URL
  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/webhook`
      : '/api/webhook'

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    } catch {
      // fallback
    }
  }

  // Logout
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  // Clear all
  const handleClear = async () => {
    if (!confirm('Delete all webhook events?')) return
    await fetch('/api/events', { method: 'DELETE' })
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

  // Filtered events
  const filteredEvents = verifiedOnly
    ? events.filter((e) => e.verification === 'verified')
    : events

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null

  // --- Loading state ---
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  // --- Empty state ---
  if (events.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Webhook Listener</h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === 'admin' && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
                <Settings className="w-4 h-4" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
              <Radio className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No webhook events yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Point your PayPal webhook to the URL below. Events will appear here in real time.
            </p>

            {/* Webhook URL copy */}
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 mb-4">
              <code className="text-sm text-foreground flex-1 break-all text-left font-mono">
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhookUrl}
                className="p-1.5 rounded-md hover:bg-accent transition-colors shrink-0"
                title="Copy URL"
              >
                {copiedUrl ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>To enable signature verification, set these environment variables:</p>
              <code className="block bg-card rounded px-3 py-2 mt-2 text-left">
                PAYPAL_ENV=sandbox<br />
                PAYPAL_CLIENT_ID=…<br />
                PAYPAL_CLIENT_SECRET=…<br />
                PAYPAL_WEBHOOK_ID=…
              </code>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- Normal dashboard ---
  return (
    <div className="min-h-screen bg-background flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-sm">Webhook Listener</h1>
          </div>

          {/* Webhook URL copy */}
          <div className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 py-1.5">
            <code className="text-xs text-muted-foreground max-w-[280px] truncate font-mono">
              {webhookUrl}
            </code>
            <button
              onClick={copyWebhookUrl}
              className="p-0.5 rounded hover:bg-accent transition-colors shrink-0"
              title="Copy URL"
            >
              {copiedUrl ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Polling indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {pollError ? (
              <WifiOff className="w-3.5 h-3.5 text-destructive" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-400 polling-dot" />
            )}
            <span className={pollError ? 'text-destructive' : 'text-muted-foreground'}>
              {pollError ? 'Offline' : 'Live'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Verified-only toggle */}
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              verifiedOnly
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Verified only
          </button>

          {/* Clear all */}
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-muted-foreground hover:text-destructive transition-colors"
            title="Clear all events"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>

          {/* Current user */}
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
      </header>

      {/* Main content: split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Event list */}
        <aside className="w-80 border-r border-border overflow-y-auto shrink-0">
          {filteredEvents.map((event) => (
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
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {event.source_ip && `${event.source_ip}`}
                {event.query && ` ${event.query}`}
              </div>
            </div>
          ))}
          {filteredEvents.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              No matching events
            </div>
          )}
        </aside>

        {/* Right: Event detail */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedEvent ? (
            <>
              {/* Detail header */}
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
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(selectedEvent.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>

              {/* Metadata row */}
              <div className="px-6 py-2 border-b border-border/50 text-xs text-muted-foreground flex items-center gap-4">
                <span>Received: {new Date(selectedEvent.received_at).toLocaleString()}</span>
                {selectedEvent.source_ip && <span>IP: {selectedEvent.source_ip}</span>}
                {selectedEvent.content_type && (
                  <span>Content-Type: {selectedEvent.content_type}</span>
                )}
              </div>

              {/* Tabs */}
              <Tabs
                tabs={[
                  { id: 'body', label: 'Body' },
                  { id: 'headers', label: 'Headers' },
                  { id: 'raw', label: 'Raw' },
                ]}
                active={tab}
                onChange={setTab}
              />

              {/* Tab content */}
              <div className="flex-1 overflow-auto p-6">
                {tab === 'body' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton text={formatJSON(selectedEvent.raw_body)} />
                    </div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                      {formatJSON(selectedEvent.raw_body)}
                    </pre>
                  </div>
                )}

                {tab === 'headers' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton text={formatJSON(selectedEvent.headers)} />
                    </div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                      {formatJSON(selectedEvent.headers)}
                    </pre>
                  </div>
                )}

                {tab === 'raw' && (
                  <div className="relative">
                    <div className="absolute top-0 right-0">
                      <CopyButton text={selectedEvent.raw_body} />
                    </div>
                    <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                      {selectedEvent.raw_body}
                    </pre>
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

// ── Sub-components ─────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'default' }> = {
    verified: { label: '✓ Verified', variant: 'success' },
    failed: { label: '✗ Failed', variant: 'error' },
    skipped: { label: 'Skipped', variant: 'default' },
    error: { label: 'Error', variant: 'warning' },
  }

  const info = map[status] ?? { label: status, variant: 'default' as const }

  return <Badge variant={info.variant}>{info.label}</Badge>
}