// ReceiveShareModal — handles inbound pit:// share/<code> deep links.
// Flow: fetch manifest → (password modal if locked) → preview → import as
// a brand-new collection.

import { useEffect, useState } from 'react'
import type { Collection, Item } from '../../lib/types'
import { useStore } from '../../lib/store'
import { I } from '../../lib/icons'
import { Button } from '../../components/ui'

// Loose shape — matches what main/share.ts strips out at create time. We can
// tighten this once the share format is stable enough to extract into a shared
// types package.
interface SharedItemRaw {
  id?: string
  kind?: string
  title?: string
  screenshotAsset?: string
  design?: {
    pages?: { thumbAsset?: string; screenshot?: string; [k: string]: unknown }[]
    [k: string]: unknown
  }
  [k: string]: unknown
}

interface SharePayload {
  kind: 'collection' | 'item'
  collection?: { id: string; name: string; color?: string; desc?: string }
  items?: SharedItemRaw[]
  item?: SharedItemRaw
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'password' }
  | { kind: 'preview'; payload: SharePayload }
  | { kind: 'importing'; total: number; done: number }
  | { kind: 'done'; collectionId: string; collectionName: string }
  | { kind: 'expired' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string }

function uid(): string {
  return Math.random().toString(36).slice(2, 12)
}

function describePayload(p: SharePayload): { title: string; count: number } {
  if (p.kind === 'collection' && p.collection) {
    return { title: p.collection.name, count: p.items?.length ?? 0 }
  }
  const it = p.item
  return { title: (it?.title as string) || 'Shared item', count: 1 }
}

