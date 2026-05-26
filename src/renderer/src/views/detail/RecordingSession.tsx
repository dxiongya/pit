// RecordingSession — headless component that owns the MediaRecorder lifecycle
// for a recording session. Mounted once in App; it listens for the
// `pit:rec:begin` IPC dispatched by the toolbar window (via the main process)
// and runs the entire capture → save → importVideo flow.
//
// Lives in the main pit window's renderer because:
//   1. macOS Screen Recording permission is per-app — any renderer in the
//      app can use it, but keeping it here means we don't have to re-prompt.
//   2. The minimized main pit window's renderer keeps running (Electron
//      doesn't throttle hidden BrowserWindows the way Chrome throttles tabs),
//      so MediaRecorder keeps capturing while the user interacts only with
//      the float widget.
//   3. importVideo lives on this renderer's store; no cross-window state.

import { useEffect, useRef } from 'react'
import { useStore } from '../../lib/store'
import { useToast } from '../../components/Toast'

export function RecordingSession(): React.JSX.Element | null {
  const toast = useToast()
  const { importVideo } = useStore()

  // Refs so the IPC listeners can reach the current values without re-binding.
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const pausedAccumRef = useRef<number>(0)
  const pauseStartedRef = useRef<number | null>(null)
  const cropRectRef = useRef<{ x: number; y: number; w: number; h: number } | undefined>(undefined)
  const stateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const labelRef = useRef<string>('Recording')

  // Begin a session — fired by the toolbar window via the main process.
  useEffect(() => {
    return window.pit.rec.onBegin(async (opts) => {
      if (!opts.sourceId) return
      cropRectRef.current = opts.cropRect
      labelRef.current = opts.sourceLabel || 'Recording'
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: opts.audio,
          video: {
            // @ts-expect-error — Electron-only constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: opts.sourceId,
              maxWidth: 3840,
              maxHeight: 2400,
              maxFrameRate: 30
            }
          }
        })
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
        startedAtRef.current = Date.now()
        pausedAccumRef.current = 0
        pauseStartedRef.current = null

        // Push live timer state to the float widget every 250ms.
        stateIntervalRef.current = setInterval(() => {
          const elapsed = computeElapsed()
          window.pit.rec.pushState({
            elapsedMs: elapsed,
            paused: pauseStartedRef.current != null
          })
        }, 250)
      } catch (e) {
        toast.push(`Recording failed: ${(e as Error).message}`)
        await window.pit.rec.stopChrome()
      }
    })
  }, [toast])

  // Pause / Resume / Stop commands from the float widget.
  useEffect(() => {
    return window.pit.rec.onCommand((cmd) => {
      const rec = recorderRef.current
      if (!rec) return
      if (cmd === 'pause' && rec.state === 'recording') {
        rec.pause()
        pauseStartedRef.current = Date.now()
      } else if (cmd === 'resume' && rec.state === 'paused') {
        rec.resume()
        if (pauseStartedRef.current) {
          pausedAccumRef.current += Date.now() - pauseStartedRef.current
          pauseStartedRef.current = null
        }
      } else if (cmd === 'stop') {
        void finalize()
      }
    })
  }, [importVideo, toast])

  const finalize = async (): Promise<void> => {
    const rec = recorderRef.current
    if (!rec) return
    if (stateIntervalRef.current) {
      clearInterval(stateIntervalRef.current)
      stateIntervalRef.current = null
    }
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
    recorderRef.current = null

    // Tear down float + border, restore main window, then save.
    await window.pit.rec.stopChrome()

    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    chunksRef.current = []
    if (blob.size === 0) {
      toast.push('Recording was empty — nothing was captured.')
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
      importVideo(path, `screen-recording-${stamp}.webm`, cropRectRef.current)
      cropRectRef.current = undefined
      toast.push('Recording saved, analyzing…')
    } catch (e) {
      toast.push(`Save failed: ${(e as Error).message}`)
    }
  }

  // Final cleanup on unmount — release the OS stream so macOS doesn't keep
  // the menu-bar recording indicator lit.
  useEffect(() => {
    return (): void => {
      if (stateIntervalRef.current) clearInterval(stateIntervalRef.current)
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          // best-effort
        }
      }
      void window.pit.rec.stopChrome()
    }
  }, [])

  function computeElapsed(): number {
    const now = Date.now()
    const livePause = pauseStartedRef.current ? now - pauseStartedRef.current : 0
    return now - startedAtRef.current - pausedAccumRef.current - livePause
  }

  return null
}
