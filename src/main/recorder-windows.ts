// recorder-windows.ts — orchestrates the OS-level chrome around a screen
// recording session. Three accessory BrowserWindows complement the main pit
// window's RecordModal, which still owns MediaRecorder + the captured stream:
//
//   floatWin    — small frameless always-on-top pill: timer + pause/stop
//   borderWin   — full-screen click-through overlay drawing a red border so
//                 the user sees the screen is being recorded
//   regionWin   — full-screen drag-rect picker, used before start when the
//                 user wants to record only part of a display
//
// All windows share the renderer build but load with a hash route so a single
// React entrypoint can fan-out into separate UIs.

import { BrowserWindow, ipcMain, screen, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let toolbarWin: BrowserWindow | null = null
let floatWin: BrowserWindow | null = null
let borderWin: BrowserWindow | null = null
let regionWin: BrowserWindow | null = null
// Tracks the main pit window so we can minimize / restore around a session.
let mainBeforeRecord: BrowserWindow | null = null

function rendererUrl(hash: string): string {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/#${hash}`
  }
  // Production: file:// load with hash fragment
  return `file://${join(__dirname, '../renderer/index.html')}#${hash}`
}

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

/** Find the main pit window — anything that isn't one of our accessory windows. */
export function findMainWindow(): BrowserWindow | null {
  return (
    BrowserWindow.getAllWindows().find(
      (w) => w !== floatWin && w !== borderWin && w !== regionWin && w !== toolbarWin
    ) || null
  )
}

/**
 * Open the bottom picker toolbar. This is the entry point for a recording
 * session: pit minimizes and the user picks mode + audio + (later) source in
 * the toolbar before clicking Start. Replaces the in-app modal flow.
 */
export function openToolbar(): void {
  if (toolbarWin && !toolbarWin.isDestroyed()) {
    toolbarWin.focus()
    return
  }
  mainBeforeRecord = findMainWindow()
  if (mainBeforeRecord) mainBeforeRecord.minimize()

  const primary = screen.getPrimaryDisplay()
  const w = 720
  const h = 84
  toolbarWin = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round(primary.workArea.x + (primary.workArea.width - w) / 2),
    y: primary.workArea.y + primary.workArea.height - h - 28,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false
    }
  })
  toolbarWin.setAlwaysOnTop(true, 'pop-up-menu')
  toolbarWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  toolbarWin.loadURL(rendererUrl('/recorder-toolbar'))
  toolbarWin.once('ready-to-show', () => toolbarWin?.show())

  toolbarWin.on('closed', () => {
    toolbarWin = null
    // If toolbar was closed WITHOUT a recording having begun (user X'd out)
    // then no float/border is up — restore main here.
    if (!floatWin && mainBeforeRecord && !mainBeforeRecord.isDestroyed()) {
      mainBeforeRecord.restore()
      mainBeforeRecord.focus()
      mainBeforeRecord = null
    }
  })
}

/** Close the toolbar without restoring main (called when recording begins). */
export function closeToolbar(): void {
  if (toolbarWin && !toolbarWin.isDestroyed()) toolbarWin.close()
  toolbarWin = null
}

interface StartOpts {
  mode: 'screen' | 'window' | 'region'
  /** When mode is 'screen' or 'region', the display whose bounds we should
   *  overlay with the border indicator. Defaults to primary. */
  displayId?: number
  /** For region mode — the user-picked rect on the display. The persistent
   *  border window is sized to this rect so the user can see what's being
   *  recorded throughout the session. */
  regionRect?: { x: number; y: number; w: number; h: number }
}

