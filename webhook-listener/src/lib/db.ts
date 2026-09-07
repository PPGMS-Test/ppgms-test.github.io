/**
 * D1 data access layer for webhook-listener.
 *
 * In production (Cloudflare Pages), the D1 binding is attached to the request
 * context via @cloudflare/next-on-pages's getRequestContext().
 *
 * In local next-dev, D1 bindings are not available — we fall back to an
 * in-memory store so the entire app works without Wrangler. Data is lost on
 * restart; use wrangler dev for full D1 integration locally.
 */

import { getRequestContext } from '@cloudflare/next-on-pages'

// ── Types ──────────────────────────────────────────────────────────────────

export interface D1Result<T> {
  results?: T[]
  meta?: { last_row_id?: number }
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T>(): Promise<T | null>
  all<T>(): Promise<D1Result<T>>
  run(): Promise<D1Result<unknown>>
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement
  exec(sql: string): Promise<void>
}

export interface Endpoint {
  id: number
  label: string
  slug: string
  description: string
  enabled: number
  paypal_env: string
  paypal_client_id: string
  paypal_client_secret: string
  paypal_webhook_id: string
  created_at: number
}

export interface EndpointInput {
  label: string
  slug: string
  description: string
  enabled: number
  paypal_env: string
  paypal_client_id: string
  paypal_client_secret: string
  paypal_webhook_id: string
}

export interface WebhookEvent {
  id: number
  received_at: number
  method: string
  query: string
  source_ip: string
  content_type: string
  headers: string
  raw_body: string
  event_type: string | null
  resource_type: string | null
  verification: string
  endpoint_id: number | null
  endpoint_slug: string | null
}

export interface WebhookEventInput {
  received_at: number
  method: string
  query: string
  source_ip: string
  content_type: string
  headers: string
  raw_body: string
  event_type: string | null
  resource_type: string | null
  verification: string
  endpoint_id: number | null
  endpoint_slug: string | null
}

const MAX_EVENTS = 200

// ── In-memory store (fallback for local next-dev) ──────────────────────────

type Row = Record<string, unknown>

class InMemoryDB implements D1Database {
  tables = new Map<string, { rows: Row[]; nextId: number; columns: string[] }>()

  ensureTable(name: string): { rows: Row[]; nextId: number; columns: string[] } {
    let t = this.tables.get(name)
    if (!t) {
      t = { rows: [], nextId: 1, columns: [] }
      this.tables.set(name, t)
    }
    return t
  }

  prepare(sql: string): D1PreparedStatement {
    return new InMemoryStmt(this, sql)
  }

  exec(_sql: string): Promise<void> {
    // Simple exec for DELETE all / retention — handled inline
    return Promise.resolve()
  }
}

class InMemoryStmt implements D1PreparedStatement {
  private params: unknown[] = []

  constructor(
    private db: InMemoryDB,
    private sql: string,
  ) {}

  bind(...values: unknown[]): this {
    this.params = values
    return this
  }

  private tableNameFrom(sql: string): string | null {
    // Extract table name from INSERT INTO xxx, SELECT FROM xxx, DELETE FROM xxx, UPDATE xxx
    const m = sql.match(/(?:INSERT\s+INTO|FROM|UPDATE|DELETE\s+FROM)\s+(\w+)/i)
    return m ? m[1].toLowerCase() : null
  }

  all<T>(): Promise<D1Result<T>> {
    const sql = this.sql.trim()
    const upper = sql.toUpperCase()

    // ── INSERT ──
    if (upper.startsWith('INSERT')) {
      const tableName = this.tableNameFrom(sql) || 'webhook_events'
      const t = this.db.ensureTable(tableName)
      const row: Row = { id: t.nextId++ }

      // Parse "(col1, col2, ...) VALUES (?, ?, ...)"
      const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i)
      if (colsMatch) {
        const cols = colsMatch[1].split(',').map((c) => c.trim().toLowerCase())
        t.columns = cols
        cols.forEach((col, i) => {
          row[col] = this.params[i] ?? null
        })
      }

      t.rows.unshift(row)

      // Enforce retention for webhook_events
      if (tableName === 'webhook_events' && t.rows.length > MAX_EVENTS) {
        t.rows = t.rows.slice(0, MAX_EVENTS)
      }

      return Promise.resolve({
        meta: { last_row_id: row.id as number },
      }) as Promise<D1Result<T>>
    }

