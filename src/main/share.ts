// share.ts — talks to the pit.ink share Worker.
// Takes a renderer item (or whole collection) and rewrites its data: URLs into
// uploadable blobs, so the manifest persisted in D1 stays small and the images
// land in R2 where the landing page can stream them.

// Worker base URL — the custom-domain route pit.ink/api/* serves the same
// pit-share-api Worker, so the app talks to one origin for everything.
const SHARE_API_BASE = 'https://pit.ink'

interface ShareAsset {
  id: string
  contentType: string
  dataBase64: string
}

interface ItemLite {
  id: string
  screenshot?: string
  design?: {
    pages?: { slices?: string[]; screenshot?: string }[]
    [k: string]: unknown
  }
  [k: string]: unknown
}

interface CollectionLite {
  id: string
  name: string
  [k: string]: unknown
}

export interface ShareCreateInput {
  kind: 'item' | 'collection'
  item?: ItemLite
  collection?: CollectionLite
  items?: ItemLite[]
  password?: string
  expiresInDays?: number
}

export interface ShareCreateResult {
  code: string
  url: string
  hasPassword: boolean
  expiresAt: number | null
}

/**
 * Extract a data: URL into an uploadable asset.
 *
 * Returns null for non-data URLs (already hosted somewhere) so the caller can
 * preserve those refs as-is in the manifest.
 */
function dataUrlToAsset(dataUrl: string, baseId: string): ShareAsset | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  const contentType = m[1]
  const ext = (contentType.split('/')[1] || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
  return { id: `${baseId}.${ext}`, contentType, dataBase64: m[2] }
}

/**
 * Build the manifest representation of an item: pass through metadata but
 * replace inline data URLs with asset ids that point at uploaded R2 objects.
 *
 * Per-page slices are dropped for now — the landing page can render from the
 * primary screenshot + prompt; uploading every slice would balloon the share.
 */
function stripItem(item: ItemLite, assets: ShareAsset[]): ItemLite {
  const out: ItemLite = { ...item }

  // Drop fields that are local-only and would bloat the manifest:
  //   streamText      — live AI "thinking" stream, only useful in-flight
  //   progress        — analyzing-state human label
  //   capturedPages   — duplicate of design.pages with full slices + screenshots
  //                     (already mirrored into design.pages on finalize)
  //   status / error  — analyzing lifecycle; the recipient gets a 'ready' item
  out.streamText = undefined
  ;(out as Record<string, unknown>).progress = undefined
  ;(out as Record<string, unknown>).capturedPages = undefined
  ;(out as Record<string, unknown>).status = undefined
  ;(out as Record<string, unknown>).error = undefined

  if (item.screenshot) {
    const asset = dataUrlToAsset(item.screenshot, `item-${item.id}`)
    if (asset) {
      assets.push(asset)
      out.screenshot = undefined
      ;(out as Record<string, unknown>).screenshotAsset = asset.id
    }
  }
  if (item.design?.pages) {
    out.design = {
      ...item.design,
      pages: item.design.pages.map((p, i) => {
        const stripped: { slices?: string[]; screenshot?: string; [k: string]: unknown } = {
          ...p,
          slices: undefined,
          screenshot: undefined
        }
        if (p.screenshot) {
          const a = dataUrlToAsset(p.screenshot, `item-${item.id}-page-${i}`)
          if (a) {
            assets.push(a)
            stripped.thumbAsset = a.id
          }
        }
        return stripped
      })
    }
  }
  return out
}

// ─── inbound: pit:// deep links ─────────────────────────────────────────

