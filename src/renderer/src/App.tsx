// App.tsx — pit root: window shell, router, and overlays.

import { useEffect, useState } from 'react'
import type { Collection, View } from './lib/types'
import { StoreProvider, useStore } from './lib/store'
import { ToastHost, useToast } from './components/Toast'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { HomeView } from './views/HomeView'
import { CollectionView } from './views/CollectionView'
import { NewCollectionView } from './views/NewCollectionView'
import { SettingsView } from './views/SettingsView'
import { DetailOverlay } from './views/detail/DetailOverlay'
import { ShareModal, type ShareTarget } from './views/detail/ShareModal'
import { ReceiveShareModal } from './views/detail/ReceiveShareModal'
import { RecordingSession } from './views/detail/RecordingSession'
import { GroupImportModal } from './views/detail/GroupImportModal'
import { WelcomeGuide } from './views/detail/WelcomeGuide'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'

/**
 * Pull an importable link out of pasted clipboard text.
 *  - A bare URL / domain (no surrounding whitespace) is returned as-is, so
 *    plain "example.com" still works.
 *  - Otherwise we extract the first explicit http(s) URL embedded in a larger
 *    blob — e.g. a Xiaohongshu / X share message that wraps the link in a
 *    title + caption + "Copy and open …" boilerplate. Stops at whitespace and
 *    common CJK/ASCII punctuation, then trims trailing sentence punctuation.
 */