    // ── SELECT ──
    if (upper.startsWith('SELECT')) {
      const tableName = this.tableNameFrom(sql) || 'webhook_events'
      const t = this.db.ensureTable(tableName)

      // COUNT(*)
      if (upper.includes('COUNT(*)')) {
        return Promise.resolve({ results: [{ cnt: t.rows.length }] as unknown as T[] })
      }

      // Apply basic filters
      let results = [...t.rows]

      // WHERE id > ?
      if (upper.includes('WHERE') && upper.includes('ID > ?')) {
        const after = Number(this.params[0] ?? 0)
        results = results.filter((r) => Number(r.id) > after)
      }
      // WHERE id = ?
      else if (upper.includes('WHERE') && upper.includes('ID = ?')) {
        const id = Number(this.params[0])
        results = results.filter((r) => Number(r.id) === id)
      }
      // WHERE email = ?
      else if (upper.includes('WHERE') && upper.includes('EMAIL = ?')) {
        const email = String(this.params[0] ?? '').toLowerCase()
        results = results.filter((r) => String(r.email ?? '').toLowerCase() === email)
      }
      // WHERE token_hash = ? AND expires_at > ?
      else if (upper.includes('WHERE') && upper.includes('TOKEN_HASH = ?') && upper.includes('EXPIRES_AT > ?')) {
        const tokenHash = String(this.params[0] ?? '')
        const now = Number(this.params[1] ?? 0)
        results = results.filter((r) => r.token_hash === tokenHash && Number(r.expires_at) > now)
      }
      // WHERE user_id = ?
      else if (upper.includes('WHERE') && upper.includes('USER_ID = ?')) {
        const userId = Number(this.params[0])
        results = results.filter((r) => Number(r.user_id) === userId)
      }
      // Generic single-column WHERE clause catch-all
      else if (upper.includes('WHERE') && this.params.length >= 1) {
        // Extract column name from WHERE xxx = ?
        const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i)
        if (whereMatch) {
          const colName = whereMatch[1].toLowerCase()
          const val = String(this.params[0] ?? '')
          results = results.filter((r) => String(r[colName] ?? '') === val)
        }
      }

      // Sort
      if (upper.includes('ORDER BY ID DESC')) {
        results.sort((a, b) => Number(b.id) - Number(a.id))
      } else if (upper.includes('ORDER BY ID')) {
        results.sort((a, b) => Number(a.id) - Number(b.id))
      }

      // LIMIT
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
      if (limitMatch) {
        results = results.slice(0, Number(limitMatch[1]))
      }

      // JOIN: sessions s JOIN users u ON s.user_id = u.id
      if (upper.includes('JOIN') && upper.includes('USERS U ON S.USER_ID = U.ID')) {
        const usersTable = this.db.ensureTable('users')
        results = results.map((sessionRow) => {
          const userRows = usersTable.rows.filter((u) => Number(u.id) === Number(sessionRow.user_id))
          const u = userRows[0] || {}
          return {
            ...sessionRow,
            uid: u.id,
            email: u.email,
            role: u.role,
          }
        })
      }

