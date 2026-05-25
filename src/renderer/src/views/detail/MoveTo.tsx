// MoveTo.tsx — button + popover for moving an item to another collection,
// and for asking AI to re-route it. Used in the DetailOverlay actions row.

import { useEffect, useRef, useState } from 'react'
import type { Collection, Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { useStore } from '../../lib/store'
import { useToast } from '../../components/Toast'
import { routeItem } from '../../lib/ai/provider'

export function MoveToButton({ item }: { item: Item }): React.JSX.Element {
  const { collections, settings, moveItem } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [routing, setRouting] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const move = (cid: string): void => {
    if (cid === item.collection) {
      setOpen(false)
      return
    }
    moveItem(item.id, cid)
    const target = collections.find((c) => c.id === cid)
    toast.push(`Moved to ${target?.name || cid}`)
    setOpen(false)
  }

  const reroute = async (): Promise<void> => {
    if (routing) return
    setRouting(true)
    const r = await routeItem(
      {
        title: item.title,
        prompt: item.design?.description || item.design?.stylePrompt || item.prompt,
        tags: item.tags
      },
      collections,
      settings.ai
    )
    setRouting(false)
    if (r.best && r.best !== item.collection) move(r.best)
    else {
      toast.push('AI keeps it here — nothing fits better.')
      setOpen(false)
    }
  }

  const current = collections.find((c) => c.id === item.collection)
  const builtin = collections.filter((c) => c.builtin)
  const userCols = collections.filter((c) => !c.builtin)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        className="detail-action"
        onClick={() => setOpen((o) => !o)}
        title={`In: ${current?.name || 'Inbox'} — click to move`}
      >
        <I.Folder size={14} />
      </button>
      {open && (
        <div className="move-pop" role="menu">
          <button
            className="move-pop-item ai"
            onClick={() => void reroute()}
            disabled={routing}
            type="button"
          >
            <I.Sparkles size={13} />
            <span>{routing ? 'Re-routing…' : 'Let AI re-route'}</span>
          </button>
          <div className="move-pop-sep" />
          <div className="move-pop-section">Built-in</div>
          {builtin.map((c) => (
            <Row key={c.id} c={c} current={item.collection} onPick={move} />
          ))}
          {userCols.length > 0 && (
            <>
              <div className="move-pop-sep" />
              <div className="move-pop-section">Your collections</div>
              {userCols.map((c) => (
                <Row key={c.id} c={c} current={item.collection} onPick={move} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Row({
  c,
  current,
  onPick
}: {
  c: Collection
  current?: string
  onPick: (id: string) => void
}): React.JSX.Element {
  const active = c.id === current
  return (
    <button
      type="button"
      className={`move-pop-item${active ? ' active' : ''}`}
      onClick={() => onPick(c.id)}
      disabled={active}
    >
      <span className="move-pop-swatch" style={{ background: c.color }} />
      <span style={{ flex: 1, textAlign: 'left' }}>{c.name}</span>
      {active && <I.Check size={12} />}
    </button>
  )
}
