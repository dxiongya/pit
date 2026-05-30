# pit-share-worker

The Cloudflare Worker that backs pit's share feature — D1 for metadata, R2
for blobs. By default the pit app talks to the free `pit.ink` instance
(50 MB cap, 1 hour expiry). Self-host this Worker to remove those limits.

## One-click deploy (recommended)

> **Note:** the Deploy button below points at a public GitHub mirror of this
> directory. If you forked pit, swap the `?url=` value for your own fork.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dxiongya/pit-share-worker)

1. Click the button — Cloudflare forks the repo into your account.
2. When prompted, **create** the D1 database (`pit-shares-db`) and the R2
   bucket (`pit-shares`). The wizard wires them into the Worker for you.
3. After deploy, copy the Worker URL (looks like
   `https://pit-share-api.YOUR-NAME.workers.dev`).
4. In pit, open **Settings → Sharing** and paste the URL into "Worker URL".
   Click **Test** — should show `✓ Connected · no limits applied`.

Everything stays on Cloudflare's free tier for normal personal use
(D1 free: 5 M reads/day, R2 free: 10 GB/month egress).

## CLI deploy (advanced)

```bash
cd infra/cf-worker
npm install
npx wrangler login

# 1. Create D1 + R2 bindings.
npx wrangler d1 create pit-shares-db
#   → copy the database_id from the output into wrangler.toml
npx wrangler r2 bucket create pit-shares

# 2. Apply the schema.
npx wrangler d1 execute pit-shares-db --file=schema.sql --remote

# 3. (Optional) Edit wrangler.toml [vars] to add limits — see below.

# 4. Deploy.
npx wrangler deploy
```

## Limits — `[vars]` knobs

All three default to **unlimited / open** so a fresh self-host works
without any edits. The free `pit.ink` instance sets all three.

| Variable             | Effect                                                                       | pit.ink value |
| -------------------- | ---------------------------------------------------------------------------- | ------------- |
| `MAX_SHARE_BYTES`    | Hard cap on a share's total blob size. Exceeding returns HTTP 413.           | `50000000`    |
| `MAX_EXPIRY_SECONDS` | Force-cap share TTL. Clients can't extend past this.                         | `3600`        |
| `SHARE_AUTH_SECRET`  | If set, all writes require `Authorization: Bearer <secret>` — for team-only Workers. | (unset)       |

Edit `wrangler.toml`:

```toml
[vars]
PUBLIC_ORIGIN = "https://pit.ink"
# Uncomment to opt into limits:
# MAX_SHARE_BYTES = "50000000"
# MAX_EXPIRY_SECONDS = "3600"
# SHARE_AUTH_SECRET = "swap-with-a-random-string"  # store via `wrangler secret put` instead!
```

Secrets (`SHARE_AUTH_SECRET`) should be set via `wrangler secret put
SHARE_AUTH_SECRET`, **not** committed to `wrangler.toml`.

## Migrating an existing deployment

If you deployed this Worker before the `total_bytes` column was added:

```bash
npx wrangler d1 execute pit-shares-db --remote \
  --command "ALTER TABLE shares ADD COLUMN total_bytes INTEGER NOT NULL DEFAULT 0"
```

Existing share records will start at `total_bytes = 0`; size cap enforcement
only kicks in for new writes.

## API surface

| Method + path                       | Notes                                                |
| ----------------------------------- | ---------------------------------------------------- |
| `GET  /api/health`                  | Heartbeat. Returns `{ok, ts, maxBytes, maxExpirySeconds, authRequired}`. |
| `POST /api/shares`                  | Create a share (manifest only; assets via PUT below). |
| `PUT  /api/shares/:code/blob/:asset` | Upload a single blob. Multiple PUTs per share OK.   |
| `GET  /api/shares/:code`            | Read manifest. 401 if password-protected.            |
| `POST /api/shares/:code/auth`       | Submit password, get manifest.                       |
| `GET  /api/blob/:code/:asset`       | Stream a blob (immutable, 1-year cache).             |

CORS is permissive (`access-control-allow-origin: *`) — the share landing
page is served from the same Worker so this is mostly for the pit desktop
app calling cross-origin.