      return Promise.resolve({ results: results as unknown as T[] })
    }

    // ── DELETE ──
    if (upper.startsWith('DELETE')) {
      const tableName = this.tableNameFrom(sql) || 'webhook_events'
      const t = this.db.ensureTable(tableName)

      if (upper.includes('WHERE ID = ?')) {
        const id = Number(this.params[0])
        t.rows = t.rows.filter((r) => Number(r.id) !== id)
      } else if (upper.includes('WHERE USER_ID = ?')) {
        const userId = Number(this.params[0])
        t.rows = t.rows.filter((r) => Number(r.user_id) !== userId)
      } else if (upper.includes('WHERE TOKEN_HASH = ?')) {
        const tokenHash = String(this.params[0])
        t.rows = t.rows.filter((r) => r.token_hash !== tokenHash)
      } else if (upper.includes('WHERE ID NOT IN')) {
        const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
        if (limitMatch) {
          const limit = Number(limitMatch[1])
          const sorted = [...t.rows].sort((a, b) => Number(b.id) - Number(a.id))
          const keepIds = new Set(sorted.slice(0, limit).map((r) => r.id))
          t.rows = t.rows.filter((r) => keepIds.has(r.id))
        }
      } else {
        // DELETE all
        t.rows = []
        t.nextId = 1
      }

      return Promise.resolve({ results: [] as unknown as T[] })
    }

    // ── UPDATE ──
    if (upper.startsWith('UPDATE')) {
      const tableName = this.tableNameFrom(sql) || 'users'
      const t = this.db.ensureTable(tableName)

      if (upper.includes('WHERE ID = ?')) {
        const id = Number(this.params[this.params.length - 1])
        const row = t.rows.find((r) => Number(r.id) === id)
        if (row) {
          const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i)
          if (setMatch) {
            const setClauses = setMatch[1].split(',').map((s) => s.trim())
            const newValues = this.params.slice(0, setClauses.length)
            setClauses.forEach((clause, i) => {
              const col = clause.split('=')[0].trim().toLowerCase()
              row[col] = newValues[i]
            })
          }
        }
      }

      return Promise.resolve({ results: [] as unknown as T[] })
    }

    return Promise.resolve({ results: [] })
  }

  first<T>(): Promise<T | null> {
    return this.all<T>().then((r) => (r.results?.length ? r.results[0] : null))
  }

  run(): Promise<D1Result<unknown>> {
    return this.all()
  }
}

// Global memory DB — uses globalThis so it survives Next.js module re-evaluation
// across different route chunks during dev

const GLOBAL_KEY = '__WL_MEMORY_DB__'

function getMemoryDB(): InMemoryDB {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new InMemoryDB()
  }
  return g[GLOBAL_KEY] as InMemoryDB
}

// ── DB resolution ──────────────────────────────────────────────────────────

export function getDB(): D1Database {
  try {
    const ctx = getRequestContext()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = ctx?.env as Record<string, unknown> | undefined
    if (env?.DB) {
      return env.DB as D1Database
    }
  } catch {
    // getRequestContext() throws when D1 binding is not available
    // (e.g. local next-dev without wrangler dev). Fallback to in-memory.
  }

  // Fallback to in-memory store for local development
  const g = globalThis as any
  if (!g['__WL_DB_WARNED__']) {
    g['__WL_DB_WARNED__'] = true
    console.warn('[db] D1 binding not available — using in-memory store (data lost on restart)')
  }
  return getMemoryDB() as unknown as D1Database
}

// ── Operations ─────────────────────────────────────────────────────────────

