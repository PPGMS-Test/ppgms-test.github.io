/**
 * Authentication module for webhook-listener.
 *
 * Uses PBKDF2 (SHA-256, 100k iterations) for password hashing — works in
 * Cloudflare Workers edge runtime where bcrypt is not available.
 *
 * Sessions are random 32-byte tokens, with only the SHA-256 hash stored in D1.
 * Cookies are httpOnly + Secure + SameSite=Lax, default 7-day expiry.
 */

import { cookies } from 'next/headers'
import { getDB } from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────

export interface User {
  id: number
  email: string
  role: 'admin' | 'user'
}

export interface UserRow {
  id: number
  email: string
  password_hash: string
  password_salt: string
  role: 'admin' | 'user'
  created_at: number
  created_by: string | null
}

export interface SessionRow {
  token_hash: string
  user_id: number
  created_at: number
  expires_at: number
}

// ── Constants ──────────────────────────────────────────────────────────────

const COOKIE_NAME = 'wl_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'
const SALT_BYTES = 32
const TOKEN_BYTES = 32

// ── Crypto helpers ─────────────────────────────────────────────────────────

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function generateSalt(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  return bytesToHex(bytes.buffer)
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      salt: hexToBytes(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    256
  )
  return bytesToHex(derivedBits)
}

async function generateToken(): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return bytesToHex(bytes.buffer)
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return bytesToHex(hashBuf)
}

// ── Password operations ────────────────────────────────────────────────────

export async function createPasswordHash(password: string): Promise<{ hash: string; salt: string }> {
  const salt = await generateSalt()
  const hash = await hashPassword(password, salt)
  return { hash, salt }
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  const computedHash = await hashPassword(password, storedSalt)
  // Constant-time comparison: compare lengths then use a timing-safe approach
  if (computedHash.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash.charCodeAt(i) ^ storedHash.charCodeAt(i)
  }
  return diff === 0
}

// ── Session operations ─────────────────────────────────────────────────────

export async function createSession(userId: number): Promise<{ token: string; expiresAt: number }> {
  const db = getDB()
  const token = await generateToken()
  const tokenHash = await hashToken(token)
  const now = Date.now()
  const expiresAt = now + SESSION_TTL_MS

  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    )
    .bind(tokenHash, userId, now, expiresAt)
    .run()

  return { token, expiresAt }
}

export async function validateSession(token: string): Promise<User | null> {
  const db = getDB()
  const tokenHash = await hashToken(token)
  const now = Date.now()

  const result = await db
    .prepare(
      `SELECT s.*, u.id as uid, u.email, u.role
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = ? AND s.expires_at > ?`
    )
    .bind(tokenHash, now)
    .first<SessionRow & { uid: number; email: string; role: 'admin' | 'user' }>()

  if (!result) return null

  return {
    id: result.uid,
    email: result.email,
    role: result.role,
  }
}

export async function destroySession(token: string): Promise<void> {
  const db = getDB()
  const tokenHash = await hashToken(token)
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

export async function setSessionCookie(token: string, expiresAt: number): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt),
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

// ── Auth guards (server component / API helpers) ───────────────────────────

export async function requireUser(): Promise<User> {
  const token = await getSessionCookie()
  if (!token) {
    throw new Error('UNAUTHORIZED')
  }
  const user = await validateSession(token)
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return user
}

// ── Bootstrap admin ────────────────────────────────────────────────────────

export async function bootstrapAdminIfNeeded(): Promise<void> {
  const db = getDB()

  const count = await db
    .prepare('SELECT COUNT(*) as cnt FROM users')
    .first<{ cnt: number }>()

  if (count && count.cnt > 0) return

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD not set — cannot bootstrap admin user')
    return
  }

  const { hash, salt } = await createPasswordHash(password)
  const now = Date.now()

  await db
    .prepare(
      `INSERT INTO users (email, password_hash, password_salt, role, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(email, hash, salt, 'admin', now)
    .run()

  console.log(`Bootstrapped admin user: ${email}`)
}

// ── User management (admin only) ───────────────────────────────────────────

export async function listUsers(): Promise<UserRow[]> {
  const db = getDB()
  const result = await db
    .prepare('SELECT id, email, role, created_at, created_by FROM users ORDER BY id')
    .all<UserRow>()
  return result.results ?? []
}

export async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'user',
  createdBy: string
): Promise<UserRow> {
  const db = getDB()
  const { hash, salt } = await createPasswordHash(password)
  const now = Date.now()

  const result = await db
    .prepare(
      `INSERT INTO users (email, password_hash, password_salt, role, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(email, hash, salt, role, now, createdBy)
    .run()

  const id = result.meta?.last_row_id as number

  return { id, email, password_hash: hash, password_salt: salt, role, created_at: now, created_by: createdBy }
}

export async function deleteUser(id: number): Promise<void> {
  const db = getDB()
  // Also delete any sessions for this user
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()
}

export async function resetUserPassword(id: number, newPassword: string): Promise<void> {
  const db = getDB()
  const { hash, salt } = await createPasswordHash(newPassword)

  // Invalidate all sessions for this user
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()

  await db
    .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .bind(hash, salt, id)
    .run()
}