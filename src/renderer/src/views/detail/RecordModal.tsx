// RecordModal — pro screen recorder, modelled on Loom / CleanShot X.
//
// Phases:
//   1. picker  — mode tabs (Screen / Window / Region) + audio toggle (default
//                OFF) + thumbnail grid (for Screen/Window). Picking a source
//                kicks off recording. For Region, drop straight into the
//                fullscreen region picker, then start.
//   2. RUNNING — main pit window is minimized; a small float widget appears
//                on the desktop with timer + pause/stop. For Screen/Region
//                modes the recorded display also gets a red border overlay
//                so the user sees what's being captured. The modal itself is
//                still mounted (in the minimized main window) so MediaRecorder
//                + the captured MediaStream stay alive.
//   3. saving  — Stop received → main window restores, blob is persisted,
//                importVideo() runs (and the existing keyframe-extract +
//                single-call AI analysis takes it from there).

import { useEffect, useRef, useState } from 'react'
import { I } from '../../lib/icons'
import { Button } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useStore } from '../../lib/store'

type Source = { id: string; name: string; thumbnail: string; kind: 'screen' | 'window' }
type Mode = 'screen' | 'window' | 'region'
type Phase =
  | { kind: 'picker'; sources: Source[]; loading: boolean; error?: string }
  | {
      kind: 'recording'
      mode: Mode
      sourceLabel: string
      startedAt: number
      pausedAccumMs: number
      pauseStartedAt: number | null
      cropRect?: { x: number; y: number; w: number; h: number }
    }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

