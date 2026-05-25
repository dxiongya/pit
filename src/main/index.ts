import { app, shell, BrowserWindow, ipcMain } from 'electron'
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

  // Video import — extract keyframes from a local file path (preferred) or
  // a Buffer (for clipboard / screen-recording blobs). The original file is
  // never persisted; only the deduped keyframes survive.
  ipcMain.handle(
    'pit:video:extract',
    (_e, input: { path?: string; buffer?: Uint8Array; target?: number }): Promise<ExtractResult> => {
      const source = input.path ?? Buffer.from(input.buffer ?? new Uint8Array())
      return extractKeyframes(source, input.target ?? 8)
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