function firstUrlInText(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  if (!/\s/.test(t) && /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}/i.test(t)) return t
  const m = t.match(/https?:\/\/[^\s"'<>）)】，。、！？]+/i)
  if (!m) return null
  return m[0].replace(/[.,;!?]+$/, '')
}

function Shell(): React.JSX.Element {
  const {
    collections,
    items,
    addCollection,
    updateCollection,
    importLink,
    importImage,
    importVideo
  } = useStore()
  const toast = useToast()
  const [view, setView] = useState<View>('home')
  const [collectionId, setCollectionId] = useState('all')
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)
  // Set by `pit://share/<code>` deep links delivered to the main process.
  const [incomingShareCode, setIncomingShareCode] = useState<string | null>(null)
  const [groupImportOpen, setGroupImportOpen] = useState(false)
  // First-run onboarding. Auto-opens once; re-openable from the TopBar "?".
  const [guideOpen, setGuideOpen] = useState(false)
  // ⌘K / click-on-search palette. Lives at App level so we can drive the
  // navigate() + setOpenItemId callbacks directly when the user picks a hit.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  // null = creating a new collection; set = editing the one with this id
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null)
  const editingCollection = editingCollectionId
    ? collections.find((c) => c.id === editingCollectionId)
    : undefined

  // Live item (re-derived from the store) so the analyzing → ready transition
  // flows straight into the open detail overlay.
  const openItem = openItemId ? (items.find((i) => i.id === openItemId) ?? null) : null

  const navigate = (v: View, id?: string): void => {
    setView(v)
    if (id != null) setCollectionId(id)
  }

  // Show the welcome tour on first launch only (flag persisted in localStorage).
  useEffect(() => {
    try {
      if (!localStorage.getItem('pit:onboarded')) setGuideOpen(true)
    } catch {
      /* localStorage unavailable — skip the tour rather than block startup */
    }
  }, [])
  const closeGuide = (): void => {
    try {
      localStorage.setItem('pit:onboarded', '1')
    } catch {
      /* ignore */
    }
    setGuideOpen(false)
  }

  // Subscribe to pit:// deep links — the main process pushes a {code} whenever
  // the OS hands us a share URL (cold-start argv, macOS open-url, or a second
  // instance bringing the URL to the running one).
  useEffect(() => {
    return window.pit.share.onReceived(({ code }) => setIncomingShareCode(code))
  }, [])

  // `pit://item/<id>` — typically emitted by the MCP server in tool responses
  // so an LLM can hand the user a link that jumps right to the item. We look
  // the item up from the store, navigate into its collection (so the
  // breadcrumb / sidebar are in the right context), then open the detail
  // overlay. Best-effort: if the id is unknown we toast a friendly miss.
  useEffect(() => {
    return window.pit.onOpenItem(({ id }) => {
      const it = items.find((x) => x.id === id)
      if (!it) {
        toast.push(`Item not found: ${id.slice(0, 8)}…`)
        return
      }
      navigate('collection', it.collection)
      setOpenItemId(it.id)
    })
  }, [items, toast])

  // Global ⌘K / Ctrl+K → command palette. The shortcut also works while a
  // text field is focused so users can pop search out of any context.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteQuery('')
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Paste-to-import: anywhere outside a text field, detect a URL vs an image on
  // the clipboard and kick off a background capture/analyze with a pending card.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent): void => {
      const dt = e.clipboardData
      if (!dt) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return
      const imgItems = Array.from(dt.items).filter((i) => i.type.startsWith('image/'))
      if (imgItems.length > 0) {
        e.preventDefault()
        const files = imgItems.map((i) => i.getAsFile()).filter((f): f is File => f != null)
        for (const f of files) {
          const reader = new FileReader()
          reader.onload = (): void => importImage(reader.result as string)
          reader.readAsDataURL(f)
        }
        toast.push(
          files.length > 1
            ? `Importing ${files.length} images… (use "Group" in the top bar to combine into one design study)`
            : 'Importing image…'
        )
        return
      }
      const url = firstUrlInText(dt.getData('text/plain'))
      if (url) {
        e.preventDefault()
        importLink(url)
        toast.push('Importing link…')
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [importLink, importImage, toast])

  // Dev-only escape hatch: importing via CDP can't synthesize a real File with
  // a filesystem path, so we expose the store helper on window for end-to-end
  // smoke tests. Stripped from production by `if (import.meta.env.DEV)`.
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(
        window as unknown as { __pitImportVideo?: (path: string, name?: string) => void }
      ).__pitImportVideo = importVideo
    }
  }, [importVideo])

  // Drag-and-drop import — same intent as Cmd+V: image files from Finder /
  // Slack / Notion / browser become image items; dropped URLs become link items.
  // Skipped inside text inputs so users can still drag-paste into the textarea.
  useEffect(() => {
    const overTextField = (): boolean => {
      const el = document.activeElement as HTMLElement | null
      return !!(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
    }
    const onDragOver = (e: DragEvent): void => {
      const types = e.dataTransfer?.types
      if (!types) return
      // Must preventDefault to receive the drop, but only when an importable
      // payload is on offer — otherwise we'd block normal text drags inside inputs.
      if (
        Array.from(types).some((t) => t === 'Files' || t === 'text/uri-list' || t === 'text/plain')
      ) {
        e.preventDefault()
        document.body.classList.add('dropping')
      }
    }
    const clearDropping = (): void => document.body.classList.remove('dropping')
    const onDragLeave = (e: DragEvent): void => {
      // Only clear when leaving the window itself, not when crossing internal elements.
      if (e.relatedTarget === null) clearDropping()
    }
    const onDrop = (e: DragEvent): void => {
      clearDropping()
      const dt = e.dataTransfer
      if (!dt) return
      if (overTextField()) return
      const allFiles = Array.from(dt.files || [])
      const imageFiles = allFiles.filter((f) => f.type.startsWith('image/'))
      const videoFiles = allFiles.filter((f) => f.type.startsWith('video/'))
      if (videoFiles.length) {
        e.preventDefault()
        for (const f of videoFiles) {
          // Show a heads-up for big videos — extraction can take 10-30s. We
          // still proceed; the analyzing card communicates the wait.
          if (f.size > 200 * 1024 * 1024) {
            toast.push(`Large video (${(f.size / 1024 / 1024).toFixed(0)}MB) — may take a moment`)
          }
          const path = window.pit.pathForFile(f)
          if (path) importVideo(path, f.name)
          else toast.push('Cannot read video — try drag-in from Finder')
        }
        if (!imageFiles.length) {
          toast.push(
            videoFiles.length > 1 ? `Importing ${videoFiles.length} videos…` : 'Importing video…'
          )
          return
        }
      }
      if (imageFiles.length) {
        e.preventDefault()
        for (const f of imageFiles) {
          const r = new FileReader()
          r.onload = (): void => importImage(r.result as string)
          r.readAsDataURL(f)
        }
        toast.push(
          imageFiles.length > 1 ? `Importing ${imageFiles.length} images…` : 'Importing image…'
        )
        return
      }
      // No image files — look for URL text (uri-list first, then plain text).
      const raw = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim()
      if (!raw) return
      // Prefer explicit http(s) URLs anywhere in the text — this handles share
      // blobs (Xiaohongshu / X) that wrap the link in caption boilerplate. Only
      // when none are present do we fall back to bare-domain whitespace tokens.
      const explicit = (raw.match(/https?:\/\/[^\s"'<>）)】，。、！？]+/gi) || []).map((u) =>
        u.replace(/[.,;!?]+$/, '')
      )
      const urls = explicit.length
        ? explicit
        : raw
            .split(/\s+/)
            .map((s) => s.trim())
            .filter((s) => /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}/i.test(s))
      if (urls.length) {
        e.preventDefault()
        for (const u of urls) importLink(u)
        toast.push(urls.length > 1 ? `Importing ${urls.length} links…` : 'Importing link…')
      }
    }
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
      clearDropping()
    }
  }, [importLink, importImage, importVideo, toast])

  const coll = collections.find((c) => c.id === collectionId) || collections[0]

  // Build the share target appropriate for the current view. Item-level shares
  // are wired separately at the DetailOverlay's onShare callback.
  const openShareForCurrentView = (): void => {
    if (view === 'collection' && coll) {
      const collItems = coll.builtin
        ? coll.id === 'inbox'
          ? items.filter((i) => i.collection === 'inbox')
          : items // 'all' / 'recent' / other builtins → entire library
        : items.filter((i) => i.collection === coll.id)
      setShareTarget({ kind: 'collection', collection: coll, items: collItems })
    } else {
      // Home view — share the whole library as a synthetic "Everything" collection.
      setShareTarget({
        kind: 'collection',
        collection: { id: 'everything', name: 'Everything', color: '#6e6e73', icon: 'sparkles' },
        items
      })
    }
  }

  // Used by NewCollectionView for both create + edit. If we entered the view in
  // edit mode (editingCollectionId set), we update that record; otherwise add.
  const handleSubmitCollection = (c: Collection): void => {
    if (editingCollectionId) {
      updateCollection(editingCollectionId, c)
      const id = editingCollectionId
      setEditingCollectionId(null)
      navigate('collection', id)
    } else {
      addCollection(c)
      navigate('collection', c.id)
    }
  }
  const handleStartEdit = (c: Collection): void => {
    setEditingCollectionId(c.id)
    navigate('new-collection')
  }
  const handleCancelCollectionForm = (): void => {
    const wasEditing = editingCollectionId
    setEditingCollectionId(null)
    if (wasEditing) navigate('collection', wasEditing)
    else navigate('home')
  }

  return (
    <div className="mac-window">
      <Sidebar
        view={view}
        collectionId={collectionId}
        navigate={navigate}
        openNewCollection={() => navigate('new-collection')}
      />
      <div className="main">
        <TopBar
          view={view}
          collectionId={collectionId}
          navigate={navigate}
          openShare={openShareForCurrentView}
          openRecord={() => void window.pit.rec.openToolbar()}
          openGroup={() => setGroupImportOpen(true)}
          openSettings={() => navigate('settings')}
          openGuide={() => setGuideOpen(true)}
          openSearch={() => {
            setPaletteQuery('')
            setPaletteOpen(true)
          }}
        />

        {view === 'home' && (
          <HomeView
            items={items}
            onOpenItem={(i) => setOpenItemId(i.id)}
            onImport={() => toast.push('Press ⌘V anywhere to paste a link or image')}
          />
        )}

        {view === 'collection' && coll && !coll.builtin && (
          <CollectionView
            collection={coll}
            items={items}
            onOpenItem={(i) => setOpenItemId(i.id)}
            onEditPrompt={() => handleStartEdit(coll)}
            onImport={() => toast.push('Press ⌘V anywhere to paste a link or image')}
            onShare={() =>
              setShareTarget({
                kind: 'collection',
                collection: coll,
                items: items.filter((i) => i.collection === coll.id)
              })
            }
          />
        )}

        {view === 'collection' && coll && coll.builtin && (
          <HomeView
            items={items}
            title={coll.name}
            scope={coll.id === 'inbox' ? 'inbox' : coll.id === 'recent' ? 'recent' : 'all'}
            onOpenItem={(i) => setOpenItemId(i.id)}
            onImport={() => toast.push('Press ⌘V anywhere to paste a link or image')}
          />
        )}

        {view === 'new-collection' && (
          <NewCollectionView
            editing={editingCollection}
            onCancel={handleCancelCollectionForm}
            onSubmit={handleSubmitCollection}
          />
        )}

        {view === 'settings' && <SettingsView />}
      </div>

      {openItem && (
        <DetailOverlay
          item={openItem}
          onClose={() => setOpenItemId(null)}
          onShare={() => setShareTarget({ kind: 'item', item: openItem })}
        />
      )}
      {guideOpen && (
        <WelcomeGuide
          onClose={closeGuide}
          onOpenSettings={() => {
            closeGuide()
            navigate('settings')
          }}
        />
      )}
      {shareTarget && <ShareModal target={shareTarget} onClose={() => setShareTarget(null)} />}
      {incomingShareCode && (
        <ReceiveShareModal
          code={incomingShareCode}
          onClose={() => setIncomingShareCode(null)}
          onImported={(collectionId) => {
            setIncomingShareCode(null)
            navigate('collection', collectionId)
          }}
        />
      )}
      {/* Hidden — listens for pit:rec:begin from the toolbar window and runs
          the MediaRecorder lifecycle for that session. No UI of its own. */}
      <RecordingSession />
      {groupImportOpen && <GroupImportModal onClose={() => setGroupImportOpen(false)} />}
      <CommandPalette
        open={paletteOpen}
        query={paletteQuery}
        setQuery={setPaletteQuery}
        items={items}
        collections={collections}
        view={view}
        onClose={() => setPaletteOpen(false)}
        onPick={(a: PaletteAction) => {
          setPaletteOpen(false)
          if (a.kind === 'item') {
            // For items: navigate into the owning collection so the breadcrumb
            // + sidebar reflect the right context, then open the detail overlay.
            navigate('collection', a.collection)
            setOpenItemId(a.id)
          } else {
            navigate('collection', a.id)
          }
        }}
      />
    </div>
  )
}

function App(): React.JSX.Element {
  // ToastHost wraps StoreProvider so the store can surface persistence failures
  // (a failed SQLite write would otherwise vanish, leaving the UI out of sync).
  return (
    <ToastHost>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </ToastHost>
  )
}

export default App
