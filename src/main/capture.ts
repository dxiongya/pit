// capture.ts — offscreen website screenshots for feature 1 (link import).
// Each page loads in a hidden, isolated BrowserWindow; we dismiss consent
// overlays, scroll to trigger lazy-loading, wait for images, then capture a
// full-page PNG via the Chrome DevTools Protocol. Per-page timeout keeps a slow
// or hostile page from stalling the whole run.

import { BrowserWindow } from 'electron'

export interface CapturedPage {
  name: string
  url: string
  screenshot?: string // first slice — used as the placeholder thumbnail
  slices?: string[] // full page cut into vision-friendly segments
  error?: string
}

/** Runs in the page: close consent/overlays, scroll to lazy-load, await images. */
const PREP_SCRIPT = `(async () => {
  try {
    const accept = /^(accept|agree|allow all|got it|i agree|同意|接受|允许|确定)/i
    document.querySelectorAll('button, [role="button"], a').forEach((b) => {
      try { if (accept.test((b.textContent || '').trim())) b.click() } catch (e) {}
    })
    document.querySelectorAll('body *').forEach((el) => {
      try {
        const s = getComputedStyle(el)
        if ((s.position === 'fixed' || s.position === 'sticky') && Number(s.zIndex) > 100) {
          const r = el.getBoundingClientRect()
          if (r.width > innerWidth * 0.6 && r.height > innerHeight * 0.5) el.remove()
        }
      } catch (e) {}
    })
    const step = Math.max(400, innerHeight)
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 220))
    }
    window.scrollTo(0, 0)
    await Promise.all(
      [...document.images]
        .filter((i) => !i.complete)
        .map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 2000) }))
    )
    await new Promise((r) => setTimeout(r, 400))
  } catch (e) {}
})()`

/** Runs in the page: collect same-origin nav links. */
const DISCOVER_SCRIPT = `(() => {
  const origin = location.origin
  const here = location.pathname.replace(/\\/$/, '')
  const seen = new Set()
  const out = []
  document.querySelectorAll('nav a[href], header a[href], [role="navigation"] a[href]').forEach((a) => {
    try {
      const u = new URL(a.getAttribute('href'), location.href)
      if (u.origin !== origin) return
      const key = u.pathname.replace(/\\/$/, '')
      if (!key || key === here || seen.has(key)) return
      seen.add(key)
      out.push(u.origin + u.pathname)
    } catch (e) {}
  })
  return out.slice(0, 8)
})()`

interface SizeBox {
  width: number
  height: number
}
interface LayoutMetrics {
  contentSize: SizeBox
  cssContentSize?: SizeBox // CSS px (clip coordinates); contentSize is device px
}
interface ScreenshotResult {
  data: string
}
interface EvalResult {
  result?: { value?: unknown }
  exceptionDetails?: { text?: string }
}

/**
 * Run JS in the page over CDP. Deliberately used instead of
 * webContents.executeJavaScript: mixing the two JS-execution channels across
 * navigations triggers a fatal DisallowJavascriptExecutionScope crash.
 */
async function evalInPage(win: BrowserWindow, expression: string): Promise<unknown> {
  const r = (await win.webContents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })) as EvalResult
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval failed')
  return r.result ? r.result.value : undefined
}

function pageName(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    return u.pathname.replace(/^\/|\/$/g, '') || 'home'
  } catch {
    return 'page'
  }
}

/** loadURL + wait for did-stop-loading then a short idle, capped by `ms`. */
function loadWithTimeout(win: BrowserWindow, url: string, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const wc = win.webContents
    let settled = false
    let idle: ReturnType<typeof setTimeout> | undefined
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (idle) clearTimeout(idle)
      wc.removeListener('did-stop-loading', onStop)
      // resolve off the timer's stack — running a CDP command on the timer
      // callback stack triggers DisallowJavascriptExecutionScope.
      setImmediate(resolve)
    }
    const onStop = (): void => {
      if (idle) clearTimeout(idle)
      idle = setTimeout(finish, 900) // approximate network-idle
    }
    const timeout = setTimeout(finish, ms)
    wc.on('did-stop-loading', onStop)
    wc.loadURL(url).catch(() => finish())
  })
}

const VIEWPORT_W = 1920 // emulate a wide desktop viewport — modern sites are
const VIEWPORT_H = 1080 // designed for ≥1440, often ≥1600. 1440 caused right-edge clipping.
const SLICE_H = 1400 // height of each segment (CSS px) before scaling
const MAX_DIM = 1568 // vision APIs degrade past this on the long edge
const MAX_SLICES = 4 // cap per page so a very long page can't explode the request

