# Webhook Listener Multi-Endpoint & Verification Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor webhook-listener to support multiple named webhook endpoints (each with independent verification credentials) and a dual-view dashboard (All Events / By Endpoint).

**Architecture:** New `endpoints` D1 table stores per-path config (label, slug, credentials, enabled). Events gain `endpoint_id`/`endpoint_slug` columns. Webhook route becomes `[slug]` dynamic, verification reads per-endpoint credentials. Dashboard adds view toggle with endpoint tabs. Admin page gains endpoint CRUD section.

**Tech Stack:** Next.js 15 App Router, D1 via `@cloudflare/next-on-pages`, Tailwind CSS, lucide-react, vitest

---

### Task 1: Migration — add endpoints table and alter events table

**Files:**
- Create: `webhook-listener/migrations/0002_endpoints.sql`
- Modify: `webhook-listener/src/lib/db.ts`

- [ ] **Step 1: Create migration file**

Write `webhook-listener/migrations/0002_endpoints.sql`:

```sql
-- Multi-endpoint support
CREATE TABLE IF NOT EXISTS endpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  paypal_env TEXT DEFAULT 'sandbox',
  paypal_client_id TEXT DEFAULT '',
  paypal_client_secret TEXT DEFAULT '',
  paypal_webhook_id TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

ALTER TABLE webhook_events ADD COLUMN endpoint_id INTEGER;
ALTER TABLE webhook_events ADD COLUMN endpoint_slug TEXT;

-- Pre-seed a default endpoint for backward compatibility
INSERT OR IGNORE INTO endpoints (label, slug, description, created_at)
VALUES ('Default', 'default', 'Default webhook endpoint', unixepoch() * 1000);
```

- [ ] **Step 2: Add Endpoint type and CRUD functions to db.ts**

Read the existing `webhook-listener/src/lib/db.ts` to get the full current content.

Add `Endpoint` and `EndpointInput` interfaces after the existing `WebhookEventInput` interface:

```typescript
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
```

Update the `WebhookEvent` interface to include the new fields:

```typescript
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
```

Update `WebhookEventInput`:

```typescript
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
```

- [ ] **Step 3: Add endpoint CRUD functions at the end of db.ts (before the final `// ── Operations` section divider)**

```typescript
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
```

- [ ] **Step 4: Update getEvents to support optional endpoint_id filter**

Replace the existing `getEvents` function signature and body:

```typescript
export async function getEvents(
  db: D1Database,
  after: number = 0,
  limit: number = 50,
  endpointId?: number
): Promise<WebhookEvent[]> {
  let sql = `SELECT * FROM webhook_events WHERE id > ?`
  const params: unknown[] = [after]

  if (endpointId !== undefined) {
    sql += ` AND endpoint_id = ?`
    params.push(endpointId)
  }

  sql += ` ORDER BY id DESC LIMIT ?`
  params.push(limit)

  const stmt = db.prepare(sql)
  for (const p of params) {
    stmt.bind(p)
  }
  const result = await stmt.all<WebhookEvent>()
  return result.results ?? []
}
```

Wait — the D1 bind chaining doesn't support iterative bind. Use a different approach. Replace `getEvents` with:

```typescript
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
```

- [ ] **Step 5: Update insertEvent to accept endpoint_id and endpoint_slug**

Replace `insertEvent` parameter type to use the updated `WebhookEventInput` (already has endpoint_id/endpoint_slug). Update the INSERT SQL:

```typescript
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

  if (!(db instanceof InMemoryDB)) {
    await enforceRetention(db)
  }

  return { id, ...event }
}
```

Also update `InMemoryStmt.all()` to handle the INSERT with 12 columns — read the existing INSERT parsing and update the column count.

- [ ] **Step 6: Update InMemoryDB INSERT parsing for 12-param webhook_events**

In `InMemoryStmt.all()`, the INSERT branch currently parses columns from the SQL. It already dynamically reads columns from the regex — no change needed since the SQL now has 12 columns and the parser is column-count agnostic. But verify by reading the existing INSERT parsing code at line ~112 of db.ts and confirm it works with any column count.

The existing code:
```typescript
if (colsMatch) {
  const cols = colsMatch[1].split(',').map((c) => c.trim().toLowerCase())
  t.columns = cols
  cols.forEach((col, i) => {
    row[col] = this.params[i] ?? null
  })
}
```

This already handles any number of columns dynamically. No change needed.

- [ ] **Step 7: InMemoryDB — add endpoints table support**

