import { app, shell, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, mkdtempSync, statSync } from 'fs'
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
import { installMcp, uninstallMcp, testMcp, readMcpInstallStatus } from './mcp'
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
import { extractLink } from './link-handlers/registry'
import { downloadToDataUrl } from './link-handlers/util'
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
 * IPC surface for pit — all channels below are registered and live.
 *
 * Settings:  pit:get-settings / pit:set-settings  → durable JSON in userData.
 * Library:   pit:items:* / pit:collections:*       → SQLite (db.ts).
 * AI:        pit:test-connection, pit:route, pit:suggest-collection-description,
 *            pit:analyze-image(-stream), pit:capture-site, pit:analyze-site-stream,
 *            pit:analyze-video(-stream)             → real provider calls (ai.ts).
 * Pipelines: pit:derive:*, pit:share:*, pit:video:*, pit:capture:*, pit:rec:*,
 *            pit:link:*, pit:mcp:*.
 * Streaming responses are pushed back on a per-call channel pit:stream:<id> /
 * pit:capture:<id>. The renderer's provider layer only falls back to mock data
 * when a provider is unconfigured or a call errors — not as a steady state.
 */
function registerIpc(): void {
  ipcMain.handle('pit:get-settings', () => readSettings())
  ipcMain.handle('pit:set-settings', (_e, data) => writeSettings(data))

  // MCP server discovery + install/uninstall/test. Powers the whole Settings
  // → MCP card: build status, where the DB is, whether Claude Desktop already
  // knows about us, and a smoke-test the user can run *before* restarting
  // Claude Desktop. All filesystem effects are scoped to the Claude config
  // dir; the rest are pure reads.
  ipcMain.handle('pit:mcp:info', () => {
    const dbPath = join(app.getPath('userData'), 'pit.db')
    let dbExists = false
    let dbSizeBytes = 0
    try {
      const st = statSync(dbPath)
      dbExists = true
      dbSizeBytes = st.size
    } catch {
      // ignored
    }
    let serverPath: string | null = null
    let serverBuilt = false
    const candidates = [
      resolve(process.resourcesPath || '', 'app.asar.unpacked/infra/mcp-server/dist/server.js'),
      resolve(app.getAppPath(), 'infra/mcp-server/dist/server.js'),
      resolve(app.getAppPath(), '../infra/mcp-server/dist/server.js')
    ]
    for (const c of candidates) {
      try {
        if (statSync(c).isFile()) {
          serverPath = c
          serverBuilt = true
          break
        }
      } catch {
        // try next
      }
    }
    if (!serverPath) {
      serverPath = resolve(app.getAppPath(), '../infra/mcp-server')
    }
    const install = readMcpInstallStatus()
    return {
      dbPath,
      dbExists,
      dbSizeBytes,
      serverPath,
      serverBuilt,
      // Claude Desktop integration status
      configPath: install.configPath,
      configExists: install.configExists,
      installed: install.installed,
      registeredArg: install.registeredArg,
      otherServers: install.otherServers
    }
  })

  // Toggle ON — write the Claude Desktop config (creating dir/file if needed)
  // and return what changed so the UI can confirm "merged with N other
  // servers". Backup of any prior config is kept beside it.
  ipcMain.handle('pit:mcp:install', (_e, serverPath: string) => installMcp(serverPath))

  // Toggle OFF — remove only our entry, leave everything else.
  ipcMain.handle('pit:mcp:uninstall', () => uninstallMcp())

  // Run an actual JSON-RPC smoke test against the built server. The UI
  // shows a checklist (initialize / tools/list / search_items) — the user can
  // see green checks *before* having to restart Claude Desktop.
  ipcMain.handle('pit:mcp:test', (_e, serverPath: string) => testMcp(serverPath))
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

  // Link handlers — extract structured content (tweet / xhs / generic site)
  // from a URL. The renderer dispatches the result into the right import
  // pipeline based on the returned media counts.
  ipcMain.handle(
    'pit:link:extract',
    (e, input: { id?: string; url: string; integrations?: { xapi?: { apiKey: string } } }) =>
      extractLink(input.url, {
        integrations: input.integrations,
        // Relay handler progress back over the per-call channel (no-op if the
        // renderer didn't supply an onProgress / id).
        onProgress: input.id
          ? (msg) => e.sender.send(`pit:link:progress:${input.id}`, msg)
          : undefined
      })
  )
  // Save a remote media URL (video typically) to a tmp file and return its
  // local path — the renderer hands that path to importVideo for keyframe
  // extraction.
  ipcMain.handle(
    'pit:link:fetch-to-tmp',
    async (_e, input: { url: string; ext?: string }): Promise<{ path: string }> => {
      const dataUrl = await downloadToDataUrl(input.url)
      const base64 = dataUrl.split(',')[1] || ''
      const bytes = Buffer.from(base64, 'base64')
      const dir = mkdtempSync(join(tmpdir(), 'pit-media-'))
      const ext =
        input.ext ||
        (dataUrl.match(/^data:[^/]+\/([^;]+)/)?.[1] || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = join(dir, `media.${ext}`)
      writeFileSync(path, bytes)
      return { path }
    }
  )

  // Share — POST to the share API, returns { code, url, hasPassword, expiresAt }.
  // The renderer passes its `settings.share` slice through as `override`; when
  // empty we fall back to the free pit.ink service.
  ipcMain.handle(
    'pit:share:create',
    (
      _e,
      input: ShareCreateInput,
      override?: { workerUrl?: string; workerSecret?: string }
    ) => createShare(input, override)
  )

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
  // override allows the renderer to point reads at a self-hosted Worker too
  // (e.g. importing a share that one of your teammates created on the same
  // self-hosted instance).
  ipcMain.handle(
    'pit:share:fetch',
    (_e, code: string, override?: { workerUrl?: string; workerSecret?: string }) =>
      fetchShare(code, override)
  )
  ipcMain.handle(
    'pit:share:authenticate',
    (
      _e,
      input: { code: string; password: string },
      override?: { workerUrl?: string; workerSecret?: string }
    ) => authenticateShare(input.code, input.password, override)
  )
  ipcMain.handle(
    'pit:share:fetch-asset',
    (
      _e,
      input: { code: string; asset: string },
      override?: { workerUrl?: string; workerSecret?: string }
    ) => fetchAssetAsDataUrl(input.code, input.asset, override)
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
    async (_e, opts: {
      mode: 'screen' | 'window' | 'region'
      sourceId?: string
      cropRect?: { x: number; y: number; w: number; h: number }
      sourceLabel?: string
    }) => {
      // When the user picked a specific window, bring it to the front *before*
      // we start MediaRecorder — otherwise they record a covered/minimized
      // window and have to alt-tab manually.
      if (opts.mode === 'window' && opts.sourceId) {
        await bringWindowToFront(opts.sourceId)
      }
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
    ipcMain.handle('pit:debug:fake-deep-link', (_e, payload: string) => {
      // Accept either a bare share code, a pit://share/<code>, or a
      // pit://item/<id>. macOS dev protocol routing goes to a generic
      // Electron (not our dev session) so this is how we exercise the flow
      // end-to-end before shipping a packaged build.
      if (typeof payload !== 'string') return { ok: false, error: 'bad_payload' }
      const code = extractShareCode(payload) || extractShareCode(`pit://share/${payload}`)
      if (code) {
        dispatchSharedCode(code)
        return { ok: true, kind: 'share', code }
      }
      const id = extractItemId(payload) || extractItemId(`pit://item/${payload}`)
      if (id) {
        dispatchItemId(id)
        return { ok: true, kind: 'item', id }
      }
      return { ok: false, error: 'unknown_payload' }
    })
  }
}

// ─── recording helpers ──────────────────────────────────────────────────

const pexec = promisify(exec)

/**
 * Bring the OS window backing a `desktopCapturer` source ID to the front.
 *
 * Why: when the user picks "Window → Cursor" we don't want them to record a
 * minimized / covered window. We translate the CGWindow id embedded in the
 * source id (`window:CGID:0`) back to its owning process via Quartz, then
 * activate that app. Best-effort and silent on failure — if we can't bring
 * it forward, recording still works, the user just sees whatever was on top.
 *
 * macOS only. On other platforms this is a no-op (and we don't ship there
 * yet anyway).
 */
async function bringWindowToFront(sourceId: string): Promise<void> {
  if (process.platform !== 'darwin') return
  const m = sourceId.match(/^window:(\d+):/)
  if (!m) return
  const cgId = m[1]
  // JXA: look up the window by CGWindow id → owner PID → NSRunningApplication
  // → activate. `kCGWindowListOptionIncludingWindow` filters to just our id.
  const script = `
    ObjC.import("AppKit");
    ObjC.import("CoreGraphics");
    var list = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionIncludingWindow, ${cgId});
    var arr = ObjC.deepUnwrap(list);
    if (arr && arr.length > 0) {
      var pid = arr[0].kCGWindowOwnerPID;
      var app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
      if (app) app.activateWithOptions($.NSApplicationActivateIgnoringOtherApps);
    }
  `
  try {
    await pexec(`osascript -l JavaScript -e ${JSON.stringify(script)}`)
    // Tiny pause to let the focus animation settle before MediaRecorder
    // starts grabbing frames — otherwise the first ~100ms shows the
    // previously-focused app.
    await new Promise((r) => setTimeout(r, 180))
  } catch {
    // best-effort; ignore
  }
}

// ─── pit:// protocol handler ────────────────────────────────────────────

const SHARE_URL_RE = /^pit:\/\/share\/([a-z0-9]{4,16})\/?$/i
// Item deep links — emitted by the MCP server in tool responses so an LLM
// can hand the user a clickable link that jumps straight to the item modal.
// IDs are short kebab/uuid strings; accept up to 64 chars for future shapes.
const ITEM_URL_RE = /^pit:\/\/item\/([\w-]{1,64})\/?$/i

function extractShareCode(url: string | undefined | null): string | null {
  if (!url) return null
  const m = url.match(SHARE_URL_RE)
  return m ? m[1].toLowerCase() : null
}

function extractItemId(url: string | undefined | null): string | null {
  if (!url) return null
  const m = url.match(ITEM_URL_RE)
  return m ? m[1] : null
}

// Cold-start deep links (Windows/Linux: pit.exe pit://share/abc → argv).
// macOS cold start fires via app.on('open-url') AFTER whenReady, so it's
// captured by the regular handler.
let pendingShareCode: string | null = null
let pendingItemId: string | null = null
for (const arg of process.argv) {
  const code = extractShareCode(arg)
  if (code) {
    pendingShareCode = code
    break
  }
  const itemId = extractItemId(arg)
  if (itemId) {
    pendingItemId = itemId
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

/**
 * Bring the main window to the front and tell the renderer to open the item
 * detail overlay for `id`. Renderer is responsible for navigating into the
 * item's collection — main doesn't know the collection map.
 */
function dispatchItemId(id: string): void {
  const win = findMainWindow() || BrowserWindow.getAllWindows()[0]
  if (!win) {
    pendingItemId = id
    return
  }
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send('pit:item:open-requested', { id })
}

/** Try every known deep-link shape, fire the matching dispatcher. */
function dispatchDeepLink(url: string): boolean {
  const code = extractShareCode(url)
  if (code) {
    dispatchSharedCode(code)
    return true
  }
  const itemId = extractItemId(url)
  if (itemId) {
    dispatchItemId(itemId)
    return true
  }
  return false
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
      if (dispatchDeepLink(arg)) break
    }
  })
}

// macOS deep links arrive via Apple Events as `open-url`. preventDefault is
// required for Electron to skip its default "open new instance" handling.
app.on('open-url', (e, url) => {
  e.preventDefault()
  dispatchDeepLink(url)
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
  if (win && (pendingShareCode || pendingItemId)) {
    win.webContents.once('did-finish-load', () => {
      if (pendingShareCode) {
        win.webContents.send('pit:share:received', { code: pendingShareCode })
        pendingShareCode = null
      }
      if (pendingItemId) {
        win.webContents.send('pit:item:open-requested', { id: pendingItemId })
        pendingItemId = null
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