export function RecordModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const toast = useToast()
  const { importVideo } = useStore()
  const [phase, setPhase] = useState<Phase>({ kind: 'picker', sources: [], loading: true })
  const [mode, setMode] = useState<Mode>('screen')
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [, forceRender] = useState(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Load OS capture sources for the picker.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const sources = await window.pit.capture.listSources()
        if (cancelled) return
        setPhase({ kind: 'picker', sources, loading: false })
      } catch (e) {
        if (cancelled) return
        setPhase({
          kind: 'picker',
          sources: [],
          loading: false,
          error: (e as Error).message
        })
      }
    })()
    return (): void => {
      cancelled = true
    }
  }, [])

  // While recording, tick the timer and push the live state to the float widget.
  useEffect(() => {
    if (phase.kind !== 'recording') return
    const tick = (): void => {
      const elapsed = computeElapsed(phase)
      window.pit.rec.pushState({ elapsedMs: elapsed, paused: phase.pauseStartedAt != null })
      forceRender((x) => x + 1)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [phase])

  // Listen for control commands from the float widget (pause / resume / stop).
  useEffect(() => {
    return window.pit.rec.onCommand((cmd) => {
      if (phase.kind !== 'recording') return
      const rec = recorderRef.current
      if (!rec) return
      if (cmd === 'pause' && rec.state === 'recording') {
        rec.pause()
        setPhase({ ...phase, pauseStartedAt: Date.now() })
      } else if (cmd === 'resume' && rec.state === 'paused') {
        rec.resume()
        const extra = phase.pauseStartedAt ? Date.now() - phase.pauseStartedAt : 0
        setPhase({
          ...phase,
          pausedAccumMs: phase.pausedAccumMs + extra,
          pauseStartedAt: null
        })
      } else if (cmd === 'stop') {
        void stopRecording()
      }
    })
  }, [phase])

  // Esc + unmount cleanup — make sure the OS stream is released even if the
  // modal is dismissed mid-flight, otherwise the macOS recording indicator
  // stays lit in the menu bar.
  useEffect(() => {
    return (): void => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          // best-effort
        }
      }
      // Best-effort teardown — main is idempotent if already torn down.
      void window.pit.rec.stopChrome()
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase.kind !== 'saving' && phase.kind !== 'recording') {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const startWithStream = async (
    stream: MediaStream,
    label: string,
    rmode: Mode,
    cropRect?: { x: number; y: number; w: number; h: number }
  ): Promise<void> => {
    mediaStreamRef.current = stream

    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e): void => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.start(1000)

    setPhase({
      kind: 'recording',
      mode: rmode,
      sourceLabel: label,
      startedAt: Date.now(),
      pausedAccumMs: 0,
      pauseStartedAt: null,
      cropRect
    })

    // Spawn the float widget + (optional) border overlay + minimize main.
    await window.pit.rec.startChrome({ mode: rmode })
  }

  const startScreenOrWindow = async (source: Source): Promise<void> => {
    try {
      const audio = audioEnabled ? true : false
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: {
          // @ts-expect-error — Electron-only constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            maxWidth: 1920,
            maxHeight: 1200,
            maxFrameRate: 30
          }
        }
      })
      await startWithStream(stream, source.name, source.kind === 'screen' ? 'screen' : 'window')
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  const startRegion = async (): Promise<void> => {
    // Drop into the fullscreen region picker first. RecordModal stays mounted
    // (invisible behind the picker) so we resume cleanly afterwards.
    const rect = await window.pit.rec.pickRegion()
    if (!rect) return // user cancelled; stay on picker
    try {
      const audio = audioEnabled ? true : false
      // Region capture still records the whole display; the rect is remembered
      // and passed to ffmpeg crop during keyframe extraction.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: {
          // @ts-expect-error — Electron-only constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: `screen:${rect.displayId}:0`,
            maxWidth: 3840,
            maxHeight: 2400,
            maxFrameRate: 30
          }
        }
      })
      await startWithStream(
        stream,
        `Region ${rect.w}×${rect.h}`,
        'region',
        { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
      )
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  const stopRecording = async (): Promise<void> => {
    const rec = recorderRef.current
    if (!rec) return
    const currentCropRect = phase.kind === 'recording' ? phase.cropRect : undefined
    setPhase({ kind: 'saving' })
    await new Promise<void>((resolve) => {
      rec.onstop = (): void => resolve()
      try {
        rec.stop()
      } catch {
        resolve()
      }
    })
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    mediaStreamRef.current = null

    // Restore main window + tear down float/border before kicking off analysis.
    await window.pit.rec.stopChrome()

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    if (blob.size === 0) {
      setPhase({ kind: 'error', message: 'Recording was empty — nothing was captured.' })
      return
    }
    try {
      const buf = await blob.arrayBuffer()
      const { path } = await window.pit.capture.saveBlob({
        bytes: new Uint8Array(buf),
        ext: 'webm'
      })
      const ts = new Date()
      const stamp =
        `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}` +
        `-${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
      importVideo(path, `screen-recording-${stamp}.webm`, currentCropRect)
      toast.push('Recording saved, analyzing…')
      onClose()
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  const handleCancel = async (): Promise<void> => {
    // From recording phase, cancel both the chrome and the stream, no save.
    if (phase.kind === 'recording') {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop()
        } catch {
          // best-effort
        }
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      await window.pit.rec.stopChrome()
    }
    onClose()
  }

  // ── render ────────────────────────────────────────────────────────────

  const filteredSources =
    phase.kind === 'picker'
      ? phase.sources.filter((s) => (mode === 'screen' ? s.kind === 'screen' : s.kind === 'window'))
      : []

  return (
    <div
      className="detail-overlay"
      onClick={phase.kind === 'picker' || phase.kind === 'error' ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        style={
          phase.kind === 'picker'
            ? { width: 'min(960px, 92vw)', maxWidth: 'unset' }
            : undefined
        }
      >
        {phase.kind === 'picker' && (
          <>
            <h3>Record screen</h3>
            <div className="sub">
              Pick what to capture. The recording becomes a new video item with
              AI-analyzed keyframes.
            </div>

            <div className="rec-mode-tabs">
              {(['screen', 'window', 'region'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`rec-mode-tab${mode === m ? ' active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'screen' ? 'Whole screen' : m === 'window' ? 'A window' : 'Region'}
                </button>
              ))}
            </div>

            <label className="rec-audio-row">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => setAudioEnabled(e.target.checked)}
              />
              <span>Record microphone audio</span>
              <span className="muted" style={{ fontSize: 11 }}>
                (off by default — most design captures don't need sound)
              </span>
            </label>

            {phase.error && (
              <div
                style={{
                  padding: 12,
                  marginTop: 12,
                  background: 'color-mix(in oklab, #ff453a 10%, var(--bg-card))',
                  borderLeft: '3px solid #ff453a',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--ink-2)'
                }}
              >
                {phase.error}
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
                  On macOS, pit needs Screen Recording permission — System Settings
                  → Privacy & Security → Screen Recording → enable pit, then
                  restart.
                </div>
              </div>
            )}

            {mode === 'region' ? (
              <div className="rec-region-cta">
                <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                  Drag to draw a rectangle on your screen. The capture happens at
                  full resolution; pit crops to the rect during keyframe extraction.
                </div>
                <Button variant="primary" onClick={startRegion}>
                  <I.Layers size={13} /> Pick region…
                </Button>
              </div>
            ) : phase.loading ? (
              <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
                Loading sources…
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>
                No {mode === 'screen' ? 'displays' : 'windows'} found.
              </div>
            ) : (
              <div
                style={{
                  marginTop: 14,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 10,
                  maxHeight: 480,
                  overflowY: 'auto',
                  padding: 4
                }}
              >
                {filteredSources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => startScreenOrWindow(s)}
                    className="rec-source-card"
                  >
                    <img
                      src={s.thumbnail}
                      alt={s.name}
                      style={{
                        width: '100%',
                        aspectRatio: 16 / 10,
                        objectFit: 'cover',
                        background: 'var(--bg-soft)',
                        borderRadius: 4
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span
                        className="muted mono"
                        style={{ fontSize: 10, textTransform: 'uppercase' }}
                      >
                        {s.kind}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={s.name}
                      >
                        {s.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}

        {phase.kind === 'recording' && (
          <>
            <h3>
              <span className="rec-dot" /> Recording
            </h3>
            <div className="sub">Capturing "{phase.sourceLabel}"</div>
            <div className="rec-modal-timer">{formatTime(computeElapsed(phase))}</div>
            <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
              Use the floating control on your desktop to pause or stop.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button variant="primary" onClick={stopRecording}>
                <I.Check size={13} /> Stop & analyze
              </Button>
            </div>
          </>
        )}

        {phase.kind === 'saving' && (
          <div style={{ padding: 28, textAlign: 'center' }} className="muted">
            <I.Sparkles size={16} />
            <div style={{ marginTop: 8 }}>Saving recording…</div>
          </div>
        )}

        {phase.kind === 'error' && (
          <>
            <h3>Couldn't start recording</h3>
            <div
              style={{
                padding: 12,
                marginTop: 8,
                background: 'color-mix(in oklab, #ff453a 10%, var(--bg-card))',
                borderLeft: '3px solid #ff453a',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--ink-2)'
              }}
            >
              {phase.message}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function computeElapsed(
  p: Extract<Phase, { kind: 'recording' }>
): number {
  const now = Date.now()
  const livePause = p.pauseStartedAt ? now - p.pauseStartedAt : 0
  return now - p.startedAt - p.pausedAccumMs - livePause
}

function formatTime(ms: number): string {
  const sec = Math.floor(Math.max(0, ms) / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