In `InMemoryStmt.all()`, the existing code uses `tableNameFrom(sql)` to extract table names. The `endpoints` table uses standard SELECT/INSERT/UPDATE/DELETE patterns that are already handled generically. The `first()` and `all()` are generic. The UPDATE case already handles `SET ... WHERE ID = ?` patterns. No specific changes needed — the InMemoryDB handles any table generically.

BUT: need to verify the SELECT filtering for `WHERE slug = ?` — the current code has:
- `WHERE ID > ?`
- `WHERE ID = ?`
- `WHERE EMAIL = ?`
- `WHERE TOKEN_HASH = ? AND EXPIRES_AT > ?`
- `WHERE USER_ID = ?`

Need to add a generic `WHERE SLUG = ?` or a catch-all single-column WHERE clause. Read the existing SELECT filtering in `InMemoryStmt.all()` and add a generic catch-all:

```typescript
// After the specific WHERE clauses, before ORDER BY:
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
```

Insert this code in the SELECT section, after the `USER_ID = ?` block and before the `ORDER BY` block.

- [ ] **Step 8: Run tests and TypeScript check**

```bash
cd webhook-listener && npx tsc --noEmit && npx vitest run
```

Expected: TS clean, 17 tests pass.

- [ ] **Step 9: Commit**

```bash
git add webhook-listener/migrations/0002_endpoints.sql webhook-listener/src/lib/db.ts
git commit -m "feat(webhook-listener): add endpoints table, endpoint CRUD, events filter"
```

---

### Task 2: Refactor verification — per-endpoint credentials

**Files:**
- Modify: `webhook-listener/src/lib/verify.ts`

- [ ] **Step 1: Read current verify.ts**

Read the file at `webhook-listener/src/lib/verify.ts`.

- [ ] **Step 2: Rewrite verifyWebhookSignature to accept explicit credentials**

Replace the entire file content:

```typescript
/**
 * PayPal webhook signature verification.
 *
 * Calls PayPal's verify-webhook-signature API to confirm the webhook
 * payload authenticity. Credentials are passed in explicitly (per-endpoint),
 * not read from environment variables.
 */

export type VerificationStatus = 'verified' | 'failed' | 'skipped' | 'error'

export interface VerificationCredentials {
  env: 'sandbox' | 'live'
  clientId: string
  clientSecret: string
  webhookId: string
}

interface PayPalHeaders {
  'paypal-auth-algo'?: string
  'paypal-cert-url'?: string
  'paypal-transmission-id'?: string
  'paypal-transmission-sig'?: string
  'paypal-transmission-time'?: string
}

function getBaseUrl(env: 'sandbox' | 'live'): string {
  return env === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

async function getOAuthToken(
  baseUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })

  if (!response.ok) {
    throw new Error(`OAuth token request failed: ${response.status}`)
  }

  const json = await response.json() as { access_token: string }
  if (!json.access_token) {
    throw new Error('OAuth token response missing access_token')
  }

  return json.access_token
}

export async function verifyWebhookSignature(
  headers: PayPalHeaders,
  rawBody: string,
  credentials: VerificationCredentials | null
): Promise<VerificationStatus> {
  // No credentials → skip
  if (!credentials || !credentials.clientId || !credentials.clientSecret || !credentials.webhookId) {
    return 'skipped'
  }

  const {
    'paypal-auth-algo': auth_algo,
    'paypal-cert-url': cert_url,
    'paypal-transmission-id': transmission_id,
    'paypal-transmission-sig': transmission_sig,
    'paypal-transmission-time': transmission_time,
  } = headers

  // All PayPal verification headers must be present
  if (!auth_algo || !cert_url || !transmission_id || !transmission_sig || !transmission_time) {
    return 'skipped'
  }

  try {
    const baseUrl = getBaseUrl(credentials.env)
    const accessToken = await getOAuthToken(baseUrl, credentials.clientId, credentials.clientSecret)

    let webhookEvent: unknown
    try {
      webhookEvent = JSON.parse(rawBody)
    } catch {
      return 'error'
    }

    const verifyBody = {
      auth_algo,
      cert_url,
      transmission_id,
      transmission_sig,
      transmission_time,
      webhook_id: credentials.webhookId,
      webhook_event: webhookEvent,
    }

    const response = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(verifyBody),
      }
    )

    if (!response.ok) {
      return 'failed'
    }

    const result = await response.json() as { verification_status?: string }
    return result.verification_status === 'SUCCESS' ? 'verified' : 'failed'
  } catch {
    return 'error'
  }
}
```