export function startRecorderChrome(opts: StartOpts): void {
  // Toolbar has already minimized main and is now being closed; just track
  // main here in case openToolbar() wasn't the entry point (legacy callers).
  if (!mainBeforeRecord) mainBeforeRecord = findMainWindow()
  if (mainBeforeRecord && !mainBeforeRecord.isMinimized()) mainBeforeRecord.minimize()

  // Float widget — small pill near the top-center of the primary display.
  const primary = screen.getPrimaryDisplay()
  const floatW = 320
  const floatH = 56
  floatWin = new BrowserWindow({
    width: floatW,
    height: floatH,
    x: Math.round(primary.workArea.x + (primary.workArea.width - floatW) / 2),
    y: primary.workArea.y + 14,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    movable: true,
    show: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false
    }
  })
  floatWin.setAlwaysOnTop(true, 'pop-up-menu')
  floatWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatWin.loadURL(rendererUrl('/recorder-control'))
  floatWin.once('ready-to-show', () => floatWin?.show())

  // Border overlay — visual frame around the captured area. Window mode skips
  // it (the captured window's own focus ring is enough); screen + region both
  // get an overlay so the user always sees what's being recorded.
  if (opts.mode === 'screen') {
    // Whole-display capture: fullscreen click-through frame.
    const target =
      opts.displayId != null
        ? screen.getAllDisplays().find((d) => d.id === opts.displayId) || primary
        : primary
    borderWin = new BrowserWindow({
      x: target.bounds.x,
      y: target.bounds.y,
      width: target.bounds.width,
      height: target.bounds.height,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: preloadPath(),
        sandbox: false
      }
    })
    borderWin.setIgnoreMouseEvents(true, { forward: true })
    borderWin.setAlwaysOnTop(true, 'screen-saver')
    borderWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    borderWin.loadURL(rendererUrl('/recorder-border'))
    borderWin.once('ready-to-show', () => borderWin?.show())
  } else if (opts.mode === 'region' && opts.regionRect) {
    // Region capture: a dashed-border window sized to the rect itself, so the
    // user sees the exact bounds throughout the recording. The window is
    // slightly larger than the rect to make room for the border without
    // covering content (border drawn inset).
    const r = opts.regionRect
    const target =
      opts.displayId != null
        ? screen.getAllDisplays().find((d) => d.id === opts.displayId) || primary
        : primary
    borderWin = new BrowserWindow({
      x: target.bounds.x + r.x,
      y: target.bounds.y + r.y,
      width: r.w,
      height: r.h,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      focusable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: preloadPath(),
        sandbox: false
      }
    })
    borderWin.setIgnoreMouseEvents(true, { forward: true })
    borderWin.setAlwaysOnTop(true, 'screen-saver')
    borderWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    borderWin.loadURL(rendererUrl('/recorder-region-border'))
    borderWin.once('ready-to-show', () => borderWin?.show())
  }
}

export function stopRecorderChrome(): void {
  if (floatWin && !floatWin.isDestroyed()) {
    floatWin.close()
  }
  if (borderWin && !borderWin.isDestroyed()) {
    borderWin.close()
  }
  floatWin = null
  borderWin = null
  if (mainBeforeRecord && !mainBeforeRecord.isDestroyed()) {
    mainBeforeRecord.restore()
    mainBeforeRecord.focus()
  }
  mainBeforeRecord = null
}

/**
 * Spawn a fullscreen region picker. Resolves with the user's selected rect
 * (in display-relative CSS px) or null if they cancelled (Esc / no drag).
 *
 * The picker is full-screen + focusable so we can capture key + mouse events.
 * It uses postMessage-style IPC for the result.
 */
export function pickRegion(): Promise<{ x: number; y: number; w: number; h: number; displayId: number } | null> {
  return new Promise((resolve) => {
    const primary = screen.getPrimaryDisplay()
    regionWin = new BrowserWindow({
      x: primary.bounds.x,
      y: primary.bounds.y,
      width: primary.bounds.width,
      height: primary.bounds.height,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: preloadPath(),
        sandbox: false
      }
    })
    regionWin.setAlwaysOnTop(true, 'screen-saver')
    regionWin.loadURL(rendererUrl('/recorder-region'))
    regionWin.once('ready-to-show', () => {
      regionWin?.show()
      regionWin?.focus()
    })

    const onResult = (
      _e: Electron.IpcMainEvent,
      rect: { x: number; y: number; w: number; h: number } | null
    ): void => {
      ipcMain.removeListener('pit:rec:region-result', onResult)
      if (regionWin && !regionWin.isDestroyed()) regionWin.close()
      regionWin = null
      if (!rect) return resolve(null)
      resolve({ ...rect, displayId: primary.id })
    }
    ipcMain.on('pit:rec:region-result', onResult)

    // Safety: if the user kills the window through some OS path, resolve null.
    regionWin.on('closed', () => {
      ipcMain.removeListener('pit:rec:region-result', onResult)
      regionWin = null
      // Resolve null if hasn't been resolved yet — onResult would have run first
      // if the user actually picked or cancelled in the renderer.
    })
  })
}

/**
 * Forward a control command from the float widget back to the main window's
 * RecordModal (which owns MediaRecorder). The relay lives in main because
 * IPC is renderer↔main; renderer-to-renderer requires a hop.
 */
export function relayControl(cmd: 'pause' | 'resume' | 'stop'): void {
  const main = mainBeforeRecord || findMainWindow()
  if (!main || main.isDestroyed()) return
  // Bring the main window forward so the user sees the result of stop+analyze;
  // for pause/resume the float widget itself shows the new state.
  if (cmd === 'stop' && main.isMinimized()) main.restore()
  main.webContents.send('pit:rec:command', cmd)
}

/**
 * Push the current recorder state (elapsed + paused) from main window's
 * RecordModal to the float widget so its timer + button labels stay in sync.
 */
export function pushFloatState(state: { elapsedMs: number; paused: boolean }): void {
  if (floatWin && !floatWin.isDestroyed()) {
    floatWin.webContents.send('pit:rec:state', state)
  }
}

// Cleanup on app quit so we don't leak accessory windows.
app.on('before-quit', () => {
  stopRecorderChrome()
  if (regionWin && !regionWin.isDestroyed()) regionWin.close()
  regionWin = null
})
