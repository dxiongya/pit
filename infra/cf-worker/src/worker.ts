// pit.ink share API — D1 metadata + R2 blob storage.
//
// Endpoints:
//   GET  /api/health                       — heartbeat used by deploy smoke tests
//   POST /api/shares                       — create a share (optionally with blobs + password)
//   GET  /api/shares/:code                 — read share manifest (gated by password if set)
//   POST /api/shares/:code/auth            — submit password, get manifest on success
//   GET  /api/blob/:code/:asset            — proxy R2 blob (validates share still alive)

export interface Env {
  DB: D1Database
  BLOBS: R2Bucket
  PUBLIC_ORIGIN: string
}

// Avoid the visually confusable chars (0/O, 1/I/l) so codes are dictation-friendly.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const ASSET_ID_RE = /^[\w\-.]{1,128}$/
const SHARE_CODE_RE = /^[a-z0-9]{4,16}$/

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type'
} as const

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/api/health') return json({ ok: true, ts: Date.now() })

    if (path === '/api/shares' && req.method === 'POST') {
      return createShare(req, env)
    }

    const mShare = path.match(/^\/api\/shares\/([a-z0-9]+)$/)
    if (mShare && req.method === 'GET') return readShare(mShare[1], env)

    const mAuth = path.match(/^\/api\/shares\/([a-z0-9]+)\/auth$/)
    if (mAuth && req.method === 'POST') return authShare(mAuth[1], req, env)

    // PUT /api/shares/:code/blob/:asset — raw binary upload to R2 keyed by
    // share code. Keeps each request small so we don't trip the workers.dev
    // body-size limit on collection-sized shares.
    const mPut = path.match(/^\/api\/shares\/([a-z0-9]+)\/blob\/([\w\-.]+)$/)
    if (mPut && req.method === 'PUT') return putBlob(mPut[1], mPut[2], req, env)

    const mBlob = path.match(/^\/api\/blob\/([a-z0-9]+)\/([\w\-.]+)$/)
    if (mBlob && req.method === 'GET') return readBlob(mBlob[1], mBlob[2], env)

    return json({ error: 'not_found', path }, 404)
  }
} satisfies ExportedHandler<Env>

// ─── handlers ─────────────────────────────────────────────────────────────

interface ShareAsset {
  id: string // file name including extension, e.g. "img1.png"
  contentType: string
  dataBase64: string
}

interface CreateShareBody {
  payload: unknown
  password?: string
  expiresInDays?: number
  assets?: ShareAsset[]
}

async function createShare(req: Request, env: Env): Promise<Response> {
  let body: CreateShareBody
  try {
    body = await req.json<CreateShareBody>()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (body.payload == null) return json({ error: 'missing_payload' }, 400)

  // Generate a short code and retry on collision (vanishingly rare at 31^8 ≈ 8.5e11).
  let code = ''
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = randomCode(8)
    const exists = await env.DB.prepare(`SELECT 1 FROM shares WHERE code = ?`)
      .bind(candidate)
      .first()
    if (!exists) {
      code = candidate
      break
    }
  }
  if (!code) return json({ error: 'code_collision' }, 500)

  const now = Math.floor(Date.now() / 1000)
  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? now + Math.floor(body.expiresInDays) * 86400
      : null
  const passwordHash = body.password ? await hashPassword(body.password) : null

  // Upload blobs first so a failed write doesn't leave a half-baked D1 row.
  if (body.assets?.length) {
    for (const a of body.assets) {
      if (!ASSET_ID_RE.test(a.id)) {
        return json({ error: 'invalid_asset_id', id: a.id }, 400)
      }
      const bin = base64ToBytes(a.dataBase64)
      await env.BLOBS.put(`${code}/${a.id}`, bin, {
        httpMetadata: { contentType: a.contentType || 'application/octet-stream' }
      })
    }
  }

  await env.DB.prepare(
    `INSERT INTO shares (code, payload, password_hash, expires_at, created_at, view_count)
     VALUES (?, ?, ?, ?, ?, 0)`
  )
    .bind(code, JSON.stringify(body.payload), passwordHash, expiresAt, now)
    .run()

  return json({
    code,
    url: `${env.PUBLIC_ORIGIN}/p/${code}`,
    hasPassword: !!passwordHash,
    expiresAt
  })
}