export function ReceiveShareModal({
  code,
  onClose,
  onImported
}: {
  code: string
  onClose: () => void
  onImported: (collectionId: string) => void
}): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const { addCollection, addItem } = useStore()

  // Initial fetch.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await window.pit.share.fetch(code)
      if (cancelled) return
      if (res.status === 'ready') setPhase({ kind: 'preview', payload: res.payload as SharePayload })
      else if (res.status === 'needs-password') setPhase({ kind: 'password' })
      else if (res.status === 'expired') setPhase({ kind: 'expired' })
      else if (res.status === 'not-found') setPhase({ kind: 'not-found' })
      else setPhase({ kind: 'error', message: res.message })
    })()
    return (): void => {
      cancelled = true
    }
  }, [code])

  // Esc closes — but not in the middle of an import (avoid partial saves).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase.kind !== 'importing') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const submitPassword = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setPwSubmitting(true)
    setPwErr('')
    const res = await window.pit.share.authenticate(code, password)
    setPwSubmitting(false)
    if (res.ok) {
      setPhase({ kind: 'preview', payload: res.payload as SharePayload })
    } else {
      setPwErr(res.error)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (phase.kind !== 'preview') return
    const payload = phase.payload

    const sourceItems: SharedItemRaw[] =
      payload.kind === 'collection'
        ? payload.items || []
        : payload.item
          ? [payload.item]
          : []

    const collectionId = uid()
    const baseColor =
      (payload.collection?.color as string) || 'linear-gradient(160deg,#8b4a7c,#3a1f3a)'
    const collectionName =
      payload.kind === 'collection' && payload.collection
        ? `${payload.collection.name} (shared)`
        : (payload.item?.title as string) || 'Imported share'

    // CollectionView renders `icon` as raw text inside the cover square — the
    // convention (see NewCollectionView) is a single uppercase letter glyph.
    const coverLetter = (collectionName.trim().charAt(0) || '·').toUpperCase()
    const collection: Collection = {
      id: collectionId,
      name: collectionName,
      color: baseColor,
      icon: coverLetter,
      desc: payload.collection?.desc,
      // builtin/prompt/tags/skip stay undefined — this is a freshly-cloned user collection.
    }
    addCollection(collection)

    setPhase({ kind: 'importing', total: sourceItems.length, done: 0 })

    let done = 0
    for (const src of sourceItems) {
      const itemId = uid()
      // Build the new item without the asset-id placeholders (we hydrate them
      // back into inline data URLs below so the import is fully offline-safe).
      const { screenshotAsset, design, ...rest } = src
      const newItem: Item = {
        ...(rest as Partial<Item>),
        id: itemId,
        kind: ((rest.kind as Item['kind']) || 'note') as Item['kind'],
        collection: collectionId,
        createdAt: Date.now(),
        status: 'ready'
      }

      if (screenshotAsset) {
        const dataUrl = await window.pit.share.fetchAsset(code, screenshotAsset)
        if (dataUrl) newItem.screenshot = dataUrl
      }

      if (design) {
        const pages = design.pages
          ? await Promise.all(
              design.pages.map(async (p) => {
                const { thumbAsset, ...rest } = p
                if (thumbAsset) {
                  const dataUrl = await window.pit.share.fetchAsset(code, thumbAsset)
                  if (dataUrl) return { ...rest, screenshot: dataUrl }
                }
                return rest
              })
            )
          : undefined
        // The full DesignDoc shape isn't enforced for shared imports — pass it
        // through so the detail view's existing tabs render whatever survived.
        ;(newItem as unknown as { design: unknown }).design = pages
          ? { ...design, pages }
          : design
      }

      addItem(newItem)
      done++
      setPhase({ kind: 'importing', total: sourceItems.length, done })
    }

    setPhase({ kind: 'done', collectionId, collectionName })
  }

  return (
    <div
      className="detail-overlay"
      onClick={phase.kind !== 'importing' ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        {phase.kind === 'loading' && (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div className="muted">Loading share…</div>
          </div>
        )}

        {phase.kind === 'password' && (
          <>
            <h3>Password required</h3>
            <div className="sub">This share is protected. Ask the sender for the password.</div>
            <form onSubmit={submitPassword} style={{ marginTop: 16 }}>
              <input
                type="password"
                autoFocus
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ui-input"
                style={{
                  width: '100%',
                  height: 34,
                  padding: '0 12px',
                  border: '1px solid var(--hair-2)',
                  borderRadius: 7,
                  background: 'var(--bg-card)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--f-ui)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              {pwErr && (
                <div style={{ marginTop: 8, color: '#c0392b', fontSize: 12 }}>{pwErr}</div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                  marginTop: 16
                }}
              >
                <Button size="sm" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={pwSubmitting || !password}
                >
                  {pwSubmitting ? 'Checking…' : 'Unlock'}
                </Button>
              </div>
            </form>
          </>
        )}

        {phase.kind === 'preview' && (
          <>
            {(() => {
              const { title, count } = describePayload(phase.payload)
              const isCollection = phase.payload.kind === 'collection'
              return (
                <>
                  <h3>You've been sent a share</h3>
                  <div className="sub">
                    Importing creates a new {isCollection ? 'collection' : 'item'} in your library.
                  </div>
                  <div className="share-preview" style={{ marginTop: 14 }}>
                    <div
                      className="ph"
                      style={{
                        background:
                          (phase.payload.collection?.color as string) ||
                          'linear-gradient(160deg,#8b4a7c,#3a1f3a)'
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>{title}</div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {count} {count === 1 ? 'item' : 'items'} · from pit.ink/p/{code}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <Button size="sm" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleImport}>
                      <I.Folder size={13} /> Import as new collection
                    </Button>
                  </div>
                </>
              )
            })()}
          </>
        )}

        {phase.kind === 'importing' && (
          <div style={{ padding: 28, textAlign: 'center' }} className="muted">
            <I.Sparkles size={16} />
            <div style={{ marginTop: 8 }}>
              Importing {phase.done}/{phase.total}…
            </div>
          </div>
        )}

        {phase.kind === 'done' && (
          <>
            <h3>Imported</h3>
            <div className="sub">
              "{phase.collectionName}" is now in your library.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Stay here
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const id = phase.collectionId
                  onImported(id)
                }}
              >
                Open it
              </Button>
            </div>
          </>
        )}

        {phase.kind === 'expired' && (
          <PhaseMessage
            title="Share expired"
            sub="This link's TTL has run out. Ask the sender for a fresh one."
            onClose={onClose}
          />
        )}

        {phase.kind === 'not-found' && (
          <PhaseMessage
            title="Share not found"
            sub="This URL doesn't match any share, or it's been deleted."
            onClose={onClose}
          />
        )}

        {phase.kind === 'error' && (
          <PhaseMessage title="Couldn't load" sub={phase.message} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

function PhaseMessage({
  title,
  sub,
  onClose
}: {
  title: string
  sub: string
  onClose: () => void
}): React.JSX.Element {
  return (
    <>
      <h3>{title}</h3>
      <div className="sub">{sub}</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </>
  )
}