- [ ] **Step 3: Update verify.test.ts for new interface**

Read `webhook-listener/src/lib/verify.test.ts`. Update all test calls to pass `credentials` object instead of env vars. Change:

Old: `verifyWebhookSignature(headers, body, { PAYPAL_ENV: 'sandbox', PAYPAL_CLIENT_ID: 'client-id', ... })`

New: `verifyWebhookSignature(headers, body, { env: 'sandbox', clientId: 'client-id', clientSecret: 'secret', webhookId: 'webhook-id' })`

The null credentials test: `verifyWebhookSignature(headers, body, null)` → 'skipped'

Re-read verify.test.ts and rewrite all 8 test cases to use the new signature.

- [ ] **Step 4: Run tests**

```bash
cd webhook-listener && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add webhook-listener/src/lib/verify.ts webhook-listener/src/lib/verify.test.ts
git commit -m "refactor(webhook-listener): verifyWebhookSignature accepts explicit credentials"
```

---

### Task 3: New API routes — webhook [slug], endpoints, admin endpoints

**Files:**
- Create: `webhook-listener/src/app/api/webhook/[slug]/route.ts`
- Modify: `webhook-listener/src/app/api/webhook/route.ts` (redirect)
- Create: `webhook-listener/src/app/api/endpoints/route.ts`
- Create: `webhook-listener/src/app/api/admin/endpoints/route.ts`
- Create: `webhook-listener/src/app/api/admin/endpoints/[id]/route.ts`
- Create: `webhook-listener/src/app/api/admin/endpoints/[id]/toggle/route.ts`
- Modify: `webhook-listener/src/middleware.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p webhook-listener/src/app/api/webhook/\[slug\]
mkdir -p webhook-listener/src/app/api/endpoints
mkdir -p webhook-listener/src/app/api/admin/endpoints/\[id\]/toggle
```

- [ ] **Step 2: Create `webhook-listener/src/app/api/webhook/[slug]/route.ts`**

```typescript
/**
 * POST /api/webhook/[slug] — PayPal webhook receiver (PUBLIC — no auth).
 *
 * Looks up the endpoint by slug, uses its credentials for signature
 * verification. Falls back to 'skipped' if endpoint not found or disabled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, insertEvent, getEndpointBySlug } from '@/lib/db'
import { parseWebhookBody } from '@/lib/parse'
import { verifyWebhookSignature } from '@/lib/verify'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const db = getDB()
  const { slug } = await params
  const receivedAt = Date.now()

  // Look up endpoint
  const endpoint = await getEndpointBySlug(db, slug)

  // Endpoint not found or disabled
  if (!endpoint) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!endpoint.enabled) {
    return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 })
  }

  // Read raw body
  const rawBody = await request.text()

  // Collect all headers
  const headersMap: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headersMap[key.toLowerCase()] = value
  })

  const method = request.method
  const query = new URL(request.url).search
  const sourceIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    ''
  const contentType = request.headers.get('content-type') || ''

  // Parse event metadata
  const parsed = parseWebhookBody(rawBody)

  // Signature verification with endpoint credentials
  let verification = 'skipped'
  try {
    verification = await verifyWebhookSignature(
      {
        'paypal-auth-algo': headersMap['paypal-auth-algo'],
        'paypal-cert-url': headersMap['paypal-cert-url'],
        'paypal-transmission-id': headersMap['paypal-transmission-id'],
        'paypal-transmission-sig': headersMap['paypal-transmission-sig'],
        'paypal-transmission-time': headersMap['paypal-transmission-time'],
      },
      rawBody,
      endpoint.paypal_client_id && endpoint.paypal_client_secret && endpoint.paypal_webhook_id
        ? {
            env: (endpoint.paypal_env as 'sandbox' | 'live') || 'sandbox',
            clientId: endpoint.paypal_client_id,
            clientSecret: endpoint.paypal_client_secret,
            webhookId: endpoint.paypal_webhook_id,
          }
        : null
    )
  } catch {
    verification = 'error'
  }

  // Always persist
  try {
    await insertEvent(db, {
      received_at: receivedAt,
      method,
      query,
      source_ip: sourceIp,
      content_type: contentType,
      headers: JSON.stringify(headersMap),
      raw_body: rawBody,
      event_type: parsed.event_type,
      resource_type: parsed.resource_type,
      verification,
      endpoint_id: endpoint.id,
      endpoint_slug: endpoint.slug,
    })
  } catch (err) {
    console.error('Failed to persist webhook event:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params
  const db = getDB()
  const endpoint = await getEndpointBySlug(db, slug)
  return NextResponse.json({
    message: `Send a POST request to this endpoint with your PayPal webhook payload.`,
    endpoint: endpoint ? { label: endpoint.label, slug: endpoint.slug, enabled: !!endpoint.enabled } : null,
  })
}
```

