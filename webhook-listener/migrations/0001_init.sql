-- webhook-listener initial schema
-- Run: wrangler d1 migrations apply webhook-listener-db --local

CREATE TABLE IF NOT EXISTS webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at INTEGER NOT NULL,
  method TEXT NOT NULL DEFAULT 'POST',
  query TEXT NOT NULL DEFAULT '',
  source_ip TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  headers TEXT NOT NULL DEFAULT '{}',
  raw_body TEXT NOT NULL DEFAULT '',
  event_type TEXT,
  resource_type TEXT,
  verification TEXT NOT NULL DEFAULT 'skipped'
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);