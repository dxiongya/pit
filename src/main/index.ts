import { app, shell, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { readSettings, writeSettings } from './settings'
import {
  testProvider,
  routeItem,
  analyzeImage,
  analyzeSite,
  analyzeVideo,
  suggestCollectionDescription,
  type RoleRequest
} from './ai'
import { captureSite } from './capture'
import {
  listItems,
  upsertItem,
  deleteItem,
  listCollections,
  upsertCollection,
  deleteCollection
} from './db'
import { startImageDrag } from './drag'
import {
  createShare,
  type ShareCreateInput,
  fetchShare,
  authenticateShare,
  fetchAssetAsDataUrl
} from './share'
import { extractKeyframes, type ExtractResult } from './video'
import {
  buildPaletteVariations,
  namePaletteVariations,
  deriveOne,
  type DerivedOne
} from './derive'
import {
  startRecorderChrome,
  stopRecorderChrome,
  pickRegion,
  relayControl,
  pushFloatState,
  openToolbar,
  closeToolbar,
  resizeToolbar,
  findMainWindow
} from './recorder-windows'

function createWindow(): void {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 832,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    // Frameless on mac with inset traffic lights so the sidebar drag region
    // matches the Bottomless / pit window aesthetic.
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 14, y: 18 } : undefined,
    backgroundColor: '#ececef',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * IPC surface for pit.
 *
 * Wired today:
 *  - pit:get-settings / pit:set-settings  → durable JSON in userData.
 *
 * Reserved seams (not yet registered, so the renderer falls back to mock data):
 *  - pit:capture-site   → render + screenshot each page (Playwright / offscreen window)
 *  - pit:analyze-site   → screenshots → DESIGN.md via the `design` role provider
 *  - pit:analyze-image  → image → design-content extraction
 * Register these here and expose them in preload to swap mock → real with no UI change.
 */
function registerIpc(): void {
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('pit:get-settings', () => readSettings())
  ipcMain.handle('pit:set-settings', (_e, data) => writeSettings(data))
  ipcMain.handle('pit:test-connection', (_e, req) => testProvider(req))
  ipcMain.handle('pit:route', (_e, input) => routeItem(input))
  ipcMain.handle(
    'pit:suggest-collection-description',
    (_e, input: { req: RoleRequest; name: string; hint?: string }) =>
      suggestCollectionDescription(input)
  )
  ipcMain.handle('pit:analyze-image', (_e, input) => analyzeImage(input))
  ipcMain.handle(
    'pit:analyze-image-stream',
    (e, input: { id: string; dataUrl: string; req: RoleRequest }) =>
      analyzeImage({ req: input.req, dataUrl: input.dataUrl }, (c) =>
        e.sender.send(`pit:stream:${input.id}`, c)
      )
  )
  // Feature 1 — website capture (streams each page back as it finishes) + analysis.
  ipcMain.handle('pit:capture-site', (e, input: { id: string; url: string }) =>
    captureSite(input.url, (p) => e.sender.send(`pit:capture:${input.id}`, p))
  )
  ipcMain.handle(
    'pit:analyze-site-stream',
    (e, input: { id: string; pages: { name: string; slices: string[] }[]; req: RoleRequest }) =>
      analyzeSite({ req: input.req, pages: input.pages }, (c) =>
        e.sender.send(`pit:stream:${input.id}`, c)
      )
  )

  // Persistence (SQLite at userData/pit.db) — items + collections CRUD.
  ipcMain.handle('pit:items:list', () => listItems())
  ipcMain.handle('pit:items:upsert', (_e, item: { id: string }) => upsertItem(item))
  ipcMain.handle('pit:items:delete', (_e, id: string) => deleteItem(id))
  ipcMain.handle('pit:collections:list', () => listCollections())
  ipcMain.handle('pit:collections:upsert', (_e, c: { id: string }) => upsertCollection(c))
  ipcMain.handle('pit:collections:delete', (_e, id: string) => deleteCollection(id))

  // Drag-out — startDrag must run inside the user gesture, so we use send (not
  // invoke) and fire-and-forget. Renderer prevents the default HTML drag and
  // hands us the image data URLs.
  ipcMain.on('pit:drag-images', (e, payload: { dataUrls: string[]; name?: string }) => {
    void startImageDrag(e.sender, payload.dataUrls, payload.name)
  })

  // pit.ink share — POST to the share API, returns { code, url, hasPassword, expiresAt }.
  ipcMain.handle('pit:share:create', (_e, input: ShareCreateInput) => createShare(input))

  // Derive — palette code-shift + AI naming. Pure code for the colors,
  // single AI call for the labels. Returns labelled variations the renderer
  // then turns into codegen jobs.
  ipcMain.handle(
    'pit:derive:propose-palettes',
    async (
      _e,
      input: {
        req: RoleRequest
        palette: { hex: string; role?: string; pct?: number }[]
        count?: number
      }
    ) => {
      const variations = buildPaletteVariations(input.palette, input.count ?? 3)
      return namePaletteVariations(input.req, variations)
    }
  )
  // Single derivative generation + capture (color or content). Renderer
  // calls this once per variant so it can stream cards into the grid as
  // they complete.
  ipcMain.handle(
    'pit:derive:run',
    (
      _e,
      input: {
        req: RoleRequest
        replicaPrompt: string
        designTokens?: {
          theme?: string
          fonts?: { name?: string; weight?: string; size?: string; role?: string }[]
          layoutNote?: string
        }
        palette?: { hex: string; role?: string; pct?: number }[]
        contentPrompt?: string
      }
    ): Promise<DerivedOne> => deriveOne(input)
  )

  // Inbound deep-link helpers — called by the renderer's ReceiveShareModal.
  ipcMain.handle('pit:share:fetch', (_e, code: string) => fetchShare(code))
  ipcMain.handle(
    'pit:share:authenticate',
    (_e, input: { code: string; password: string }) =>
      authenticateShare(input.code, input.password)
  )
  ipcMain.handle(
    'pit:share:fetch-asset',
    (_e, input: { code: string; asset: string }) =>
      fetchAssetAsDataUrl(input.code, input.asset)
  )

  // Screen recording — list capture sources (screens + windows) so the
  // renderer's RecordModal picker can show them with thumbnails.
  ipcMain.handle(
    'pit:capture:list-sources',
    async (): Promise<{ id: string; name: string; thumbnail: string; kind: 'screen' | 'window' }[]> => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 200 }
      })
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
        kind: s.id.startsWith('screen:') ? 'screen' : 'window'
      }))
    }
  )

  // Recorder chrome — orchestrates the bottom picker toolbar, the floating
  // control widget, the border overlay, and main-window minimize/restore.
  // MediaRecorder lives in the (minimized) main pit window's RecordingSession.

  // Entry point — pit TopBar Record click. Minimizes main, opens toolbar.
  ipcMain.handle('pit:rec:open-toolbar', () => openToolbar())
  // Toolbar tells main pit window to begin the recording session.
  ipcMain.on(
    'pit:rec:begin',
    (_e, opts: {
      mode: 'screen' | 'window' | 'region'
      sourceId?: string
      audio: boolean
      cropRect?: { x: number; y: number; w: number; h: number }
      sourceLabel?: string
    }) => {
      // CRITICAL — fire pit:rec:begin BEFORE spawning the float/border so
      // findMainWindow() can't accidentally pick an accessory window. Then
      // start the chrome (which spawns float + border).
      const main = findMainWindow()
      if (main) main.webContents.send('pit:rec:begin', opts)
      closeToolbar()
      startRecorderChrome({
        mode: opts.mode,
        // For region mode, pass the picked rect through so the persistent
        // border window can be sized exactly to it.
        regionRect: opts.mode === 'region' ? opts.cropRect : undefined
      })
    }
  )
  // Toolbar cancel — closes toolbar; restore happens in toolbar 'closed' hook.
  ipcMain.on('pit:rec:cancel-toolbar', () => closeToolbar())
  // Toolbar grows vertically when the window-picker popover opens, shrinks
  // back to the pill height when it closes.
  ipcMain.on('pit:rec:toolbar-resize', (_e, h: number) => resizeToolbar(h))

  ipcMain.handle(
    'pit:rec:start-chrome',
    (_e, opts: { mode: 'screen' | 'window' | 'region'; displayId?: number }) => {
      startRecorderChrome(opts)
    }
  )
  ipcMain.handle('pit:rec:stop-chrome', () => stopRecorderChrome())
  // Region picker — resolves with the user's drawn rect, or null on Esc.
  ipcMain.handle('pit:rec:pick-region', () => pickRegion())
  // Float widget → main: control commands relayed through main process.
  ipcMain.on('pit:rec:control', (_e, cmd: 'pause' | 'resume' | 'stop') => relayControl(cmd))
  // Main window → main: push live state to float widget.
  ipcMain.on('pit:rec:push-state', (_e, state: { elapsedMs: number; paused: boolean }) =>
    pushFloatState(state)
  )

  // Save a recorded video blob (webm bytes from MediaRecorder) to a tmp file
  // and return the path — main reuses extractKeyframes(path) afterwards.
  ipcMain.handle(
    'pit:capture:save-blob',
    (_e, input: { bytes: Uint8Array; ext?: string }): { path: string; sizeBytes: number } => {
      const dir = mkdtempSync(join(tmpdir(), 'pit-rec-'))
      const path = join(dir, `recording.${input.ext || 'webm'}`)
      writeFileSync(path, Buffer.from(input.bytes))
      return { path, sizeBytes: input.bytes.byteLength }
    }
  )

  // Video import — extract keyframes from a local file path (preferred) or
  // a Buffer (for clipboard / screen-recording blobs). The original file is
  // never persisted; only the deduped keyframes survive.
  ipcMain.handle(
    'pit:video:extract',
    (
      _e,
      input: {
        path?: string
        buffer?: Uint8Array
        target?: number
        cropRect?: { x: number; y: number; w: number; h: number }
      }
    ): Promise<ExtractResult> => {
      const source = input.path ?? Buffer.from(input.buffer ?? new Uint8Array())
      return extractKeyframes(source, input.target ?? 8, input.cropRect)
    }
  )

  // Video analysis — STYLE batch + per-frame MOTION quick pass, streamed.
  ipcMain.handle(
    'pit:analyze-video-stream',
    (
      e,
      input: {
        id: string
        frames: string[]
        req: RoleRequest
        durationSec?: number
        title?: string
      }
    ) =>
      analyzeVideo(
        {
          req: input.req,
          frames: input.frames,
          durationSec: input.durationSec,
          title: input.title
        },
        (c) => e.sender.send(`pit:stream:${input.id}`, c)
      )
  )

  // Dev-only: simulate the OS deep-link delivery. macOS Launch Services routes
  // pit:// to a generic Electron in dev mode (not our instance), so we can't
  // easily fire the real flow without a production build install.
  if (is.dev) {
    ipcMain.handle('pit:debug:fake-deep-link', (_e, code: string) => {
      if (typeof code === 'string' && extractShareCode(`pit://share/${code}`)) {
        dispatchSharedCode(code)
        return { ok: true }
      }
      return { ok: false, error: 'bad_code' }
    })
  }
}

