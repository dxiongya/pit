// NewCollectionView.tsx — feature 4: create a user collection.
// Model: a collection is just a `name + description`. When a new item is
// imported, the routing model reads every collection's description and picks
// the best semantic match — no tag matrix, no skip lists.

import { useState } from 'react'
import type { Collection } from '../lib/types'
import { I } from '../lib/icons'
import { suggestCollectionDescription } from '../lib/ai/provider'
import { useStore } from '../lib/store'
import { useToast } from '../components/Toast'
import { Button, Input } from '../components/ui'

const COVER_COLORS = [
  '#e8624a',
  '#f5b400',
  '#8fa84a',
  '#2f8e8a',
  '#4356a0',
  '#8b4a7c',
  '#e89bb0',
  '#1c1611'
]

export function NewCollectionView({
  editing,
  onCancel,
  onSubmit
}: {
  editing?: Collection
  onCancel: () => void
  onSubmit: (collection: Collection) => void
}): React.JSX.Element {
  const { settings } = useStore()
  const toast = useToast()
  // Pre-fill from `editing` when in edit mode, otherwise empty.
  const [name, setName] = useState(editing?.name || '')
  const [color, setColor] = useState(editing?.color || '#e8624a')
  const [description, setDescription] = useState(editing?.desc || editing?.prompt || '')
  const [autoRoute, setAutoRoute] = useState(editing?.autoRoute ?? true)
  const [suggesting, setSuggesting] = useState(false)
  const isEditing = !!editing

  const handleSuggest = async (): Promise<void> => {
    if (!name.trim() || suggesting) return
    setSuggesting(true)
    const { text, error } = await suggestCollectionDescription(
      name.trim(),
      description.trim(),
      settings.ai
    )
    setSuggesting(false)
    if (text) {
      setDescription(text)
      toast.push('AI draft inserted — edit freely')
    } else if (error) {
      toast.push(error)
    }
  }

  // Cover glyph follows the name — first letter, uppercase. Dot as placeholder.
  const cover = name.trim().charAt(0).toUpperCase() || '·'
  const canCreate = name.trim().length > 0 && description.trim().length > 0

  const save = (): void => {
    if (!canCreate) return
    const desc = description.trim()
    onSubmit({
      // Keep the existing id when editing — we're updating in place, not cloning.
      id: editing?.id ?? `c${Date.now()}`,
      name: name.trim(),
      color,
      icon: cover, // auto-derived from name
      desc,
      prompt: desc, // routing reads `prompt` — keep them in sync
      autoRoute
    })
  }

  return (
    <div className="canvas">
      <div className="hero" style={{ padding: '8px 4px 18px' }}>
        <div>
          <h1>{isEditing ? 'Edit collection' : 'New collection'}</h1>
          <div className="sub">
            <span>The description below is what AI reads to decide which items belong here.</span>
          </div>
        </div>
        <div className="hero-actions">
          <Button size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={!canCreate}>
            <I.Check size={14} /> {isEditing ? 'Save changes' : 'Create collection'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 18 }}>
        {/* Left: form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="settings-card">
            <h3>Identity</h3>
            <div className="pb-sub">A name and a cover. Both can change later.</div>
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 14 }}>
              <div
                className="collection-cover"
                style={{ background: color, width: 88, height: 88, fontSize: 50 }}
              >
                {cover}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Input
                  placeholder="e.g. Mobile UI, Editorial layouts, Brand systems"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COVER_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: c,
                        border: c === color ? '2px solid var(--ink)' : '1px solid var(--hair)',
                        cursor: 'pointer'
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="settings-card">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div>
                <h3>What belongs here</h3>
                <div className="pb-sub">
                  Write it in your own words. The routing model reads this every time a new item is
                  imported and picks the collection whose description fits best.
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSuggest}
                disabled={!name.trim() || suggesting}
                title={
                  name.trim()
                    ? 'Have AI draft a starter description from the name'
                    : 'Enter a name first'
                }
              >
                {suggesting ? (
                  <>
                    <span className="dot-pulse" /> Drafting…
                  </>
                ) : (
                  <>
                    <I.Sparkles size={13} /> AI draft
                  </>
                )}
              </Button>
            </div>
            <textarea
              className="prompt-area"
              style={{ marginTop: 12, minHeight: 140 }}
              placeholder={`e.g. Mobile app UI — iOS and Android screens, native components, on-boarding flows, tab bars. Skip desktop and browser-based web layouts.

The more concrete you are about scope (mobile vs desktop, native vs web, marketing vs product, etc), the more confidently AI can sort items into here.`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="pb-sub" style={{ marginTop: 6, fontSize: 11 }}>
              {description.trim().length} characters · two or three concrete sentences works best.
            </div>
          </div>

          <div
            className="settings-card"
            style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}
          >
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 4 }}>Auto-route new items here</h3>
              <div className="pb-sub" style={{ marginTop: 0 }}>
                {autoRoute
                  ? 'On — when you paste something new, AI reads the description above and drops it here if it fits. Otherwise you drag items in manually.'
                  : 'Off — items only land here when you move them by hand.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAutoRoute((v) => !v)}
              className={`route-toggle${autoRoute ? ' on' : ''}`}
              aria-pressed={autoRoute}
            >
              <span className="route-toggle-thumb" />
              <span className="route-toggle-label">{autoRoute ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="settings-card">
            <h3>How AI sees this</h3>
            <div
              style={{
                background: 'var(--bg-softer)',
                borderLeft: `3px solid ${color}`,
                borderRadius: '0 8px 8px 0',
                padding: '12px 14px',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--ink-2)',
                fontFamily: 'var(--f-mono)',
                whiteSpace: 'pre-wrap',
                marginTop: 10
              }}
            >
              {description.trim() ||
                'No description yet — AI has nothing to match against. New items will land in Inbox.'}
            </div>
            <div className="pb-sub" style={{ marginTop: 12, fontSize: 11.5, lineHeight: 1.6 }}>
              On every new import, the routing model gets:
              <br />• the item&apos;s title + AI summary + extracted tags
              <br />• the descriptions of every collection
              <br />
              and picks the best match (or Inbox if nothing beats the threshold).
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