export type ShareFetchResult =
  | { status: 'ready'; payload: unknown }
  | { status: 'needs-password' }
  | { status: 'expired' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

/**
 * Fetch a share manifest by code. Translates the API's HTTP statuses into a
 * discriminated union the renderer can switch on without re-handling fetch
 * errors.
 */
export async function fetchShare(code: string): Promise<ShareFetchResult> {
  try {
    const r = await fetch(`${SHARE_API_BASE}/api/shares/${code}`)
    if (r.status === 404) return { status: 'not-found' }
    if (r.status === 410) return { status: 'expired' }
    if (r.status === 401) return { status: 'needs-password' }
    if (!r.ok) return { status: 'error', message: `HTTP ${r.status}` }
    const j = (await r.json()) as { payload: unknown }
    return { status: 'ready', payload: j.payload }
  } catch (e) {
    return { status: 'error', message: (e as Error).message }
  }
}

export async function authenticateShare(
  code: string,
  password: string
): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${SHARE_API_BASE}/api/shares/${code}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (r.status === 403) return { ok: false, error: 'Wrong password' }
    if (r.status === 410) return { ok: false, error: 'This share has expired' }
    if (r.status === 404) return { ok: false, error: 'Share not found' }
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const j = (await r.json()) as { payload: unknown }
    return { ok: true, payload: j.payload }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Pull an R2 asset and re-encode it as a data: URL — so the imported item
 * carries the screenshot inline and pit stays useful offline / after the
 * share is deleted upstream.
 */
export async function fetchAssetAsDataUrl(
  code: string,
  asset: string
): Promise<string | null> {
  try {
    const r = await fetch(`${SHARE_API_BASE}/api/blob/${code}/${asset}`)
    if (!r.ok) return null
    const contentType = r.headers.get('content-type') || 'application/octet-stream'
    const buf = await r.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let bin = ''
    // Chunk to avoid call-stack limits on huge inputs.
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return `data:${contentType};base64,${Buffer.from(bin, 'binary').toString('base64')}`
  } catch {
    return null
  }
}

// ─── outbound: creating shares ──────────────────────────────────────────

export async function createShare(input: ShareCreateInput): Promise<ShareCreateResult> {
  const sourceItems: ItemLite[] =
    input.kind === 'collection' ? input.items || [] : input.item ? [input.item] : []

  const assets: ShareAsset[] = []
  const itemPayloads = sourceItems.map((it) => stripItem(it, assets))

  const payload =
    input.kind === 'collection'
      ? { kind: 'collection', collection: input.collection, items: itemPayloads }
      : { kind: 'item', item: itemPayloads[0] }

  const body = {
    payload,
    password: input.password || undefined,
    expiresInDays: input.expiresInDays || undefined,
    assets
  }

  // Two-phase upload: manifest first (tiny JSON), then one PUT per blob.
  // Sending everything inline trips the workers.dev body-size limit for
  // collection-sized shares; PUT-per-blob also lets us upload in parallel and
  // shows real progress instead of one opaque wait.
  const manifestBody = {
    payload: body.payload,
    password: body.password,
    expiresInDays: body.expiresInDays
    // assets intentionally omitted — uploaded separately below.
  }
  const manifestJson = JSON.stringify(manifestBody)
  process.stderr.write(
    `[pit-share] manifest=${(manifestJson.length / 1024).toFixed(1)}KB ` +
      `items=${sourceItems.length} blobs=${assets.length}\n`
  )
  const res = await fetch(`${SHARE_API_BASE}/api/shares`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: manifestJson
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`share api ${res.status}: ${text.slice(0, 200)}`)
  }
  const created = (await res.json()) as ShareCreateResult

  // Upload blobs with a small concurrency cap. Parallel = faster, but too many
  // simultaneous PUTs can flood the worker and trigger 429s.
  const PARALLEL = 4
  let uploaded = 0
  let blobErr: Error | null = null
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (assets.length > 0 && !blobErr) {
        const a = assets.shift()
        if (!a) break
        try {
          const bytes = Buffer.from(a.dataBase64, 'base64')
          const putRes = await fetch(
            `${SHARE_API_BASE}/api/shares/${created.code}/blob/${encodeURIComponent(a.id)}`,
            {
              method: 'PUT',
              headers: { 'content-type': a.contentType || 'application/octet-stream' },
              body: bytes
            }
          )
          if (!putRes.ok) {
            const text = await putRes.text().catch(() => '')
            throw new Error(
              `blob put ${putRes.status} for ${a.id}: ${text.slice(0, 160)}`
            )
          }
          uploaded++
        } catch (e) {
          blobErr = e as Error
        }
      }
    })
  )
  if (blobErr) throw blobErr
  process.stderr.write(`[pit-share] code=${created.code} blobs=${uploaded} done\n`)
  return created
}
