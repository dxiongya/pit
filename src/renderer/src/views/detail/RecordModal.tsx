// RecordModal.tsx — built-in screen recorder.
//
// Flow:
//   1. picker — `desktopCapturer.getSources()` returns screens + windows;
//      user picks one (thumbnail grid).
//   2. recording — getUserMedia with chromeMediaSource: 'desktop' captures the
//      chosen surface; MediaRecorder collects webm chunks. A live timer shows
//      elapsed seconds.
//   3. save — Stop finalises the blob, writes it to a tmp path via main, and
//      hands the path to store.importVideo so the existing keyframe-extract +
//      AI-analysis pipeline runs as if the user had dragged in an .mp4.
//
// Cancel at any stage tears the stream down without saving anything.

import { useEffect, useRef, useState } from 'react'
import { I } from '../../lib/icons'
import { Button } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { useStore } from '../../lib/store'

type Source = { id: string; name: string; thumbnail: string; kind: 'screen' | 'window' }
type Phase =
  | { kind: 'picker'; sources: Source[]; loading: boolean; error?: string }
  | { kind: 'recording'; source: Source; startedAt: number }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

export function RecordModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  const toast = useToast()
  const { importVideo } = useStore()
  const [phase, setPhase] = useState<Phase>({ kind: 'picker', sources: [], loading: true })
  const [elapsed, setElapsed] = useState(0)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Load sources on mount.
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

  // Live recording timer.
  useEffect(() => {
    if (phase.kind !== 'recording') {
      setElapsed(0)
      return
    }
    const startedAt = phase.startedAt
    setElapsed(0)
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250)
    return () => clearInterval(id)
  }, [phase])

  // Always release the OS capture stream when the modal unmounts — even if
  // the user closes mid-recording, otherwise the indicator stays on.
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
    }
  }, [])

  // Esc: cancel from any phase (except mid-save, which finishes the IPC write).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && phase.kind !== 'saving') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, phase])

  const startRecording = async (source: Source): Promise<void> => {
    try {
      // Chromium-only constraint shape — Electron exposes it directly. The
      // mandatory: chromeMediaSource:'desktop' branch hits desktopCapturer.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-expect-error — Electron-only constraints not in lib.dom
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            // Cap to a sensible size so files don't balloon. ffmpeg downscales
            // again at keyframe extraction.
            maxWidth: 1920,
            maxHeight: 1200,
            maxFrameRate: 30
          }
        }
      })
      mediaStreamRef.current = stream

      // Pick the best supported codec. WebM/VP9 is widely supported; fall
      // back to VP8 if not, then to default.
      const candidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ]
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e): void => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      // 1s chunks so we have steady writes — also makes stop() deterministic.
      recorder.start(1000)
      setPhase({ kind: 'recording', source, startedAt: Date.now() })
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  const stopRecording = async (): Promise<void> => {
    const rec = recorderRef.current
    if (!rec) return
    setPhase({ kind: 'saving' })
    // Wait for the final dataavailable + stop event before reading chunks.
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
      importVideo(path, `screen-recording-${stamp}.webm`)
      toast.push('Recording saved, analyzing…')
      onClose()
    } catch (e) {
      setPhase({ kind: 'error', message: (e as Error).message })
    }
  }

  return (
    <div
      className="detail-overlay"
      onClick={phase.kind === 'picker' || phase.kind === 'error' ? onClose : undefined}
      style={{ alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="share-modal"
        onClick={(e) => e.stopPropagation()}
        // .share-modal is 440px by default — wide enough for the recording /
        // saving / error phases but cramped for the source picker's grid.
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
              Pick a screen or window to capture. The recording becomes a new video
              item with AI-analyzed keyframes.
            </div>

            {phase.loading && (
              <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
                Loading sources…
              </div>
            )}

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
                  → Privacy & Security → Screen Recording → enable pit, then restart.
                </div>
              </div>
            )}

            {!phase.loading && phase.sources.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  display: 'grid',
                  // auto-fill keeps thumbs ~200px wide regardless of how big
                  // the modal ends up (responsive across resized windows).
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 10,
                  maxHeight: 540,
                  overflowY: 'auto',
                  padding: 4
                }}
              >
                {phase.sources.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => startRecording(s)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      gap: 6,
                      padding: 8,
                      background: 'var(--bg-soft)',
                      border: '1px solid var(--hair)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--f-ui)',
                      color: 'var(--ink)',
                      transition: 'border-color 0.12s, transform 0.08s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--hair)'
                      e.currentTarget.style.transform = 'none'
                    }}
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
            <div className="sub">Capturing "{phase.source.name}"</div>
            <div
              style={{
                margin: '20px 0',
                padding: '20px',
                background: 'var(--bg-soft)',
                borderRadius: 10,
                textAlign: 'center',
                fontFamily: 'var(--f-mono)',
                fontSize: 32,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--ink)'
              }}
            >
              {formatTime(elapsed)}
            </div>
            <div className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
              Long recordings produce bigger files. Aim for short clips (5–30s) —
              keyframes capture the gist either way.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <Button size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={stopRecording}>
                <I.Check size={13} /> Stop & save
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

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