async function readShare(code: string, env: Env): Promise<Response> {
  if (!SHARE_CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)

  const row = await env.DB.prepare(
    `SELECT payload, password_hash, expires_at, created_at, view_count
       FROM shares WHERE code = ?`
  )
    .bind(code)
    .first<{
      payload: string
      password_hash: string | null
      expires_at: number | null
      created_at: number
      view_count: number
    }>()

  if (!row) return json({ error: 'not_found' }, 404)
  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at < now) return json({ error: 'expired' }, 410)

  // Password-protected shares only reveal that they exist + need auth here;
  // the actual payload comes from POST /auth on success.
  if (row.password_hash) {
    return json({ hasPassword: true, needsAuth: true, createdAt: row.created_at }, 401)
  }

  // Best-effort view tally — don't fail the read on a tally error.
  await env.DB.prepare(`UPDATE shares SET view_count = view_count + 1 WHERE code = ?`)
    .bind(code)
    .run()
    .catch(() => {})

  return json({
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
    viewCount: row.view_count + 1
  })
}

async function authShare(code: string, req: Request, env: Env): Promise<Response> {
  if (!SHARE_CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)

  const body = await req.json<{ password?: string }>().catch(() => null)
  if (!body?.password) return json({ error: 'missing_password' }, 400)

  const row = await env.DB.prepare(
    `SELECT payload, password_hash, expires_at FROM shares WHERE code = ?`
  )
    .bind(code)
    .first<{ payload: string; password_hash: string | null; expires_at: number | null }>()

  if (!row) return json({ error: 'not_found' }, 404)
  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at < now) return json({ error: 'expired' }, 410)

  if (!row.password_hash) {
    // Not password-protected — return payload directly.
    return json({ payload: JSON.parse(row.payload) })
  }

  const ok = await verifyPassword(body.password, row.password_hash)
  if (!ok) return json({ error: 'invalid_password' }, 403)

  await env.DB.prepare(`UPDATE shares SET view_count = view_count + 1 WHERE code = ?`)
    .bind(code)
    .run()
    .catch(() => {})

  return json({ payload: JSON.parse(row.payload) })
}

async function putBlob(
  code: string,
  assetId: string,
  req: Request,
  env: Env
): Promise<Response> {
  if (!SHARE_CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
  if (!ASSET_ID_RE.test(assetId)) return json({ error: 'bad_asset' }, 400)

  // Only accept writes while the share record exists and is still alive.
  const row = await env.DB.prepare(`SELECT expires_at FROM shares WHERE code = ?`)
    .bind(code)
    .first<{ expires_at: number | null }>()
  if (!row) return json({ error: 'share_not_found' }, 404)
  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at < now) return json({ error: 'expired' }, 410)

  const contentType = req.headers.get('content-type') || 'application/octet-stream'
  if (!req.body) return json({ error: 'no_body' }, 400)

  await env.BLOBS.put(`${code}/${assetId}`, req.body, {
    httpMetadata: { contentType }
  })
  return json({ ok: true })
}

async function readBlob(code: string, assetId: string, env: Env): Promise<Response> {
  if (!SHARE_CODE_RE.test(code)) return json({ error: 'bad_code' }, 400)
  if (!ASSET_ID_RE.test(assetId)) return json({ error: 'bad_asset' }, 400)

  // Honour share lifecycle — don't serve blobs from expired/deleted shares.
  const row = await env.DB.prepare(`SELECT expires_at FROM shares WHERE code = ?`)
    .bind(code)
    .first<{ expires_at: number | null }>()
  if (!row) return json({ error: 'not_found' }, 404)
  const now = Math.floor(Date.now() / 1000)
  if (row.expires_at && row.expires_at < now) return json({ error: 'expired' }, 410)

  const obj = await env.BLOBS.get(`${code}/${assetId}`)
  if (!obj) return json({ error: 'blob_not_found' }, 404)

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*'
    }
  })
}

// ─── helpers ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  })
}

function randomCode(len: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(len))
  let out = ''
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length]
  return out
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

// PBKDF2 via Web Crypto — built into Workers, no WASM/bcrypt dep required.
// Hash format: `pbkdf2$<iters>$<base64-salt>$<base64-hash>`.
const PBKDF2_ITERS = 100_000

async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    key,
    256
  )
  return new Uint8Array(bits)
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS)
  return `pbkdf2$${PBKDF2_ITERS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iters = parseInt(parts[1], 10)
  if (!iters || iters < 1000) return false
  const salt = base64ToBytes(parts[2])
  const expected = base64ToBytes(parts[3])
  const got = await pbkdf2(password, salt, iters)
  if (got.length !== expected.length) return false
  // Timing-safe compare.
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i]
  return diff === 0
}
