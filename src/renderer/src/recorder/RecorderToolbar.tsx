// RecorderToolbar — the bottom-of-screen picker that replaces the in-app
// modal. Modelled on CleanShot X / Loom toolbars: a dark pill with mode
// icons (Display / Window / Area) + mic toggle + Start button + close.
//
// The toolbar lives in its own BrowserWindow (#/recorder-toolbar). It's the
// only UI shown to the user until they click Start; at that point the
// toolbar tells main to begin a recording session (closes itself, spawns
// float widget + border overlay, and signals the hidden main pit window
// to fire MediaRecorder).

import { useEffect, useRef, useState } from 'react'

type Mode = 'display' | 'window' | 'area'
type Source = { id: string; name: string; thumbnail: string; kind: 'screen' | 'window' }

export function RecorderToolbar(): React.JSX.Element {
  const [mode, setMode] = useState<Mode>('display')
  const [audio, setAudio] = useState(false)
  const [sources, setSources] = useState<Source[]>([])
  const [chosenSourceId, setChosenSourceId] = useState<string | null>(null)
  const [areaRect, setAreaRect] = useState<{
    x: number
    y: number
    w: number
    h: number
    displayId: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // Show source-list popover for Window mode
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Load sources once — used by Window mode picker popover. Display mode
  // doesn't need a picker (records the primary display).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await window.pit.capture.listSources()
        if (!cancelled) setSources(s)
      } catch (e) {
        if (!cancelled) setErr((e as Error).message)
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [])

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    const onDown = (e: MouseEvent): void => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [popoverOpen])

  // Keyboard: Esc cancels everything
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.pit.rec.cancelToolbar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const screens = sources.filter((s) => s.kind === 'screen')
  const windows = sources.filter((s) => s.kind === 'window')

  // Compute readiness + the selection preview shown next to the mode tabs.
  let chosenLabel: string | null = null
  let chosenThumb: string | null = null
  if (mode === 'display') {
    chosenLabel = screens[0]?.name || 'Display'
    chosenThumb = screens[0]?.thumbnail || null
  } else if (mode === 'window') {
    const w = windows.find((win) => win.id === chosenSourceId)
    chosenLabel = w?.name || null
    chosenThumb = w?.thumbnail || null
  } else if (mode === 'area') {
    chosenLabel = areaRect ? `Area ${areaRect.w} × ${areaRect.h}` : null
  }
  const ready = chosenLabel != null

  const pickArea = async (): Promise<void> => {
    setBusy(true)
    setErr(null)
    try {
      const rect = await window.pit.rec.pickRegion()
      if (rect) setAreaRect(rect)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const start = (): void => {
    if (!ready) return
    let sourceId: string | undefined
    let cropRect: { x: number; y: number; w: number; h: number } | undefined
    if (mode === 'display') {
      sourceId = screens[0]?.id
    } else if (mode === 'window') {
      sourceId = chosenSourceId ?? undefined
    } else if (mode === 'area' && areaRect) {
      sourceId = `screen:${areaRect.displayId}:0`
      cropRect = { x: areaRect.x, y: areaRect.y, w: areaRect.w, h: areaRect.h }
    }
    if (!sourceId) return
    window.pit.rec.begin({
      mode: mode === 'display' ? 'screen' : mode === 'window' ? 'window' : 'region',
      sourceId,
      audio,
      cropRect,
      sourceLabel: chosenLabel || undefined
    })
  }

  return (
    <div className="rec-toolbar">
      <button
        className="rec-tb-close"
        type="button"
        onClick={() => window.pit.rec.cancelToolbar()}
        title="Cancel"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path
            d="M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="rec-tb-modes">
        <ModeBtn icon="display" label="Display" active={mode === 'display'} onClick={() => setMode('display')} />
        <ModeBtn
          icon="window"
          label="Window"
          active={mode === 'window'}
          onClick={() => {
            setMode('window')
            setPopoverOpen(true)
          }}
        />
        <ModeBtn
          icon="area"
          label="Area"
          active={mode === 'area'}
          onClick={() => {
            setMode('area')
            void pickArea()
          }}
        />
      </div>

      <div className="rec-tb-sep" />

      <button
        type="button"
        className={`rec-tb-toggle${audio ? ' on' : ''}`}
        onClick={() => setAudio((v) => !v)}
        title={audio ? 'Microphone on' : 'Microphone off'}
      >
        {audio ? <MicIcon /> : <MicOffIcon />}
        <span className="rec-tb-toggle-label">{audio ? 'Microphone' : 'No microphone'}</span>
      </button>

      <div className="rec-tb-sep" />

      <div className="rec-tb-spacer" />

      {chosenLabel && (
        <button
          type="button"
          className="rec-tb-selection"
          onClick={() => {
            if (mode === 'window') setPopoverOpen(true)
            else if (mode === 'area') void pickArea()
          }}
          title={`Click to re-pick — ${chosenLabel}`}
        >
          {chosenThumb ? (
            <img src={chosenThumb} alt="" />
          ) : (
            <span className="rec-tb-selection-glyph">▢</span>
          )}
          <span className="rec-tb-selection-label">{chosenLabel}</span>
        </button>
      )}

      <button
        type="button"
        className="rec-tb-start"
        onClick={start}
        disabled={!ready || busy}
        title={ready ? `Start recording — ${chosenLabel}` : 'Pick a source first'}
      >
        <span className="rec-tb-start-dot" />
        Start recording
      </button>

      {/* Window picker popover — slides up above the toolbar */}
      {popoverOpen && mode === 'window' && (
        <div className="rec-tb-popover" ref={popoverRef}>
          <div className="rec-tb-popover-title">Pick a window</div>
          {windows.length === 0 && <div className="rec-tb-popover-empty">No windows found</div>}
          <div className="rec-tb-popover-grid">
            {windows.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`rec-tb-popover-card${chosenSourceId === w.id ? ' chosen' : ''}`}
                onClick={() => {
                  setChosenSourceId(w.id)
                  setPopoverOpen(false)
                }}
              >
                <img src={w.thumbnail} alt={w.name} />
                <div className="rec-tb-popover-name" title={w.name}>
                  {w.name}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {err && <div className="rec-tb-err">{err}</div>}
    </div>
  )
}

function ModeBtn({
  icon,
  label,
  active,
  onClick
}: {
  icon: 'display' | 'window' | 'area'
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`rec-tb-mode${active ? ' active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="rec-tb-mode-icon">
        {icon === 'display' && <DisplayIcon />}
        {icon === 'window' && <WindowIcon />}
        {icon === 'area' && <AreaIcon />}
      </span>
      <span className="rec-tb-mode-label">{label}</span>
    </button>
  )
}

function DisplayIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="2" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M8 19 H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function WindowIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="3" y="3" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <circle cx="6" cy="6.3" r="0.9" fill="currentColor" />
      <circle cx="8.8" cy="6.3" r="0.9" fill="currentColor" />
      <circle cx="11.6" cy="6.3" r="0.9" fill="currentColor" />
    </svg>
  )
}
function AreaIcon(): React.JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <path
        d="M3 5 V3 H5 M17 3 H19 V5 M19 17 V19 H17 M5 19 H3 V17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M3 9 V13 M3 13 V13 M9 3 H13 M19 9 V13 M9 19 H13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  )
}
function MicIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="6" y="2" width="4" height="8" rx="2" fill="currentColor" />
      <path
        d="M4 8 V8.5 C4 10.7 5.8 12.5 8 12.5 C10.2 12.5 12 10.7 12 8.5 V8 M8 12.5 V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
function MicOffIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="6" y="2" width="4" height="8" rx="2" fill="currentColor" opacity="0.5" />
      <path
        d="M4 8 V8.5 C4 10.7 5.8 12.5 8 12.5 C10.2 12.5 12 10.7 12 8.5 V8 M8 12.5 V14"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <path d="M2 14 L14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
