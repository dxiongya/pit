// Sidebar.tsx — window chrome region + collection / tag navigation.

import type { View } from '../lib/types'
import { I } from '../lib/icons'
import { useStore } from '../lib/store'

function Brand(): React.JSX.Element {
  return (
    <div className="sb-brand">
      <div className="sb-brand-mark">p</div>
      <div className="sb-brand-name">pit</div>
    </div>
  )
}

function SidebarItem({
  swatch,
  icon,
  label,
  count,
  selected,
  onClick
}: {
  swatch?: string
  icon?: React.ReactNode
  label: string
  count?: number
  selected?: boolean
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button className={`sb-item no-drag${selected ? ' selected' : ''}`} onClick={onClick}>
      {swatch ? (
        <div className="sb-swatch" style={{ background: swatch }} />
      ) : icon ? (
        <div className="sb-icon">{icon}</div>
      ) : null}
      <div className="sb-label">{label}</div>
      {count != null && <div className="sb-count">{count}</div>}
    </button>
  )
}

// Sidebar tag swatches — cycled through the live tag list (real items only).
const TAG_PALETTE = ['#e8624a', '#a9c8d6', '#1c1611', '#e2d4ba', '#8fa84a', '#8b4a7c']
const TAG_LIMIT = 8

export function Sidebar({
  view,
  collectionId,
  navigate,
  openNewCollection
}: {
  view: View
  collectionId: string
  navigate: (v: View, id?: string) => void
  openNewCollection: () => void
}): React.JSX.Element {
  const { collections, items } = useStore()
  const builtin = collections.filter((c) => c.builtin)
  const user = collections.filter((c) => !c.builtin)

  // Real counts: All & Recent = every item; Inbox & user collections = filtered.
  // ("Recent" is the time-sorted view of the whole library — same total as All.)
  const count = (id: string): number =>
    id === 'all' || id === 'recent' ? items.length : items.filter((i) => i.collection === id).length

  // Aggregate the top tags actually present on saved items (replaces the old
  // hard-coded TAGS demo list). Empty when the library has no tagged items.
  const topTags: { label: string; count: number; color: string }[] = (() => {
    const counts = new Map<string, number>()
    for (const i of items) for (const t of i.tags || []) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TAG_LIMIT)
      .map(([label, c], i) => ({ label, count: c, color: TAG_PALETTE[i % TAG_PALETTE.length] }))
  })()

  return (
    <aside className="sidebar">
      <div className="sidebar-titlebar drag" />
      <div className="drag">
        <Brand />
      </div>

      <div className="sidebar-scroll">
        {builtin.map((c) => (
          <SidebarItem
            key={c.id}
            swatch={c.color}
            label={c.name}
            count={count(c.id)}
            selected={
              (view === 'home' && c.id === 'all') ||
              (view === 'collection' && collectionId === c.id)
            }
            onClick={() => navigate(c.id === 'all' ? 'home' : 'collection', c.id)}
          />
        ))}

        <div className="sb-section-title">
          Collections
          <button className="add-btn no-drag" onClick={openNewCollection} title="New collection">
            <I.Plus size={12} />
          </button>
        </div>

        {user.map((c) => (
          <SidebarItem
            key={c.id}
            swatch={c.color}
            label={c.name}
            count={count(c.id)}
            selected={view === 'collection' && collectionId === c.id}
            onClick={() => navigate('collection', c.id)}
          />
        ))}

        {topTags.length > 0 && (
          <>
            <div className="sb-section-title">Tags</div>
            {topTags.map((t) => (
              <SidebarItem key={t.label} swatch={t.color} label={t.label} count={t.count} />
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
