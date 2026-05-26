// shareHistory.ts — local record of shares created from this app.
// Persisted in localStorage so it survives across sessions without needing
// a roundtrip to the Worker. Capped at MAX_RECORDS to keep storage small.
//
// We don't have a "list my shares" API (no user auth), so this client-side
// log is the only way to remember what was created. If the user wipes
// localStorage they lose history — the underlying share records on D1 live
// out their TTL regardless.

const STORAGE_KEY = 'pit:share-history:v1'
const MAX_RECORDS = 50

export interface ShareRecord {
  code: string
  url: string
  createdAt: number
  targetKind: 'item' | 'collection'
  targetName: string
  itemCount: number
  hasPassword: boolean
  expiresAt: number | null
}

export function listShares(): ShareRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ShareRecord[]) : []
  } catch {
    return []
  }
}

export function pushShare(rec: ShareRecord): void {
  const all = listShares()
  // Dedup by code in case the modal re-fires somehow.
  const filtered = all.filter((r) => r.code !== rec.code)
  filtered.unshift(rec)
  const trimmed = filtered.slice(0, MAX_RECORDS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch {
    // best-effort
  }
}

export function removeShare(code: string): void {
  const all = listShares().filter((r) => r.code !== code)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // best-effort
  }
}

/** Deterministic gradient seeded by an id string — same id → same colors,
 *  so a collection's avatar stays stable across renders. Used for share
 *  preview covers and share-history list entries. */
export function gradientFromId(id: string): string {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0
  const a = Math.abs(h)
  const hue1 = a % 360
  const hue2 = (hue1 + 40 + ((a >> 8) % 160)) % 360
  const angle = ((a >> 16) % 180) + 90
  const sat1 = 60 + ((a >> 4) % 25) // 60-84
  const sat2 = 55 + ((a >> 6) % 25)
  const lit1 = 50 + ((a >> 2) % 12) // 50-61
  const lit2 = 28 + ((a >> 10) % 14) // 28-41
  return `linear-gradient(${angle}deg, hsl(${hue1} ${sat1}% ${lit1}%), hsl(${hue2} ${sat2}% ${lit2}%))`
}

/** Pretty-print how long ago — "just now / 5m / 3h / 2d". */
export function relativeAge(ms: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  if (sec < 30) return 'just now'
  if (sec < 60) return `${sec}s ago`
  const m = Math.floor(sec / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