- [ ] **Step 3: Modify `webhook-listener/src/app/api/webhook/route.ts` — redirect to /default**

Read the existing file. Replace the POST handler:

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url)
  url.pathname = '/api/webhook/default'
  return NextResponse.redirect(url, 308)
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { message: 'Webhook endpoints are at /api/webhook/:slug. Register endpoints in the Admin panel.' },
    { status: 200 }
  )
}
```

- [ ] **Step 4: Create `webhook-listener/src/app/api/endpoints/route.ts`**

```typescript
/**
 * GET /api/endpoints — list all endpoints (requires login, for dashboard)
 */

import { NextResponse } from 'next/server'
import { getDB, getEndpoints } from '@/lib/db'
import { requireUser } from '@/lib/auth'

export async function GET(): Promise<NextResponse> {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDB()
  const endpoints = await getEndpoints(db)
  return NextResponse.json({ endpoints })
}
```

- [ ] **Step 5: Create `webhook-listener/src/app/api/admin/endpoints/route.ts`**

```typescript
/**
 * GET    /api/admin/endpoints — list all endpoints (admin only)
 * POST   /api/admin/endpoints — create endpoint (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEndpoints, createEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { EndpointInput } from '@/lib/db'

export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin()
    const db = getDB()
    const endpoints = await getEndpoints(db)
    return NextResponse.json({ endpoints })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin()
    const body = await request.json() as EndpointInput

    if (!body.label || !body.slug) {
      return NextResponse.json({ error: 'label and slug are required' }, { status: 400 })
    }

    const db = getDB()
    const endpoint = await createEndpoint(db, {
      label: body.label,
      slug: body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: body.description || '',
      enabled: body.enabled ?? 1,
      paypal_env: body.paypal_env || 'sandbox',
      paypal_client_id: body.paypal_client_id || '',
      paypal_client_secret: body.paypal_client_secret || '',
      paypal_webhook_id: body.paypal_webhook_id || '',
    })

    return NextResponse.json({ endpoint }, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}
```

- [ ] **Step 6: Create `webhook-listener/src/app/api/admin/endpoints/[id]/route.ts`**

```typescript
/**
 * PUT    /api/admin/endpoints/[id] — update endpoint (admin only)
 * DELETE /api/admin/endpoints/[id] — delete endpoint (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, getEndpointById, updateEndpoint, deleteEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import type { EndpointInput } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json() as EndpointInput

    if (!body.label || !body.slug) {
      return NextResponse.json({ error: 'label and slug are required' }, { status: 400 })
    }

    const db = getDB()
    await updateEndpoint(db, parseInt(id, 10), {
      label: body.label,
      slug: body.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      description: body.description || '',
      enabled: body.enabled ?? 1,
      paypal_env: body.paypal_env || 'sandbox',
      paypal_client_id: body.paypal_client_id || '',
      paypal_client_secret: body.paypal_client_secret || '',
      paypal_webhook_id: body.paypal_webhook_id || '',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const db = getDB()
    await deleteEndpoint(db, parseInt(id, 10))
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}
```

- [ ] **Step 7: Create `webhook-listener/src/app/api/admin/endpoints/[id]/toggle/route.ts`**

```typescript
/**
 * POST /api/admin/endpoints/[id]/toggle — toggle enabled/disabled (admin only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDB, toggleEndpoint } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    await requireAdmin()
    const { id } = await params
    const db = getDB()
    const endpoint = await toggleEndpoint(db, parseInt(id, 10))

    if (!endpoint) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ endpoint })
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (err instanceof Error && err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    throw err
  }
}
```

- [ ] **Step 8: Update middleware.ts — add /api/webhook prefix to public routes**

Read `webhook-listener/src/middleware.ts`. Change `PUBLIC_ROUTES`:

```typescript
const PUBLIC_ROUTES = ['/login', '/api/webhook']
```

This already covers `/api/webhook` and `/api/webhook/*`. No change needed — the existing `pathname.startsWith(r)` check handles the prefix match.

- [ ] **Step 9: TypeScript check**

```bash
cd webhook-listener && npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add webhook-listener/src/app/api/webhook/ webhook-listener/src/app/api/endpoints/ webhook-listener/src/app/api/admin/endpoints/
git commit -m "feat(webhook-listener): multi-endpoint routes — webhook [slug], endpoints list, admin CRUD"
```

---

### Task 4: Dashboard — dual view (All Events / By Endpoint)

**Files:**
- Modify: `webhook-listener/src/app/page.tsx`

- [ ] **Step 1: Read current page.tsx**

Read the full file at `webhook-listener/src/app/page.tsx` (475 lines).

- [ ] **Step 2: Rewrite page.tsx with view toggle and endpoint tabs**

Replace the entire file. Key changes from current:

1. Add `Endpoint` type import
2. Fetch endpoints on mount
3. Add `viewMode: 'all' | 'by-endpoint'` state
4. Add `selectedEndpointId` state
5. In polling: pass `endpoint_id` query param when in 'by-endpoint' mode
6. TopBar: add view toggle buttons + endpoint tab bar
7. Event list items: show `endpoint_slug` badge
8. Event detail header: show endpoint label

Write the complete rewritten file:

```typescript
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
  const [tab, setTab] = useState('body')
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // View mode: 'all' or 'by-endpoint'
  const [viewMode, setViewMode] = useState<'all' | 'by-endpoint'>('all')
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | null>(null)

  const maxIdRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
          const merged = [...newEvents, ...prev]
          return merged.slice(0, 500)
        })
        for (const ev of data.events) {
          if (ev.id > maxIdRef.current) maxIdRef.current = ev.id
        }
      }
    } catch {
      setPollError(true)
    }
  }, [router, viewMode, selectedEndpointId])

  useEffect(() => {
    maxIdRef.current = 0
    setEvents([])
    setSelectedId(null)
    fetchEvents()
  }, [viewMode, selectedEndpointId])

  useEffect(() => {
    pollingRef.current = setInterval(() => {
      if (!hiddenRef.current) fetchEvents()
    }, 2000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [fetchEvents])

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
```

Key differences from old page.tsx:
- `useEffect` for fetching endpoints on mount
- `viewMode` toggle (All Events / By Endpoint)
- Endpoint tab bar in "By Endpoint" mode
- `endpoint_id` query param in polling URL when filtered
- `endpoint_slug` badge in event list items
- Endpoint label in event detail header
- `getEndpointLabel()` helper
- Empty state when no endpoints
- `getWebhookUrl()` shows current endpoint's URL

- [ ] **Step 2b: TypeScript check**

```bash
cd webhook-listener && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add webhook-listener/src/app/page.tsx
git commit -m "feat(webhook-listener): dashboard dual view — All Events / By Endpoint"
```

---

### Task 5: Admin page — endpoint management section

**Files:**
- Modify: `webhook-listener/src/app/admin/page.tsx`

- [ ] **Step 1: Read current admin page**

Read `webhook-listener/src/app/admin/page.tsx` (339 lines).

- [ ] **Step 2: Add endpoints section below users**

The admin page currently has: header, user create form, user list. We add an "Endpoints" section below the user list with its own create form and table.

Read the current file, then insert the new endpoints section after the closing `</div>` of the user list section (after `users.length === 0 && !showCreate`). The new section includes:

1. State: `endpoints`, `showEndpointForm`, `editingEndpoint`, endpoint form fields
2. `loadEndpoints()` function
3. Create/edit form (dialog)
4. Table with: label, slug (copyable), env, enabled toggle, event count placeholder, edit/delete buttons

Write the additions. The endpoints section state and JSX structure:

```typescript
// Endpoint state (add after existing state declarations, before loadUsers)
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
```

Load endpoints function:

```typescript
const loadEndpoints = async () => {
  try {
    const res = await fetch('/api/admin/endpoints')
    if (res.ok) {
      const data = await res.json()
      setEndpoints(data.endpoints || [])
    }
  } catch {}
}
```

Call `loadEndpoints()` in the initial `useEffect` (after `loadUsers()`):

```typescript
// In the useEffect that checks auth/loads users, add:
loadEndpoints()
```

Endpoint form open handlers:

```typescript
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
```

Submit handler:

```typescript
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
```

Delete handler:

```typescript
const handleDeleteEndpoint = async (id: number, label: string) => {
  if (!confirm(`Delete endpoint "${label}" and all its events? This cannot be undone.`)) return
  await fetch(`/api/admin/endpoints/${id}`, { method: 'DELETE' })
  setEndpoints(prev => prev.filter(e => e.id !== id))
}
```

Toggle handler:

```typescript
const handleToggleEndpoint = async (id: number) => {
  const res = await fetch(`/api/admin/endpoints/${id}/toggle`, { method: 'POST' })
  if (res.ok) {
    const data = await res.json()
    if (data.endpoint) {
      setEndpoints(prev => prev.map(e => e.id === id ? data.endpoint : e))
    }
  }
}
```

Copy slug URL:

```typescript
const copyEndpointUrl = async (slug: string) => {
  const url = `${window.location.origin}/api/webhook/${slug}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {}
}
```

The JSX for endpoints section — insert after the closing `</div>` of the user list area. Add:

```jsx
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
```

Also need to add `Copy` to the lucide-react imports at the top of the file.

- [ ] **Step 3: TypeScript check**

```bash
cd webhook-listener && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add webhook-listener/src/app/admin/page.tsx
git commit -m "feat(webhook-listener): admin endpoint management — create, edit, toggle, delete"
```

---

### Task 6: Integration test and final verification

**Files:** None new

- [ ] **Step 1: Apply migration locally**

```bash
cd webhook-listener && npx wrangler d1 migrations apply webhook-listener-db --local --temporary
```

- [ ] **Step 2: Start dev server and run smoke test**

```bash
pnpm --filter webhook-listener dev &
sleep 10

# Test default endpoint webhook
curl -s -X POST http://localhost:30061/api/webhook/default \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"TEST.DEFAULT","resource":{"resource_type":"test"}}'

# Login
LOGIN=$(curl -s -D - -X POST http://localhost:30061/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@ppgms-test.com","password":"admin123"}')
COOKIE=$(echo "$LOGIN" | grep set-cookie | sed 's/.*wl_session=\([^;]*\).*/\1/')

