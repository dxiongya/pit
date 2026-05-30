// HomeView.tsx — the "Everything" masonry surface with kind filters.

import { useState } from 'react'
import type { Item, ItemKind } from '../lib/types'
import { I } from '../lib/icons'
import { Masonry } from '../components/Masonry'
import { Button } from '../components/ui'

const FILTERS: { id: ItemKind | 'all'; label: string; swatch: string }[] = [
  { id: 'all', label: 'All', swatch: '#6e6e73' },
  { id: 'image', label: 'Images', swatch: '#e8624a' },
  { id: 'link', label: 'Sites', swatch: '#4356a0' },
  { id: 'palette', label: 'Palettes', swatch: '#8b4a7c' },
  { id: 'font', label: 'Fonts', swatch: '#2f8e8a' },
  { id: 'quote', label: 'Words', swatch: '#e6a73a' },
  { id: 'note', label: 'Notes', swatch: '#8fa84a' }
]

export function HomeView({
  items,
  title = 'Everything',
  scope = 'all',
  onOpenItem,
  onImport
}: {
  items: Item[]
  /** Heading shown in the hero (defaults to "Everything" for the home view). */
  title?: string
  /** Which slice of `items` to show. `inbox` keeps only items still in inbox;
   *  `recent` shows everything sorted by createdAt desc; `all` is the full library. */
  scope?: 'all' | 'recent' | 'inbox'
  onOpenItem: (i: Item) => void
  onImport: () => void
}): React.JSX.Element {
  const [filter, setFilter] = useState<ItemKind | 'all'>('all')

  // Scope first, then kind filter — Inbox shows only items still uncategorised.
  const scoped =
    scope === 'inbox'
      ? items.filter((i) => i.collection === 'inbox')
      : scope === 'recent'
        ? [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        : items
  const filtered = filter === 'all' ? scoped : scoped.filter((i) => i.kind === filter)
  const subtitle =
    scope === 'inbox'
      ? 'Uncategorised items — move them or let AI route them when you tweak collection descriptions.'
      : scope === 'recent'
        ? 'Everything, newest first.'
        : `${items.length} items total`

  return (
    <div className="canvas">
      <div className="hero">
        <div>
          <h1>{title}</h1>
          <div className="sub">
            <span>
              {scoped.length} {scope === 'inbox' ? 'in inbox' : 'items'}
            </span>
            <span className="dot" />
            <span>{subtitle}</span>
          </div>
        </div>
        <div className="hero-actions">
          <Button variant="primary" onClick={onImport}>
            <I.Link size={15} /> Press ⌘V to paste
          </Button>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            <span className="swatch" style={{ background: f.swatch }} />
            {f.label}
            <span className="count">
              {f.id === 'all' ? items.length : items.filter((i) => i.kind === f.id).length}
            </span>
          </button>
        ))}
      </div>

      <Masonry items={filtered} onOpenItem={onOpenItem} />
    </div>
  )
}