// ─── pit:// protocol handler ────────────────────────────────────────────

const SHARE_URL_RE = /^pit:\/\/share\/([a-z0-9]{4,16})\/?$/i

function extractShareCode(url: string | undefined | null): string | null {
  if (!url) return null
  const m = url.match(SHARE_URL_RE)
  return m ? m[1].toLowerCase() : null
}

// Cold-start deep link (Windows/Linux: pit.exe pit://share/abc → argv).
// macOS cold start fires via app.on('open-url') AFTER whenReady, so it's
// captured by the regular handler.
let pendingShareCode: string | null = null
for (const arg of process.argv) {
  const code = extractShareCode(arg)
  if (code) {
    pendingShareCode = code
    break
  }
}

function dispatchSharedCode(code: string): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) {
    // Window not created yet — queue and let the post-load hook drain it.
    pendingShareCode = code
    return
  }
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send('pit:share:received', { code })
}

function registerProtocolHandler(): void {
  // In dev (electron .), defaultApp is true and process.argv[1] is the entry
  // script — passing it makes the OS re-launch the SAME dev session for deep
  // links instead of a fresh production install.
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('pit', process.execPath, [resolve(process.argv[1])])
    } else {
      app.setAsDefaultProtocolClient('pit')
    }
  } else {
    app.setAsDefaultProtocolClient('pit')
  }
}

// Single-instance lock — focus the existing window instead of opening a second.
// Windows/Linux: a second `pit pit://share/xyz` invocation fires this with the
// URL in argv; we extract it and feed the existing instance.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    for (const arg of argv) {
      const code = extractShareCode(arg)
      if (code) {
        dispatchSharedCode(code)
        break
      }
    }
  })
}

// macOS deep links arrive via Apple Events as `open-url`. preventDefault is
// required for Electron to skip its default "open new instance" handling.
app.on('open-url', (e, url) => {
  e.preventDefault()
  const code = extractShareCode(url)
  if (code) dispatchSharedCode(code)
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pit.app')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  registerProtocolHandler()
  registerIpc()
  createWindow()

  // Drain any deep-link code captured at cold start (argv) or before the
  // first window existed (macOS open-url firing during whenReady).
  const win = BrowserWindow.getAllWindows()[0]
  if (win && pendingShareCode) {
    win.webContents.once('did-finish-load', () => {
      if (pendingShareCode) {
        win.webContents.send('pit:share:received', { code: pendingShareCode })
        pendingShareCode = null
      }
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