# List endpoints
curl -s -b "wl_session=$COOKIE" http://localhost:30061/api/endpoints

# Create new endpoint
curl -s -X POST -b "wl_session=$COOKIE" http://localhost:30061/api/admin/endpoints \
  -H 'Content-Type: application/json' \
  -d '{"label":"Test Site","slug":"test-site","description":"Testing","enabled":1,"paypal_env":"sandbox","paypal_client_id":"","paypal_client_secret":"","paypal_webhook_id":""}'

# Send webhook to new endpoint
curl -s -X POST http://localhost:30061/api/webhook/test-site \
  -H 'Content-Type: application/json' \
  -d '{"event_type":"TEST.SITE","resource":{"resource_type":"order"}}'

# Get events (all)
curl -s -b "wl_session=$COOKIE" http://localhost:30061/api/events

# Get events filtered by endpoint_id
curl -s -b "wl_session=$COOKIE" "http://localhost:30061/api/events?endpoint_id=2"

# Check disabled endpoint returns 404
curl -s -X POST -b "wl_session=$COOKIE" http://localhost:30061/api/admin/endpoints/2/toggle
curl -s -X POST http://localhost:30061/api/webhook/test-site \
  -H 'Content-Type: application/json' \
  -d '{"test":"should fail"}'
```

Expected results:
- Webhook to `/default` → 200 `{"ok":true}`
- Login → user object
- List endpoints → array with "Default" and "Test Site"
- Create endpoint → 201
- Webhook to `/test-site` → 200
- Events all → 2 events
- Events filtered → 1 event (only test-site)
- Disabled endpoint POST → 404

- [ ] **Step 3: Run all tests**

```bash
cd webhook-listener && npx vitest run
```

Expected: 17 tests passing (existing tests + verify test updated for new interface).

- [ ] **Step 4: TypeScript check**

```bash
cd webhook-listener && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A webhook-listener/
git commit -m "test(webhook-listener): integration smoke test passed, all 17 unit tests green"
```

---

### Self-Review

**Spec coverage:**
- Multi-endpoint table + migration → Task 1 
- Per-endpoint verification credentials → Task 2 
- Webhook [slug] route → Task 3 
- Admin endpoint CRUD APIs → Task 3 
- Dashboard dual view → Task 4 
- Admin endpoint management UI → Task 5 
- Backward compatibility (default endpoint) → Task 1 (migration seed) + Task 3 (redirect)

**Placeholder scan:** None found.

**Type consistency:**
- `Endpoint` / `EndpointInput` defined in Task 1, used in Tasks 3-5 
- `verifyWebhookSignature` new signature in Task 2, called in Task 3 
- `getEvents(endpointId)` signature in Task 1, called in Task 3 (events route) and Task 4 (dashboard)