export async function insertEvent(db: D1Database, event: WebhookEventInput): Promise<WebhookEvent> {
  const result = await db
    .prepare(
      `INSERT INTO webhook_events
       (received_at, method, query, source_ip, content_type, headers, raw_body, event_type, resource_type, verification, endpoint_id, endpoint_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      event.received_at,
      event.method,
      event.query,
      event.source_ip,
      event.content_type,
      event.headers,
      event.raw_body,
      event.event_type,
      event.resource_type,
      event.verification,
      event.endpoint_id,
      event.endpoint_slug
    )
    .run()

  const id = (result.meta?.last_row_id as number) ?? 0

  // Enforce retention for real D1
  if (!(db instanceof InMemoryDB)) {
    await enforceRetention(db)
  }

  return { id, ...event }
}

export async function getEvents(
  db: D1Database,
  after: number = 0,
  limit: number = 50,
  endpointId?: number
): Promise<WebhookEvent[]> {
  if (endpointId !== undefined) {
    const result = await db
      .prepare(
        `SELECT * FROM webhook_events
         WHERE id > ? AND endpoint_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .bind(after, endpointId, limit)
      .all<WebhookEvent>()
    return result.results ?? []
  }

  const result = await db
    .prepare(
      `SELECT * FROM webhook_events
       WHERE id > ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .bind(after, limit)
    .all<WebhookEvent>()
  return result.results ?? []
}

export async function deleteEvent(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM webhook_events WHERE id = ?').bind(id).run()
}

export async function clearEvents(db: D1Database): Promise<void> {
  await db.exec('DELETE FROM webhook_events')
}

export async function enforceRetention(db: D1Database): Promise<void> {
  await db.exec(
    `DELETE FROM webhook_events
     WHERE id NOT IN (
       SELECT id FROM webhook_events
       ORDER BY id DESC
       LIMIT ${MAX_EVENTS}
     )`
  )
}

// ── Endpoint CRUD ──────────────────────────────────────────────────────────

export async function getEndpoints(db: D1Database): Promise<Endpoint[]> {
  const result = await db
    .prepare('SELECT * FROM endpoints ORDER BY id')
    .all<Endpoint>()
  return result.results ?? []
}

export async function getEndpointBySlug(db: D1Database, slug: string): Promise<Endpoint | null> {
  const result = await db
    .prepare('SELECT * FROM endpoints WHERE slug = ?')
    .bind(slug)
    .first<Endpoint>()
  return result ?? null
}

export async function getEndpointById(db: D1Database, id: number): Promise<Endpoint | null> {
  const result = await db
    .prepare('SELECT * FROM endpoints WHERE id = ?')
    .bind(id)
    .first<Endpoint>()
  return result ?? null
}

export async function createEndpoint(db: D1Database, input: EndpointInput): Promise<Endpoint> {
  const now = Date.now()
  const result = await db
    .prepare(
      `INSERT INTO endpoints (label, slug, description, enabled, paypal_env, paypal_client_id, paypal_client_secret, paypal_webhook_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(input.label, input.slug, input.description, input.enabled, input.paypal_env,
          input.paypal_client_id, input.paypal_client_secret, input.paypal_webhook_id, now)
    .run()

  const id = (result.meta?.last_row_id as number) ?? 0
  return { id, ...input, created_at: now }
}

export async function updateEndpoint(db: D1Database, id: number, input: EndpointInput): Promise<void> {
  await db
    .prepare(
      `UPDATE endpoints SET label=?, slug=?, description=?, enabled=?, paypal_env=?, paypal_client_id=?, paypal_client_secret=?, paypal_webhook_id=? WHERE id=?`
    )
    .bind(input.label, input.slug, input.description, input.enabled, input.paypal_env,
          input.paypal_client_id, input.paypal_client_secret, input.paypal_webhook_id, id)
    .run()
}

export async function deleteEndpoint(db: D1Database, id: number): Promise<void> {
  // Delete events associated with this endpoint
  await db.prepare('DELETE FROM webhook_events WHERE endpoint_id = ?').bind(id).run()
  await db.prepare('DELETE FROM endpoints WHERE id = ?').bind(id).run()
}

export async function toggleEndpoint(db: D1Database, id: number): Promise<Endpoint | null> {
  const current = await getEndpointById(db, id)
  if (!current) return null
  const newEnabled = current.enabled ? 0 : 1
  await db
    .prepare('UPDATE endpoints SET enabled = ? WHERE id = ?')
    .bind(newEnabled, id)
    .run()
  return { ...current, enabled: newEnabled }
}