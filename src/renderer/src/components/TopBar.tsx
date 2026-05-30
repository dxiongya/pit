// TopBar.tsx — breadcrumb, search, and global actions.

import type { View } from '../lib/types'
import { I } from '../lib/icons'
import { useStore } from '../lib/store'
import { IconButton } from './ui'

export function TopBar({
  view,
  collectionId,
  navigate,
  openShare,
  openRecord,
  openGroup,
  openSettings,
  openSearch,
  openGuide
}: {
  view: View
  collectionId: string
  navigate: (v: View, id?: string) => void
  openShare: () => void
  openRecord: () => void
  openGroup: () => void
  openSettings: () => void
  openSearch: () => void
  openGuide: () => void
}): React.JSX.Element {
  const { collections, settings, setSetting } = useStore()
  const coll = collections.find((c) => c.id === collectionId)
  const theme = settings.theme

  let crumb: React.ReactNode = <span className="current">All</span>
  if (view === 'collection') {
    crumb = (
      <>
        <span className="clickable" onClick={() => navigate('home')}>
          Collections
        </span>
        <span className="sep">/</span>
        <span className="current">{coll?.name || ''}</span>
      </>
    )
  } else if (view === 'new-collection') {
    crumb = (
      <>
        <span className="clickable" onClick={() => navigate('home')}>
          Collections
        </span>
        <span className="sep">/</span>
        <span className="current">New collection</span>
      </>
    )
  } else if (view === 'settings') {
    crumb = <span className="current">Settings</span>
  }

  return (
    <div className="topbar drag">
      <div className="crumb no-drag">{crumb}</div>
      <div className="spacer" />
      <button
        type="button"
        className="search-pill no-drag"
        onClick={openSearch}
        title="Search (⌘K)"
      >
        <I.Search size={13} />
        <span className="search-pill-placeholder">Search everything…</span>
        <span className="kbd">⌘K</span>
      </button>
      <div className="kbd-hint no-drag" title="Press ⌘V anywhere to paste a link or image">
        <I.Link size={13} /> <span className="kbd">⌘V</span> to paste
      </div>
      <IconButton
        size="sm"
        className="no-drag"
        onClick={openGroup}
        title="Import a group of related images as one design study"
      >
        <I.Images size={15} />
      </IconButton>
      <IconButton
        size="sm"
        className="no-drag rec-btn"
        onClick={openRecord}
        title="Record screen"
      >
        <I.Record size={15} />
      </IconButton>
      <IconButton size="sm" className="no-drag" onClick={openShare} title="Share">
        <I.Share size={15} />
      </IconButton>
      <IconButton
        size="sm"
        className="no-drag"
        onClick={() => setSetting('theme', theme === 'light' ? 'dark' : 'light')}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      >
        {theme === 'dark' ? <I.Sun size={15} /> : <I.Moon size={15} />}
      </IconButton>
      <IconButton size="sm" className="no-drag" onClick={openSettings} title="Settings">
        <I.Settings size={15} />
      </IconButton>
      <IconButton size="sm" className="no-drag" onClick={openGuide} title="How pit works">
        <I.Help size={15} />
      </IconButton>
    </div>
  )
}
