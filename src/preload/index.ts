import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// pit bridge exposed to the renderer as `window.pit`.
// Today: durable settings + real connection test. The capture/analyze methods
// are intentionally omitted until the main process implements them — the
// renderer's provider layer detects their absence and falls back to mock.
interface RoleRequest {
  kind: 'anthropic' | 'openai' | 'google' | 'openai-compatible'
  name?: string
  model: string
  apiKey: string
  baseURL?: string
}

interface RouteInput {
  req: RoleRequest
  item: { title?: string; description?: string; tags?: string[] }
  collections: { id: string; name: string; prompt?: string; tags?: string[]; skip?: string[] }[]
  threshold: number
}
interface RoutingResult {
  suggestions: { collectionId: string; confidence: number; reason: string }[]
  best: string
}
interface CapturedPage {
  name: string
  url: string
  screenshot?: string
  slices?: string[]
  error?: string
}

const pit = {
  getSettings: (): Promise<Record<string, unknown> | null> =>
    ipcRenderer.invoke('pit:get-settings'),
  setSettings: (data: unknown): Promise<void> => ipcRenderer.invoke('pit:set-settings', data),
  testConnection: (req: RoleRequest): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('pit:test-connection', req),
  // Persistence — items + collections live in SQLite (userData/pit.db).
  items: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('pit:items:list'),
    upsert: (item: { id: string }): Promise<void> => ipcRenderer.invoke('pit:items:upsert', item),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('pit:items:delete', id)
  },
  collections: {
    list: (): Promise<unknown[]> => ipcRenderer.invoke('pit:collections:list'),
    upsert: (c: { id: string }): Promise<void> => ipcRenderer.invoke('pit:collections:upsert', c),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('pit:collections:delete', id)
  },
  route: (input: RouteInput): Promise<RoutingResult> => ipcRenderer.invoke('pit:route', input),
  suggestCollectionDescription: (input: {
    req: RoleRequest
    name: string
    hint?: string
  }): Promise<string> => ipcRenderer.invoke('pit:suggest-collection-description', input),
  // Fire an OS-level drag with one or more image data URLs as the payload.
  // Uses send (not invoke) so the call stays inside the user gesture — required
  // by webContents.startDrag.
  dragImages: (dataUrls: string[], name?: string): void =>
    ipcRenderer.send('pit:drag-images', { dataUrls, name }),
  // pit.ink share — uploads blobs to R2 + writes manifest to D1, returns share URL.
  share: {
    create: (input: {
      kind: 'item' | 'collection'
      item?: unknown
      collection?: unknown
      items?: unknown[]
      password?: string
      expiresInDays?: number
    }): Promise<{ code: string; url: string; hasPassword: boolean; expiresAt: number | null }> =>
      ipcRenderer.invoke('pit:share:create', input),
    // Inbound — driven by pit:// deep links delivered to the main process.
    fetch: (
      code: string
    ): Promise<
      | { status: 'ready'; payload: unknown }
      | { status: 'needs-password' }
      | { status: 'expired' }
      | { status: 'not-found' }
      | { status: 'error'; message: string }
    > => ipcRenderer.invoke('pit:share:fetch', code),
    authenticate: (
      code: string,
      password: string
    ): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> =>
      ipcRenderer.invoke('pit:share:authenticate', { code, password }),
    fetchAsset: (code: string, asset: string): Promise<string | null> =>
      ipcRenderer.invoke('pit:share:fetch-asset', { code, asset }),
    onReceived: (cb: (payload: { code: string }) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, p: { code: string }): void => cb(p)
      ipcRenderer.on('pit:share:received', listener)
      return () => ipcRenderer.removeListener('pit:share:received', listener)
    }
  },
  // Video — extract keyframes (8 by default) from a local path. The dedup
  // happens in main so we don't waste IPC bandwidth on duplicate frames.
  video: {
    extract: (input: {
      path?: string
      buffer?: Uint8Array
      target?: number
      cropRect?: { x: number; y: number; w: number; h: number }
    }): Promise<{
      frames: string[]
      durationSec: number
      candidateCount: number
      uniqueCount: number
    }> => ipcRenderer.invoke('pit:video:extract', input)
  },
  // Screen capture — list sources (screens + windows) + persist a recorded
  // blob to a tmp path so the existing video.extract pipeline can consume it.
  capture: {
    listSources: (): Promise<
      { id: string; name: string; thumbnail: string; kind: 'screen' | 'window' }[]
    > => ipcRenderer.invoke('pit:capture:list-sources'),
    saveBlob: (input: { bytes: Uint8Array; ext?: string }): Promise<{ path: string; sizeBytes: number }> =>
      ipcRenderer.invoke('pit:capture:save-blob', input)
  },
  // Recorder chrome — float widget + border overlay + region picker. Used by
  // RecordModal in the main window and by the small accessory windows loaded
  // with #/recorder-* hash routes.
  rec: {
    // Entry — pit TopBar Record button. Minimizes pit and opens the bottom
    // toolbar in its own BrowserWindow (#/recorder-toolbar).
    openToolbar: (): Promise<void> => ipcRenderer.invoke('pit:rec:open-toolbar'),
    // Toolbar → main → main-pit-window: begin the actual recording. Closes
    // toolbar, spawns float widget + border.
    begin: (opts: {
      mode: 'screen' | 'window' | 'region'
      sourceId?: string
      audio: boolean
      cropRect?: { x: number; y: number; w: number; h: number }
      sourceLabel?: string
    }): void => ipcRenderer.send('pit:rec:begin', opts),
    // Toolbar cancel without recording.
    cancelToolbar: (): void => ipcRenderer.send('pit:rec:cancel-toolbar'),
    // Toolbar window grows/shrinks vertically when the window-picker opens.
    toolbarResize: (h: number): void => ipcRenderer.send('pit:rec:toolbar-resize', h),
    // Subscribe (main pit window) to the begin signal.
    onBegin: (
      cb: (opts: {
        mode: 'screen' | 'window' | 'region'
        sourceId?: string
        audio: boolean
        cropRect?: { x: number; y: number; w: number; h: number }
        sourceLabel?: string
      }) => void
    ): (() => void) => {
      const listener = (
        _e: IpcRendererEvent,
        p: {
          mode: 'screen' | 'window' | 'region'
          sourceId?: string
          audio: boolean
          cropRect?: { x: number; y: number; w: number; h: number }
          sourceLabel?: string
        }
      ): void => cb(p)
      ipcRenderer.on('pit:rec:begin', listener)
      return () => ipcRenderer.removeListener('pit:rec:begin', listener)
    },
    startChrome: (opts: { mode: 'screen' | 'window' | 'region'; displayId?: number }): Promise<void> =>
      ipcRenderer.invoke('pit:rec:start-chrome', opts),
    stopChrome: (): Promise<void> => ipcRenderer.invoke('pit:rec:stop-chrome'),
    pickRegion: (): Promise<
      { x: number; y: number; w: number; h: number; displayId: number } | null
    > => ipcRenderer.invoke('pit:rec:pick-region'),
    // Float widget sends a control command (pause/resume/stop) to be relayed
    // back to the main window's MediaRecorder. Send (not invoke) — fire-and-forget.
    sendControl: (cmd: 'pause' | 'resume' | 'stop'): void =>
      ipcRenderer.send('pit:rec:control', cmd),
    // Main window pushes live state (elapsed + paused) to the float widget.
    pushState: (state: { elapsedMs: number; paused: boolean }): void =>
      ipcRenderer.send('pit:rec:push-state', state),
    // Subscribe to control commands relayed from the float widget into the
    // main window (RecordModal listens).
    onCommand: (cb: (cmd: 'pause' | 'resume' | 'stop') => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, c: 'pause' | 'resume' | 'stop'): void => cb(c)
      ipcRenderer.on('pit:rec:command', listener)
      return () => ipcRenderer.removeListener('pit:rec:command', listener)
    },
    // Subscribe to state pushes (float widget listens).
    onState: (cb: (state: { elapsedMs: number; paused: boolean }) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, s: { elapsedMs: number; paused: boolean }): void =>
        cb(s)
      ipcRenderer.on('pit:rec:state', listener)
      return () => ipcRenderer.removeListener('pit:rec:state', listener)
    },
    // Region picker sends its result back to main via send().
    sendRegionResult: (rect: { x: number; y: number; w: number; h: number } | null): void =>
      ipcRenderer.send('pit:rec:region-result', rect)
  },
  // Get the absolute filesystem path of a File from a drag/drop or paste —
  // Electron-only, replaces the deprecated `file.path` property.
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  analyzeImage: (dataUrl: string, req: RoleRequest): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('pit:analyze-image', { dataUrl, req }),
  analyzeImageStream: (
    dataUrl: string,
    req: RoleRequest,
    onChunk: (chunk: string) => void
  ): Promise<Record<string, unknown>> => {
    const id = Math.random().toString(36).slice(2)
    const channel = `pit:stream:${id}`
    const listener = (_e: IpcRendererEvent, chunk: string): void => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    return ipcRenderer
      .invoke('pit:analyze-image-stream', { id, dataUrl, req })
      .finally(() => ipcRenderer.removeListener(channel, listener))
  },
  // Feature 1 — capture a site (each page streamed via onPage) then analyze the shots.
  captureSite: (url: string, onPage: (page: CapturedPage) => void): Promise<CapturedPage[]> => {
    const id = Math.random().toString(36).slice(2)
    const channel = `pit:capture:${id}`
    const listener = (_e: IpcRendererEvent, page: CapturedPage): void => onPage(page)
    ipcRenderer.on(channel, listener)
    return ipcRenderer
      .invoke('pit:capture-site', { id, url })
      .finally(() => ipcRenderer.removeListener(channel, listener))
  },
  analyzeSite: (
    pages: { name: string; slices: string[] }[],
    req: RoleRequest,
    onChunk: (chunk: string) => void
  ): Promise<Record<string, unknown>> => {
    const id = Math.random().toString(36).slice(2)
    const channel = `pit:stream:${id}`
    const listener = (_e: IpcRendererEvent, chunk: string): void => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    return ipcRenderer
      .invoke('pit:analyze-site-stream', { id, pages, req })
      .finally(() => ipcRenderer.removeListener(channel, listener))
  },
  // Video analysis — STYLE batch over all frames + parallel MOTION captions per
  // frame. Same streaming pattern as analyzeSite.
  analyzeVideo: (
    frames: string[],
    req: RoleRequest,
    onChunk: (chunk: string) => void,
    meta?: { durationSec?: number; title?: string }
  ): Promise<Record<string, unknown>> => {
    const id = Math.random().toString(36).slice(2)
    const channel = `pit:stream:${id}`
    const listener = (_e: IpcRendererEvent, chunk: string): void => onChunk(chunk)
    ipcRenderer.on(channel, listener)
    return ipcRenderer
      .invoke('pit:analyze-video-stream', {
        id,
        frames,
        req,
        durationSec: meta?.durationSec,
        title: meta?.title
      })
      .finally(() => ipcRenderer.removeListener(channel, listener))
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('pit', pit)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.pit = pit
}

export type PitApi = typeof pit
