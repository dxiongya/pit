-- pit share metadata. One row per shared collection/item set.
-- `payload` is the JSON manifest the landing page renders; blobs live in R2 under
-- `<code>/<asset_id>.<ext>` and are referenced from inside the manifest by asset_id.

CREATE TABLE IF NOT EXISTS shares (
  code           TEXT PRIMARY KEY,           -- nanoid(8), part of the share URL
  payload        TEXT NOT NULL,              -- JSON: { title, items: [...], coverColor, ... }
  password_hash  TEXT,                       -- bcrypt hash; NULL = public
  expires_at     INTEGER,                    -- unix seconds; NULL = never
  created_at     INTEGER NOT NULL,
  view_count     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shares_created_at_idx ON shares(created_at);
CREATE INDEX IF NOT EXISTS shares_expires_at_idx ON shares(expires_at);

CREATE TABLE IF NOT EXISTS share_views (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  share_code  TEXT NOT NULL,
  viewed_at   INTEGER NOT NULL,
  ip_hash     TEXT,                          -- sha256(ip + salt) for rough unique counting
  ua          TEXT
);

CREATE INDEX IF NOT EXISTS share_views_code_idx ON share_views(share_code);
