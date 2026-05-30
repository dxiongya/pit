// capture.ts — offscreen website screenshots for feature 1 (link import).
// Each page loads in a hidden, isolated BrowserWindow; we dismiss consent
// overlays, scroll to trigger lazy-loading, wait for images, then capture a
// full-page PNG via the Chrome DevTools Protocol. Per-page timeout keeps a slow
// or hostile page from stalling the whole run.

import { BrowserWindow } from 'electron'
import { assertPublicHttpUrl } from './net-guard'
import { HARVEST_SCRIPT } from './harvest'
import type { CapturedPage, SourceFacts } from '../shared/ipc'

// Re-exported so `import { CapturedPage } from '../capture'` consumers keep
// working; the canonical definition lives in shared/ipc.ts.
export type { CapturedPage }

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

/**
 * Runs in the page: find same-origin internal links worth crawling.
 *
 * Lessons from broken cases:
 *   - Raycast / Vercel use classed <div>s instead of <nav>/<header>.
 *   - Framer + Webflow sites have NO semantic landmark tags at all; the nav
 *     lives inside `<div data-framer-name="Nav">` or `[data-w-id]` containers
 *     with auto-generated class hashes.
 *   - Hydration races: 400 ms after did-stop-loading isn't always enough for
 *     a React/Framer app to mount its links. We wait for the anchor count to
 *     stabilise before scoring.
 *   - Marketing footers carry the most useful internal links (about /
 *     pricing / changelog / blog) — never ignore them.
 *
 * Approach: one unified scoring pass over EVERY same-origin <a>, summing
 * three signal sources (location, attribute hints, viewport position).
 * Higher score = more likely a "real" nav target. We dedupe by pathname,
 * sort descending, and return the top 12.
 *
 * Junk filters: hash-only, mailto/tel, file extensions, common service
 * paths (/api, /cdn-cgi, /_next), and self-links.
 */
