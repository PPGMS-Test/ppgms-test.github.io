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