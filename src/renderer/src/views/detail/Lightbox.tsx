// Lightbox — full-window image viewer with scroll-zoom + click-drag pan.
//
// Used by every detail view to give the stage a "see it big" affordance:
// click the stage's expand button (or the image itself) → image fills the
// pit window, scroll wheel zooms centred on the cursor, click-and-drag pans,
// double-click toggles 1:1 / fit, +/- buttons + percentage readout in the
// bottom toolbar, Esc or background-click closes.

import { useEffect, useMemo, useRef, useState } from 'react'

interface Pos {
  x: number
  y: number
}

const MIN_SCALE = 0.1
const MAX_SCALE = 8
// Discrete step for +/- keys and the toolbar buttons.
const ZOOM_STEP = 1.2
// Wheel/trackpad sensitivity. Lower = slower zoom. We feed `deltaY` into
// `exp(-deltaY * k)` so the same gesture maps to the same multiplicative
// change regardless of how many ticks it arrived in. macOS trackpads emit
// many small deltas (~1-4 per tick); a discrete `* 1.2` per tick was 4–6×
// too fast under fingers.
const WHEEL_SENSITIVITY = 0.0035
// macOS reports trackpad pinch as wheel events with ctrlKey + a larger
// per-event delta. Different sensitivity keeps pinch from overshooting.
const PINCH_SENSITIVITY = 0.012

export function Lightbox({
  src,
  alt,
  onClose
}: {
  src: string
  alt?: string
  onClose: () => void
}): React.JSX.Element {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState<Pos>({ x: 0, y: 0 })
  const dragRef = useRef<{ baseX: number; baseY: number; startX: number; startY: number } | null>(
    null
  )
  const [dragging, setDragging] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const zoomBy = (factor: number, originX?: number, originY?: number): void => {
    setScale((s) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor))
      // Zoom-around-cursor: shift pos so the point under the cursor stays put.
      if (originX != null && originY != null && imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = originX - cx
        const dy = originY - cy
        const ratio = next / s - 1
        setPos((p) => ({ x: p.x - dx * ratio, y: p.y - dy * ratio }))
      }
      return next
    })
  }

  const reset = (): void => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }

  // Esc closes; +/- keys zoom; 0 resets. Declared after zoomBy/reset so the
  // key handler references them without a use-before-declaration.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / ZOOM_STEP)
      else if (e.key === '0') reset()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onWheel = (e: React.WheelEvent<HTMLDivElement>): void => {
    // Continuous zoom: factor = exp(-deltaY * k) so that doubling the gesture
    // length doubles the multiplicative zoom (zoom in then out by the same
    // amount lands at the original scale). Clamping deltaY avoids "tossing"
    // the image when the OS coalesces a fling into one giant event.
    const k = e.ctrlKey ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY
    const clamped = Math.max(-80, Math.min(80, e.deltaY))
    const factor = Math.exp(-clamped * k)
    zoomBy(factor, e.clientX, e.clientY)
  }

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    // Only start a pan on the image itself / its wrap, not the toolbar.
    if ((e.target as HTMLElement).closest('.lightbox-toolbar')) return
    dragRef.current = {
      baseX: pos.x,
      baseY: pos.y,
      startX: e.clientX,
      startY: e.clientY
    }
    setDragging(true)
  }
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!dragRef.current) return
    setPos({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY)
    })
  }
  const endDrag = (): void => {
    dragRef.current = null
    setDragging(false)
  }

  const onDoubleClick = (): void => {
    if (scale === 1) {
      setScale(2)
    } else {
      reset()
    }
  }

  // Click on the empty backdrop (not the image) closes — but only if it was
  // a static click, not a drag-release that ended at the backdrop.
  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
      transformOrigin: 'center',
      transition: dragging ? 'none' : 'transform 0.14s ease-out',
      cursor: dragging ? 'grabbing' : 'grab',
      userSelect: 'none' as const
    }),
    [pos, scale, dragging]
  )

  return (
    <div
      className="lightbox"
      onClick={onBackdropClick}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onDoubleClick={onDoubleClick}
        draggable={false}
        className="lightbox-img"
        style={transformStyle}
      />
      <div className="lightbox-toolbar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="lightbox-btn"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          title="Zoom out (−)"
        >
          −
        </button>
        <span className="lightbox-pct">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          className="lightbox-btn"
          onClick={() => zoomBy(ZOOM_STEP)}
          title="Zoom in (+)"
        >
          +
        </button>
        <button
          type="button"
          className="lightbox-btn"
          onClick={reset}
          title="Reset (0)"
        >
          Reset
        </button>
        <div className="lightbox-sep" />
        <button
          type="button"
          className="lightbox-btn close"
          onClick={onClose}
          title="Close (Esc)"
        >
          Close
        </button>
      </div>
      <div className="lightbox-hint">scroll = zoom · drag = pan · dbl-click = 1:1</div>
    </div>
  )
}
