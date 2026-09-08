/**
 * Create (or reset) a webhook-listener user directly in D1.
 *
 * Computes the same PBKDF2-SHA256 (100k iterations, 32-byte salt) hash that
 * src/lib/auth.ts uses, then upserts the user via wrangler d1 execute.
 * On email conflict it updates password + role (so it doubles as a reset tool).
 *
 * Usage:
 *   pnpm create-user --email admin@webhook.com --password 'Ty@13579' --role admin
 *   pnpm create-user --email u@x.com --password 'pw' --role user --local
 *   pnpm create-user --email u@x.com --password 'pw' --sql-only   # only print SQL
 *
 * Requires Node 22+ in PATH (wrangler needs it) and `wrangler login` done.
 * Cross-platform: SQL is written to a temp file and run via `wrangler --file`.
 */

import crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DB_NAME = 'webhook-listener-db'
const PBKDF2_ITERATIONS = 100_000
const SALT_BYTES = 32

// ── parse args ───────────────────────────────────────────────────────────────
function getFlag(name) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const email = getFlag('email')
const password = getFlag('password')
const role = getFlag('role') ?? 'admin'
const local = hasFlag('local')
const sqlOnly = hasFlag('sql-only')

if (!email || !password) {
  console.error('Usage: pnpm create-user --email <email> --password <pw> [--role admin|user] [--local] [--sql-only]')
  process.exit(1)
}
if (role !== 'admin' && role !== 'user') {
  console.error(`Invalid role "${role}" — must be "admin" or "user"`)
  process.exit(1)
}

// ── hash password (mirrors src/lib/auth.ts) ─────────────────────────────────
const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
const hash = crypto
  .pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from(salt, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256')
  .toString('hex')
const now = Date.now()

// email is escaped for the SQL string literal; hash/salt/role are safe charsets.
const sqlEmail = String(email).replace(/'/g, "''")
const sql =
  `INSERT INTO users (email, password_hash, password_salt, role, created_at, created_by) ` +
  `VALUES ('${sqlEmail}', '${hash}', '${salt}', '${role}', ${now}, 'create-user-script') ` +
  `ON CONFLICT(email) DO UPDATE SET ` +
  `password_hash = excluded.password_hash, password_salt = excluded.password_salt, role = excluded.role;`

if (sqlOnly) {
  console.log(sql)
  process.exit(0)
}

// ── execute via wrangler (temp file avoids cross-platform quoting issues) ─────
const tmpFile = join(tmpdir(), `wl-create-user-${process.pid}.sql`)
writeFileSync(tmpFile, sql, 'utf8')

const cmd = `npx wrangler d1 execute ${DB_NAME} ${local ? '--local' : '--remote'} --file "${tmpFile}"`
console.log(`\n→ ${role} ${email}  (${local ? 'local' : 'remote'})`)
try {
  execSync(cmd, { stdio: 'inherit' })
  console.log(`\n✓ Done. Login with: ${email} / <your password>`)
} catch {
  process.exit(1)
} finally {
  try {
    unlinkSync(tmpFile)
  } catch {
    // ignore cleanup failure
  }
}
