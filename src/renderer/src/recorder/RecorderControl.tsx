// RecorderControl — the small "pill" widget that floats on the user's desktop
// while a recording is in progress. Sends pause/resume/stop commands to the
// main window (where MediaRecorder lives) via the IPC relay in main.

import { useEffect, useState } from 'react'

export function RecorderControl(): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    return window.pit.rec.onState((s) => {
      setElapsedMs(s.elapsedMs)
      setPaused(s.paused)
    })
  }, [])

  const send = (cmd: 'pause' | 'resume' | 'stop'): void => {
    window.pit.rec.sendControl(cmd)
  }

  return (
    <div className="rec-float">
      <div className="rec-float-drag" />
      <div className={`rec-float-pulse${paused ? ' paused' : ''}`} />
      <div className="rec-float-time">{formatTime(elapsedMs)}</div>
      <button
        type="button"
        className="rec-float-btn"
        onClick={() => send(paused ? 'resume' : 'pause')}
        title={paused ? 'Resume' : 'Pause'}
      >
        {paused ? (
          // Play triangle
          <svg width="11" height="13" viewBox="0 0 11 13" aria-hidden>
            <path d="M1 1 L10 6.5 L1 12 Z" fill="currentColor" />
          </svg>
        ) : (
          // Two pause bars
          <svg width="10" height="13" viewBox="0 0 10 13" aria-hidden>
            <rect x="1" y="1" width="2.5" height="11" rx="0.5" fill="currentColor" />
            <rect x="6.5" y="1" width="2.5" height="11" rx="0.5" fill="currentColor" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="rec-float-btn stop"
        onClick={() => send('stop')}
        title="Stop & analyze"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
          <rect x="0.5" y="0.5" width="10" height="10" rx="1.5" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

function formatTime(ms: number): string {
  const sec = Math.floor(ms / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
