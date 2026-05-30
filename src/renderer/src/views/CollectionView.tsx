// CollectionView.tsx — a single collection: cover, routing prompt banner, masonry.

import type { Collection, Item } from '../lib/types'
import { I } from '../lib/icons'
import { Masonry } from '../components/Masonry'
import { Button } from '../components/ui'

export function CollectionView({
  collection,
  items,
  onOpenItem,
  onEditPrompt,
  onImport,
  onShare
}: {
  collection: Collection
  items: Item[]
  onOpenItem: (i: Item) => void
  onEditPrompt: () => void
  onImport: () => void
  onShare: () => void
}): React.JSX.Element {
  // Only show items that actually live in this collection — no demo "extras"
  // from elsewhere (that's what made the same Inbox card show up in every
  // user collection's view).
  const own = items.filter((i) => i.collection === collection.id)

  return (
    <div className="canvas">
      <div className="collection-header">
        <div className="collection-cover" style={{ background: collection.color }}>
          {collection.icon}
        </div>
        <div className="collection-meta">
          <h1>{collection.name}</h1>
          {/* desc moved out — full text shown in the Collection-prompt banner
              below to avoid showing the same paragraph twice in a row. */}
          <div className="stats">
            <span>{own.length} items</span>
            <span className="dot" />
            <span>Auto-routing {collection.autoRoute ? 'on' : 'off'}</span>
          </div>
        </div>
        <div className="spacer" />
        <div className="hero-actions">
          <Button size="sm" onClick={onShare}>
            <I.Share size={14} /> Share
          </Button>
        </div>
      </div>

      {collection.prompt && (
        <div className="prompt-banner">
          <div className="pb-ico">
            <I.Sparkles size={14} />
          </div>
          <div className="pb-body">
            <div className="pb-h">Collection prompt · AI routes new items here when…</div>
            <div className="pb-text">{collection.prompt}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {(collection.tags || []).map((t) => (
                <span key={t} className="tag-pill ai">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <button className="pb-edit" onClick={onEditPrompt}>
            Edit
          </button>
        </div>
      )}

      <div className="chips">
        <button className="chip active">
          <span className="swatch" style={{ background: collection.color }} />
          In collection
          <span className="count">{own.length}</span>
        </button>
        <div style={{ flex: 1 }} />
        <button className="chip" onClick={onImport}>
          <I.Plus size={12} /> ⌘V to paste
        </button>
      </div>

      <Masonry items={own} onOpenItem={onOpenItem} />
    </div>
  )
}