/**
 * Cut the full page into stacked segments instead of one giant image: vision
 * models reject/-downscale anything past ~1568px, so a 12000px-tall capture is
 * useless. Each slice is ≤ MAX_DIM on both edges (downscaled via the CDP clip
 * scale when the page is wider than that), and we keep at most MAX_SLICES.
 */
async function captureSlices(win: BrowserWindow): Promise<string[]> {
  const dbg = win.webContents.debugger
  if (!dbg.isAttached()) dbg.attach('1.3')
  const m = (await dbg.sendCommand('Page.getLayoutMetrics')) as LayoutMetrics
  // clip coords are CSS px while contentSize is device px. Use cssContentSize
  // and derive the device-pixel ratio so the physical output stays ≤ MAX_DIM on
  // both edges regardless of a Retina display (otherwise it comes out 2× too big).
  const css = m.cssContentSize || m.contentSize
  const cssW = Math.max(1, Math.ceil(css.width))
  const cssH = Math.max(1, Math.ceil(css.height))
  const dpr = m.cssContentSize ? m.contentSize.width / m.cssContentSize.width || 1 : 1
  const scale = Math.min(1, MAX_DIM / (cssW * dpr), MAX_DIM / (SLICE_H * dpr))
  const sliceCount = Math.min(Math.ceil(cssH / SLICE_H), MAX_SLICES)
  const slices: string[] = []
  for (let i = 0; i < sliceCount; i++) {
    const y = i * SLICE_H
    const height = Math.min(SLICE_H, cssH - y)
    if (height <= 0) break
    const shot = (await dbg.sendCommand('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y, width: cssW, height, scale }
    })) as ScreenshotResult
    slices.push(`data:image/png;base64,${shot.data}`)
  }
  return slices
}

function makeWindow(): BrowserWindow {
  // Physical 1920×1080 hidden window instead of CDP Emulation.setDeviceMetricsOverride
  // — the latter SIGSEGVs in Electron 39 on sandbox + offscreen-false windows.
  // dpr is whatever the OS gives (Retina=2); cssContentSize + dpr math handles it.
  return new BrowserWindow({
    show: false,
    width: VIEWPORT_W,
    height: VIEWPORT_H,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: false
    }
  })
}

/**
 * Capture one page in its own short-lived window — the debugger stays bound to a
 * single navigation (reusing one window across loadURL calls is the other half
 * of the crash). Optionally discovers same-origin nav links while it's loaded.
 */
async function captureOne(
  url: string,
  name: string,
  withDiscover: boolean
): Promise<{ page: CapturedPage; links: string[] }> {
  const win = makeWindow()
  try {
    // Window itself is 1920×1080 — no CDP setDeviceMetricsOverride (that
    // SIGSEGVs on Electron 39 sandbox/offscreen windows). Sites for wide
    // screens get their desktop layout; right-edge clipping is gone.
    await loadWithTimeout(win, url, 20000)
    if (!win.webContents.debugger.isAttached()) win.webContents.debugger.attach('1.3')
    await evalInPage(win, PREP_SCRIPT)
    const slices = await captureSlices(win)
    let links: string[] = []
    if (withDiscover) {
      try {
        links = ((await evalInPage(win, DISCOVER_SCRIPT)) as string[]) || []
      } catch {
        links = []
      }
    }
    return { page: { name, url, screenshot: slices[0], slices }, links }
  } catch (e) {
    return {
      page: { name, url, error: e instanceof Error ? e.message : 'capture failed' },
      links: []
    }
  } finally {
    if (!win.isDestroyed()) {
      if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach()
      win.destroy()
    }
  }
}

/**
 * Capture the entry URL + up to `maxPages-1` discovered same-origin pages.
 * Calls `onPage` as each one finishes (for live UI), and returns all of them.
 */
export async function captureSite(
  url: string,
  onPage: (p: CapturedPage) => void,
  maxPages = 5
): Promise<CapturedPage[]> {
  const target = url.startsWith('http') ? url : `https://${url}`
  const { page: home, links } = await captureOne(target, pageName(target), true)
  const pages: CapturedPage[] = [home]
  onPage(home)
  const seen = new Set([home.name])
  for (const link of links) {
    if (pages.length >= maxPages) break
    const name = pageName(link)
    if (seen.has(name)) continue
    seen.add(name)
    const { page } = await captureOne(link, name, false)
    pages.push(page)
    onPage(page)
  }
  return pages
}