const DISCOVER_SCRIPT = `(async () => {
  const origin = location.origin
  const here = location.pathname.replace(/\\/$/, '')

  // Wait for the anchor count to settle — covers SPAs whose nav mounts
  // late. We poll up to ~1500 ms and bail as soon as two reads in a row
  // agree (≥150ms apart).
  let prev = -1
  for (let i = 0; i < 8; i++) {
    const n = document.querySelectorAll('a[href]').length
    if (n > 0 && n === prev) break
    prev = n
    await new Promise((r) => setTimeout(r, 200))
  }

  const JUNK_EXT = /\\.(pdf|zip|dmg|exe|mp4|webm|mov|png|jpe?g|svg|gif|webp|woff2?|ico|css|js|json)(\\?|$)/i
  const SKIP_PATH = /^\\/(cdn-cgi|api|_next|static|assets|wp-content|wp-includes)\\//i
  const inViewportH = window.innerHeight || 800

  // Score buckets. Each anchor accumulates points from independent signals.
  const score = (a) => {
    let s = 0
    let n = a.parentElement
    let depth = 0
    let inSemantic = ''
    while (n && depth < 8) {
      const tag = n.tagName
      const cls = (n.className && typeof n.className === 'string') ? n.className.toLowerCase() : ''
      const dfn = n.getAttribute && (n.getAttribute('data-framer-name') || '')
      // Strongest signal — landmark tag containing the anchor.
      if (tag === 'NAV') { s += 1200; inSemantic = inSemantic || 'nav' }
      if (tag === 'HEADER') { s += 900; inSemantic = inSemantic || 'header' }
      if (tag === 'FOOTER') { s += 700; inSemantic = inSemantic || 'footer' }
      if (n.getAttribute && n.getAttribute('role') === 'navigation') s += 1100
      // Class / data-attribute hints, weaker but enough to disambiguate
      // bare-div builders (Framer, Webflow, CSS modules, Tailwind UI).
      if (cls) {
        if (/(^|\\W)(nav|navigation|navbar|primary-nav)(\\W|$)/.test(cls)) s += 800
        if (/(^|\\W)(header|topbar|masthead|brand-bar)(\\W|$)/.test(cls)) s += 600
        if (/(^|\\W)(footer|site-footer|bottom)(\\W|$)/.test(cls)) s += 500
        if (/(^|\\W)(menu|main-menu)(\\W|$)/.test(cls)) s += 300
      }
      if (dfn) {
        const d = dfn.toLowerCase()
        if (/(nav|menu|header|footer)/.test(d)) s += 700
      }
      n = n.parentElement
      depth++
    }
    // Visibility + position. Off-screen or zero-sized anchors are
    // typically mobile-menu duplicates or skip-links.
    let rect = null
    try { rect = a.getBoundingClientRect() } catch (e) {}
    if (rect && rect.width > 0 && rect.height > 0) {
      s += 200
      // Bias toward links near the top of the document (after PREP scrolls
      // back to 0, top = absolute y). Cap at first 2 viewports.
      const yClamped = Math.max(0, Math.min(inViewportH * 2, rect.top))
      s += Math.round((inViewportH * 2 - yClamped) / 8)
    } else {
      // Still allow hidden-nav links to count, just much less — many
      // SPA hamburgers move the nav off-screen but still represent real
      // routes. (Pass 4-of-last-resort behaviour, but unified.)
      s += 10
    }
    return { s, inSemantic }
  }

  const best = new Map() // pathname → { score, source }
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')
    if (!href) continue
    let u
    try { u = new URL(href, location.href) } catch (e) { continue }
    if (u.origin !== origin) continue
    if (u.protocol !== 'http:' && u.protocol !== 'https:') continue
    if (JUNK_EXT.test(u.pathname)) continue
    if (SKIP_PATH.test(u.pathname)) continue
    const key = u.pathname.replace(/\\/$/, '')
    if (!key || key === here) continue
    const { s, inSemantic } = score(a)
    if (s <= 0) continue
    const prev = best.get(key)
    if (!prev || s > prev.score) best.set(key, { score: s, source: inSemantic || 'page' })
  }

  return [...best.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 12)
    .map(([path]) => origin + path)
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
    // Source-level design harvest (real colors/fonts/tokens/tech from the live
    // DOM) — best-effort; never let it fail the screenshot capture.
    let source: SourceFacts | undefined
    try {
      source = (await evalInPage(win, HARVEST_SCRIPT)) as SourceFacts
    } catch {
      source = undefined
    }
    const slices = await captureSlices(win)
    let links: string[] = []
    if (withDiscover) {
      try {
        links = ((await evalInPage(win, DISCOVER_SCRIPT)) as string[]) || []
      } catch {
        links = []
      }
    }
    return { page: { name, url, screenshot: slices[0], slices, source }, links }
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
  // 6 = home + 5 internal pages. Enough to cover product/pricing/docs/blog/
  // about for a typical product marketing site without making the run too
  // long. The discover script returns up to 12 so we can grow this without
  // changing anything else.
  maxPages = 6
): Promise<CapturedPage[]> {
  const target = url.startsWith('http') ? url : `https://${url}`
  // SSRF guard: reject loopback/private/link-local/metadata targets before we
  // ever load the (renderer-supplied) URL in a real Chromium window.
  await assertPublicHttpUrl(target)
  const { page: home, links } = await captureOne(target, pageName(target), true)
  const pages: CapturedPage[] = [home]
  onPage(home)
  const seen = new Set([home.name])
  for (const link of links) {
    if (pages.length >= maxPages) break
    const name = pageName(link)
    if (seen.has(name)) continue
    seen.add(name)
    // Discovered links come from the page's own DOM — re-validate each so a
    // hostile page can't redirect the crawl onto an internal address.
    try {
      await assertPublicHttpUrl(link)
    } catch {
      continue
    }
    const { page } = await captureOne(link, name, false)
    pages.push(page)
    onPage(page)
  }
  return pages
}
