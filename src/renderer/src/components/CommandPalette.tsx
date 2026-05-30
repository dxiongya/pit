// CommandPalette.tsx — ⌘K / search overlay.
//
// One thing only: surface relevant items + collections by query, so the user
// can jump straight to a design they remember without trawling the grid.
// Triggered by ⌘K (or click on the TopBar search pill); ESC closes; ↑↓ + Enter
// navigates. On Enter we route the parent to either open the item detail or
// switch to the collection view.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Collection, Item, View } from '../lib/types'
import { I } from '../lib/icons'

export type PaletteAction =
  | { kind: 'item'; id: string; collection: string }
  | { kind: 'collection'; id: string }

interface Hit {
  /** Score — higher is better; we sort desc and slice top N. */
  score: number
  /** What was matched + where, used for the gray snippet line under the title. */
  snippet?: string
  /** Underlying target. */
  target: PaletteAction
  /** Cached display fields so we don't refetch from items/collections on render. */
  title: string
  /** thumb for items (data URL), gradient for collections. */
  thumb?: string
  collectionName?: string
  badge?: string
}

export function CommandPalette({
  open,
  query,
  setQuery,
  items,
  collections,
  onClose,
  onPick,
  view
}: {
  open: boolean
  query: string
  setQuery: (q: string) => void
  items: Item[]
  collections: Collection[]
  onClose: () => void
  onPick: (a: PaletteAction) => void
  view: View
}): React.JSX.Element | null {
  const inputRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (open) {
      // Defer to next frame so the autoFocus actually applies after the input
      // mounts; otherwise React's autoFocus prop sometimes loses to the click
      // that opened us.
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])
  useEffect(() => setActive(0), [query, open])

  const results = useMemo(
    () => (open ? search(query, items, collections) : []),
    [open, query, items, collections]
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => Math.min(results.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const r = results[active]
        if (r) onPick(r.target)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, results, active, onClose, onPick])

  if (!open) return null

  const showEmpty = query.trim().length > 0 && results.length === 0

  // Hint text — anchors users on what they can search across.
  const placeholder =
    view === 'collection'
      ? 'Search this collection (try a color, tag, or theme)…'
      : 'Search items, collections, palettes…'

  return (
    <div
      className="detail-overlay cmd-palette-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: '14vh', background: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="cmd-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search"
      >
        <div className="cmd-palette-input-row">
          <I.Search size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          {query.length > 0 && (
            <button className="cmd-palette-clear" onClick={() => setQuery('')} title="Clear">
              <I.Close size={12} />
            </button>
          )}
          <span className="kbd cmd-palette-esc">esc</span>
        </div>

        {results.length > 0 && (
          <div className="cmd-palette-list">
            {results.map((r, i) => (
              <button
                key={`${r.target.kind}-${'id' in r.target ? r.target.id : i}`}
                type="button"
                className={`cmd-palette-row${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(r.target)}
              >
                <div
                  className="cmd-palette-thumb"
                  style={{
                    background: r.thumb?.startsWith('data:')
                      ? `center/cover no-repeat url(${r.thumb})`
                      : r.thumb || 'var(--bg-soft)'
                  }}
                  aria-hidden
                >
                  {!r.thumb && r.title.trim().charAt(0).toUpperCase()}
                </div>
                <div className="cmd-palette-meta">
                  <div className="cmd-palette-title">
                    <span>{r.title}</span>
                    {r.badge && <span className="cmd-palette-badge">{r.badge}</span>}
                  </div>
                  {r.snippet && <div className="cmd-palette-snippet">{r.snippet}</div>}
                  {r.collectionName && (
                    <div className="cmd-palette-crumb">
                      <I.Folder size={11} /> {r.collectionName}
                    </div>
                  )}
                </div>
                <span className="cmd-palette-go">↵</span>
              </button>
            ))}
          </div>
        )}

        {/* Floating preview card — anchored to the palette, shows whichever
            row the keyboard / mouse is on. Sits outside the row so it doesn't
            push layout around when active changes. */}
        {results[active]?.thumb?.startsWith('data:') && (
          <PreviewCard hit={results[active]} />
        )}

        {showEmpty && (
          <div className="cmd-palette-empty">
            <I.Search size={20} />
            <div>No matches for &ldquo;{query}&rdquo;</div>
            <div className="cmd-palette-empty-hint">
              Try a tag, palette color (&ldquo;teal&rdquo;, &ldquo;#0a84ff&rdquo;), or theme
              keyword.
            </div>
          </div>
        )}

        {query.length === 0 && (
          <div className="cmd-palette-empty">
            <I.Sparkles size={20} />
            <div style={{ color: 'var(--ink-2)' }}>Start typing to search</div>
            <div className="cmd-palette-empty-hint">
              Searches title, tags, theme, palette, components, font names, page text — across
              all collections.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── search core ────────────────────────────────────────────────────────────

function search(query: string, items: Item[], collections: Collection[]): Hit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/).filter(Boolean)

  const hits: Hit[] = []

  // Items —
  for (const it of items) {
    const fields = collectItemFields(it)
    const score = scoreFields(fields, tokens)
    if (score <= 0) continue
    const coll = collections.find((c) => c.id === it.collection)
    hits.push({
      score,
      target: { kind: 'item', id: it.id, collection: it.collection },
      title: it.title || it.url || it.text || 'Untitled',
      thumb: it.screenshot || it.design?.pages?.[0]?.screenshot,
      collectionName: coll?.name,
      badge: badgeForItem(it),
      snippet: snippetFor(fields, tokens)
    })
  }

  // Collections —
  for (const c of collections) {
    if (c.id === 'all') continue
    const fields = collectCollectionFields(c)
    const score = scoreFields(fields, tokens)
    if (score <= 0) continue
    hits.push({
      score: score + 1, // tiny boost so a collection title hit beats deep-nested item matches
      target: { kind: 'collection', id: c.id },
      title: c.name,
      thumb: c.color, // gradient string passed through
      badge: 'collection',
      snippet: snippetFor(fields, tokens)
    })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 20)
}

interface WeightedField {
  text: string
  /** Score multiplier — title-class fields outrank body text. */
  weight: number
  /** Source label used in snippets ("title", "tag", "palette", …). */
  source: string
}

function collectItemFields(it: Item): WeightedField[] {
  const f: WeightedField[] = []
  const push = (text: string | undefined | null, weight: number, source: string): void => {
    if (text && typeof text === 'string') f.push({ text, weight, source })
  }
  push(it.title, 10, 'title')
  push(it.url, 8, 'url')
  push((it.tags || []).join(' '), 7, 'tag')
  push(it.derivedFromLabel, 6, 'derive')
  push(it.prompt, 4, 'prompt')
  push(it.text, 4, 'text')
  push(it.author, 3, 'author')
  push(it.foundry, 3, 'foundry')
  push(it.classification, 3, 'class')
  push(it.sample, 3, 'sample')
  push(it.body, 2, 'body')
  push(it.meta, 2, 'meta')
  // palette — both hex and any role name carried alongside
  if (it.palette?.length) {
    push(it.palette.join(' '), 5, 'palette')
  }
  // design tokens
  const d = it.design
  if (d) {
    push(d.title, 8, 'title')
    push(d.theme, 6, 'theme')
    push(d.description, 4, 'description')
    push((d.tags || []).join(' '), 7, 'tag')
    if (d.palette) {
      push(
        d.palette.map((p) => `${p.hex || ''} ${p.role || ''}`).join(' '),
        5,
        'palette'
      )
    }
    if (d.fonts) push(d.fonts.map((x) => `${x.name || ''} ${x.role || ''}`).join(' '), 5, 'font')
    if (d.components)
      push(d.components.map((x) => x.name || '').join(' '), 5, 'component')
    if (d.ia) push(d.ia.map((x) => x.label || '').join(' '), 4, 'ia')
    if (d.motion) push(d.motion.map((x) => x.type || '').join(' '), 3, 'motion')
  }
  return f
}

function collectCollectionFields(c: Collection): WeightedField[] {
  return [
    { text: c.name || '', weight: 10, source: 'name' },
    { text: c.desc || '', weight: 4, source: 'desc' },
    { text: c.icon || '', weight: 2, source: 'icon' }
  ]
}

/** Score: every token must appear in at least one field. The score is the
 *  sum of the heaviest field where each token landed — so a title hit beats
 *  a description hit. Substring matches; cheap and good enough at this scale. */
function scoreFields(fields: WeightedField[], tokens: string[]): number {
  let total = 0
  for (const tok of tokens) {
    let best = 0
    for (const f of fields) {
      if (!f.text) continue
      if (f.text.toLowerCase().includes(tok)) {
        if (f.weight > best) best = f.weight
      }
    }
    if (best === 0) return 0 // missing token → not a hit
    total += best
  }
  return total
}

/** Pull a short excerpt around the first matched token — gives the user a
 *  reason for why the row is in the list ("matched in palette: #0a84ff"). */
function snippetFor(fields: WeightedField[], tokens: string[]): string | undefined {
  for (const tok of tokens) {
    for (const f of fields) {
      if (!f.text) continue
      const idx = f.text.toLowerCase().indexOf(tok)
      if (idx >= 0) {
        const start = Math.max(0, idx - 24)
        const end = Math.min(f.text.length, idx + tok.length + 36)
        const slice = (start > 0 ? '…' : '') + f.text.slice(start, end) + (end < f.text.length ? '…' : '')
        return `${f.source}: ${slice}`
      }
    }
  }
  return undefined
}

/**
 * Floating preview anchored next to the palette. Renders the full-resolution
 * thumb so the user can identify a hit at a glance without committing to open
 * it. Positioned to the right of the palette on wide screens; falls back to
 * stacking below on narrow ones.
 *
 * Why a separate component: re-rendering the whole list when only `active`
 * changes would be wasteful, and we want the card to fade between hits
 * without the underlying row layout jumping.
 */
function PreviewCard({ hit }: { hit: Hit }): React.JSX.Element {
  return (
    <div className="cmd-palette-preview" aria-hidden>
      <div className="cmd-palette-preview-frame">
        <img src={hit.thumb} alt="" draggable={false} />
      </div>
      <div className="cmd-palette-preview-label">{hit.title}</div>
    </div>
  )
}

function badgeForItem(it: Item): string | undefined {
  if (it.kind === 'video') return 'video'
  if (it.kind === 'link') return 'web'
  if (it.derivedFromItemId) return 'derive'
  if (it.kind === 'image') return 'image'
  if (it.kind === 'note') return 'note'
  return undefined
}
