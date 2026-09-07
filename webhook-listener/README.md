# webhook-listener

PayPal webhook receiving and inspection tool. Receives PayPal webhook POSTs, stores them in D1 (SQLite), and provides a real-time dashboard for viewing headers and bodies.

Built with **Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + lucide-react**, deployed to **Cloudflare Pages** with D1 bindings.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- A Cloudflare account (for D1 and deployment)

### 1. Create a D1 database

```bash
npx wrangler d1 create webhook-listener-db
```

Take the `database_id` from the output and put it in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "webhook-listener-db"
database_id = "your-database-id-here"
```

### 2. Set environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

Required vars for bootstrap:

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` | Email for the first admin user (auto-created on first login) |
| `ADMIN_PASSWORD` | Password for the first admin user |

Optional vars for PayPal signature verification:

| Variable | Description |
|----------|-------------|
| `PAYPAL_ENV` | `sandbox` or `live` (default: `sandbox`) |
| `PAYPAL_CLIENT_ID` | PayPal REST API client ID |
| `PAYPAL_CLIENT_SECRET` | PayPal REST API secret |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID from the developer dashboard |

Without these, webhooks are still stored and displayed — verification just shows as `skipped`.

### 3. Run migrations (local dev)

```bash
npx wrangler d1 migrations apply webhook-listener-db --local
```

### 4. Install and run

```bash
pnpm install
pnpm dev        # starts on http://localhost:30061
```

### 5. Open the dashboard

Navigate to `http://localhost:30061` — you'll be redirected to the login page.
Sign in with the email/password you set in `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## Usage

### Receiving webhooks

Point your PayPal webhook (or any HTTP POST) to:

```
https://your-domain.com/api/webhook
```

The endpoint:
- Accepts any POST body
- Parses `event_type` and `resource_type` from JSON bodies (when present)
- Runs PayPal signature verification (when credentials are configured)
- **Always** stores the webhook in D1 — parsing/verification failures never block persistence
- Returns `200 { ok: true }` immediately

### Dashboard

- **Real-time event list** on the left, polling every 2 seconds
- **Detail panel** on the right with tabs: Body (formatted JSON), Headers, Raw
- **Copy** buttons for body, headers, and the webhook URL itself
- **Verified only** filter toggle
- **Clear all** button to wipe events
- Polling pauses when the browser tab is hidden

### User management (`/admin`)

- Admin users can create, delete, and reset passwords for other users
- The first admin is bootstrapped from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on first login
- Two roles: `admin` (full access) and `user` (dashboard only)

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/webhook` | Public | Receive webhook — always returns 200 |
| `GET` | `/api/webhook` | Public | Returns usage info |
| `GET` | `/api/events?after=<id>&limit=<n>` | Required | Poll events (incremental) |
| `DELETE` | `/api/events` | Required | Clear all events |
| `DELETE` | `/api/events/[id]` | Required | Delete one event |
| `POST` | `/api/auth/login` | Public | Login (email + password) |
| `POST` | `/api/auth/logout` | Required | Logout |
| `GET` | `/api/auth/me` | Required | Get current user |
| `GET` | `/api/admin/users` | Admin | List users |
| `POST` | `/api/admin/users` | Admin | Create user |
| `DELETE` | `/api/admin/users/[id]` | Admin | Delete user |
| `POST` | `/api/admin/users/[id]/reset-password` | Admin | Reset password |

## Deployment

### Build for Cloudflare Pages

```bash
pnpm build:cf
```

This runs `@cloudflare/next-on-pages` and outputs to `.vercel/output/static`.

### Deploy to Cloudflare Pages

1. Connect your git repository to Cloudflare Pages
2. Set build command: `pnpm build:cf` (from the `webhook-listener/` directory)
3. Set build output directory: `.vercel/output/static`
4. Bind your D1 database (variable name: `DB`)
5. Set all required environment variables (see above)

## Architecture

```
src/
├── lib/
│   ├── db.ts          # D1 access layer (insert, query, delete, retention)
│   ├── parse.ts       # Best-effort event_type / resource_type extraction
│   ├── verify.ts      # PayPal signature verification
│   ├── auth.ts        # PBKDF2 passwords, session tokens, guards
│   └── utils.ts       # Shared helpers (cn, formatTimestamp, formatJSON)
├── middleware.ts       # Redirects unauthenticated users to /login
├── components/
│   ├── Badge.tsx       # Status badges (verified/failed/skipped/error)
│   ├── Button.tsx      # Button primitive
│   ├── Tabs.tsx        # Tab switcher
│   └── CopyButton.tsx  # Copy-to-clipboard button
└── app/
    ├── layout.tsx       # Root layout
    ├── globals.css      # Global styles (dark theme)
    ├── page.tsx         # Main dashboard
    ├── login/
    │   └── page.tsx     # Login page
    ├── admin/
    │   └── page.tsx     # User management
    └── api/
        ├── webhook/
        │   └── route.ts    # POST: receive webhook (public)
        ├── events/
        │   ├── route.ts    # GET: poll, DELETE: clear
        │   └── [id]/
        │       └── route.ts # DELETE: single event
        ├── auth/
        │   ├── login/route.ts
        │   ├── logout/route.ts
        │   └── me/route.ts
        └── admin/users/
            ├── route.ts
            ├── [id]/route.ts
            └── [id]/reset-password/route.ts
```

## Data Retention

Only the most recent **200** webhook events are kept. Older events are automatically deleted on each insert.

## Testing

```bash
pnpm test    # runs vitest
```

Tests cover:
- `parse.ts`: valid JSON, non-JSON, missing fields
- `verify.ts`: missing credentials → skipped, SUCCESS → verified, non-SUCCESS → failed, network error → error
- `auth.ts`: password hash round-trip (correct password passes, wrong password rejected), different salts produce different hashes

## License

Private — PayPal internal tool.