'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Key,
  Shield,
  User as UserIcon,
  Copy,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'

interface User {
  id: number
  email: string
  role: 'admin' | 'user'
  created_at: number
  created_by: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; role: string } | null>(null)

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  // Reset password
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetting, setResetting] = useState(false)

  // Endpoint state
  const [endpoints, setEndpoints] = useState<Array<{
    id: number; label: string; slug: string; description: string;
    enabled: number; paypal_env: string; paypal_client_id: string;
    paypal_client_secret: string; paypal_webhook_id: string; created_at: number
  }>>([])
  const [showEndpointForm, setShowEndpointForm] = useState(false)
  const [editingEndpoint, setEditingEndpoint] = useState<typeof endpoints[0] | null>(null)
  const [epLabel, setEpLabel] = useState('')
  const [epSlug, setEpSlug] = useState('')
  const [epDesc, setEpDesc] = useState('')
  const [epEnv, setEpEnv] = useState('sandbox')
  const [epClientId, setEpClientId] = useState('')
  const [epClientSecret, setEpClientSecret] = useState('')
  const [epWebhookId, setEpWebhookId] = useState('')
  const [epError, setEpError] = useState('')
  const [epSaving, setEpSaving] = useState(false)

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.status === 401 || res.status === 403) {
        router.push('/')
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
    } catch {
      // handle error silently
    } finally {
      setLoading(false)
    }
  }

  const loadEndpoints = async () => {
    try {
      const res = await fetch('/api/admin/endpoints')
      if (res.ok) {
        const data = await res.json()
        setEndpoints(data.endpoints || [])
      }
    } catch {}
  }

  useEffect(() => {
    // Check current user
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user)
          if (data.user.role !== 'admin') {
            router.push('/')
          } else {
            loadUsers()
            loadEndpoints()
          }
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
  }, [router])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        setCreateError(data.error || 'Failed to create user')
        return
      }

      setNewEmail('')
      setNewPassword('')
      setNewRole('user')
      setShowCreate(false)
      await loadUsers()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Delete user "${email}"? This cannot be undone.`)) return

    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id))
    }
  }

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!resetId) return
    setResetError('')
    setResetting(true)

    try {
      const res = await fetch(`/api/admin/users/${resetId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })

      if (!res.ok) {
        const data = await res.json()
        setResetError(data.error || 'Failed to reset password')
        return
      }

      setResetId(null)
      setResetPassword('')
    } catch {
      setResetError('Network error')
    } finally {
      setResetting(false)
    }
  }

  // ── Endpoint handlers ──

  const openNewEndpoint = () => {
    setEditingEndpoint(null)
    setEpLabel('')
    setEpSlug('')
    setEpDesc('')
    setEpEnv('sandbox')
    setEpClientId('')
    setEpClientSecret('')
    setEpWebhookId('')
    setEpError('')
    setShowEndpointForm(true)
  }

  const openEditEndpoint = (ep: typeof endpoints[0]) => {
    setEditingEndpoint(ep)
    setEpLabel(ep.label)
    setEpSlug(ep.slug)
    setEpDesc(ep.description)
    setEpEnv(ep.paypal_env)
    setEpClientId(ep.paypal_client_id)
    setEpClientSecret(ep.paypal_client_secret)
    setEpWebhookId(ep.paypal_webhook_id)
    setEpError('')
    setShowEndpointForm(true)
  }

  const handleEndpointSave = async (e: FormEvent) => {
    e.preventDefault()
    setEpError('')
    setEpSaving(true)

    const body = {
      label: epLabel,
      slug: epSlug,
      description: epDesc,
      enabled: 1,
      paypal_env: epEnv,
      paypal_client_id: epClientId,
      paypal_client_secret: epClientSecret,
      paypal_webhook_id: epWebhookId,
    }

    try {
      const url = editingEndpoint
        ? `/api/admin/endpoints/${editingEndpoint.id}`
        : '/api/admin/endpoints'
      const method = editingEndpoint ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        setEpError(data.error || 'Failed to save endpoint')
        return
      }

      setShowEndpointForm(false)
      await loadEndpoints()
    } catch {
      setEpError('Network error')
    } finally {
      setEpSaving(false)
    }
  }

  const handleDeleteEndpoint = async (id: number, label: string) => {
    if (!confirm(`Delete endpoint "${label}" and all its events? This cannot be undone.`)) return
    await fetch(`/api/admin/endpoints/${id}`, { method: 'DELETE' })
    setEndpoints(prev => prev.filter(e => e.id !== id))
  }

  const handleToggleEndpoint = async (id: number) => {
    const res = await fetch(`/api/admin/endpoints/${id}/toggle`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      if (data.endpoint) {
        setEndpoints(prev => prev.map(e => e.id === id ? data.endpoint : e))
      }
    }
  }

  const copyEndpointUrl = async (slug: string) => {
    const url = `${window.location.origin}/api/webhook/${slug}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {}
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="font-semibold">User Management</h1>
        </div>
        <Button variant="default" size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </header>

      <div className="max-w-2xl mx-auto p-6">
        {/* Create form */}
        {showCreate && (
          <div className="mb-6 bg-card border border-border rounded-lg p-4">
            <h2 className="text-sm font-medium mb-4">Create New User</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Min 6 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                  className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {createError && (
                <div className="text-xs text-destructive">{createError}</div>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* User list */}
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  {user.role === 'admin' ? (
                    <Shield className="w-4 h-4 text-primary" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {user.email}
                    {user.role === 'admin' && <Badge variant="success">Admin</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(user.created_at).toLocaleDateString()}
                    {user.created_by && ` by ${user.created_by}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResetId(user.id)
                    setResetPassword('')
                    setResetError('')
                  }}
                  title="Reset password"
                >
                  <Key className="w-3.5 h-3.5" />
                </Button>
                {user.id !== currentUser?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(user.id, user.email)}
                    title="Delete user"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>

              {/* Inline reset password form */}
              {resetId === user.id && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                  {/* This is a simplification — in production we'd use a dialog */}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Reset password modal (simple approach) */}
        {resetId !== null && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm">
              <h2 className="text-sm font-medium mb-4">Reset Password</h2>
              <form onSubmit={handleResetSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Min 6 characters"
                  />
                </div>
                {resetError && (
                  <div className="text-xs text-destructive">{resetError}</div>
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={resetting}>
                    {resetting ? 'Resetting…' : 'Reset'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setResetId(null)
                      setResetPassword('')
                      setResetError('')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {users.length === 0 && !showCreate && (
          <div className="text-center text-sm text-muted-foreground py-12">
            No users found. Add your first user above.
          </div>
        )}

        {/* Endpoints Section */}
        <div className="mt-10 border-t border-border pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Webhook Endpoints</h2>
            <Button variant="default" size="sm" onClick={openNewEndpoint}>
              <Plus className="w-4 h-4" /> Add Endpoint
            </Button>
          </div>

          {endpoints.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No endpoints configured. Add your first webhook endpoint above.
            </div>
          ) : (
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div key={ep.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ep.enabled ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        {ep.label}
                        <Badge variant="info" className="text-[10px]">{ep.paypal_env}</Badge>
                        {!ep.enabled && <Badge variant="error" className="text-[10px]">Disabled</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="text-xs text-muted-foreground truncate max-w-[200px]">
                          /api/webhook/{ep.slug}
                        </code>
                        <button onClick={() => copyEndpointUrl(ep.slug)} className="p-0.5 rounded hover:bg-accent shrink-0">
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                      {ep.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">{ep.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => handleToggleEndpoint(ep.id)} title={ep.enabled ? 'Disable' : 'Enable'}>
                      {ep.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditEndpoint(ep)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEndpoint(ep.id, ep.label)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Endpoint Create/Edit Modal */}
        {showEndpointForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-sm font-medium mb-4">
                {editingEndpoint ? 'Edit Endpoint' : 'New Endpoint'}
              </h2>
              <form onSubmit={handleEndpointSave} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Label</label>
                  <input type="text" value={epLabel} onChange={e => setEpLabel(e.target.value)} required
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Site A Production" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Slug (URL path)</label>
                  <input type="text" value={epSlug} onChange={e => setEpSlug(e.target.value)} required
                    pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only"
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="site-a" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    URL will be: /api/webhook/{epSlug || '...'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description</label>
                  <input type="text" value={epDesc} onChange={e => setEpDesc(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Optional" />
                </div>
                <fieldset className="border border-border rounded-md p-3 space-y-3">
                  <legend className="text-xs font-medium px-1">PayPal Verification (optional)</legend>
                  <div>
                    <label className="block text-xs font-medium mb-1">Environment</label>
                    <select value={epEnv} onChange={e => setEpEnv(e.target.value)}
                      className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      <option value="sandbox">Sandbox</option>
                      <option value="live">Live</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Client ID</label>
                    <input type="text" value={epClientId} onChange={e => setEpClientId(e.target.value)}
                      className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Client Secret</label>
                    <input type="password" value={epClientSecret} onChange={e => setEpClientSecret(e.target.value)}
                      className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Webhook ID</label>
                    <input type="text" value={epWebhookId} onChange={e => setEpWebhookId(e.target.value)}
                      className="w-full h-9 px-3 rounded-md bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </fieldset>
                {epError && <div className="text-xs text-destructive">{epError}</div>}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" size="sm" disabled={epSaving}>
                    {epSaving ? 'Saving…' : editingEndpoint ? 'Update' : 'Create'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowEndpointForm(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}