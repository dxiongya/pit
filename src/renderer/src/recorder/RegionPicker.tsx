// RegionPicker — full-screen overlay that lets the user drag a rectangle on
// their display to choose a recording region. Returns the rect (display-relative
// CSS px) to main, which passes it back to RecordModal for the actual capture
// + crop. Enter / drag-up confirms; Esc cancels.

import { useEffect, useRef, useState } from 'react'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function normalize(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y)
  }
}

export function RegionPicker(): React.JSX.Element {
  // Two-phase: drag in progress vs settled. After mouseup we keep the rect
  // visible so the user can confirm with Enter or re-drag.
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [settled, setSettled] = useState<Rect | null>(null)
  const settledRef = useRef<Rect | null>(null)

  const live = start && cursor ? normalize(start, cursor) : null
  const visible = live || settled

  // Keyboard: Enter confirm (if we have a rect), Esc cancel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        window.pit.rec.sendRegionResult(null)
        return
      }
      if (e.key === 'Enter') {
        const r = settledRef.current
        if (r && r.w >= 16 && r.h >= 16) {
          window.pit.rec.sendRegionResult(r)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onDown = (e: React.MouseEvent): void => {
    setStart({ x: e.clientX, y: e.clientY })
    setCursor({ x: e.clientX, y: e.clientY })
    setSettled(null)
    settledRef.current = null
  }
  const onMove = (e: React.MouseEvent): void => {
    if (!start) return
    setCursor({ x: e.clientX, y: e.clientY })
  }
  const onUp = (): void => {
    if (start && cursor) {
      const r = normalize(start, cursor)
      // Tiny accidental drags shouldn't lock the user into a useless rect.
      if (r.w >= 16 && r.h >= 16) {
        setSettled(r)
        settledRef.current = r
      } else {
        setSettled(null)
        settledRef.current = null
      }
    }
    setStart(null)
    setCursor(null)
  }

  const confirm = (): void => {
    const r = settledRef.current
    if (!r) return
    window.pit.rec.sendRegionResult(r)
  }
  const cancel = (): void => window.pit.rec.sendRegionResult(null)

  return (
    <div className="rec-region" onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}>
      <div className="rec-region-dim" />
      {visible && (
        <>
          {/* The "hole" that punches the dim layer where the rect is. We layer
              brighter rect borders on top so the selection reads clearly. */}
          <div
            className="rec-region-hole"
            style={{ left: visible.x, top: visible.y, width: visible.w, height: visible.h }}
          />
          <div
            className="rec-region-frame"
            style={{ left: visible.x, top: visible.y, width: visible.w, height: visible.h }}
          >
            <div className="rec-region-dim-text">
              {visible.w} × {visible.h}
            </div>
          </div>
        </>
      )}

      {!live && !settled && (
        <div className="rec-region-hint">
          <div className="rec-region-hint-row">Drag to select a recording area</div>
          <div className="rec-region-hint-row muted">Esc to cancel</div>
        </div>
      )}

      {settled && !live && (
        <div
          className="rec-region-confirmbar"
          style={{
            left: Math.min(window.innerWidth - 220, settled.x + settled.w + 12),
            top: settled.y
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" className="rec-region-btn primary" onClick={confirm}>
            Record this area
          </button>
          <button type="button" className="rec-region-btn" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
