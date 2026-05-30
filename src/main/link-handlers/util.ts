// link-handlers/util.ts — shared helpers across handlers.
//
// Most handlers need to (a) download remote media to data: URLs so the
// renderer / store can persist them offline, and (b) run JS inside a
// hidden BrowserWindow to extract content from SPA pages that don't
// render server-side.

import { BrowserWindow, net } from 'electron'
import { assertPublicHttpUrl } from '../net-guard'

/** Download a remote URL to a data: URL. Uses Electron's `net` so cookies
 *  / proxy / TLS verification all match the app. */
export async function downloadToDataUrl(url: string): Promise<string> {
  await assertPublicHttpUrl(url) // SSRF guard — url is renderer-supplied
  return new Promise((resolve, reject) => {
    const req = net.request(url)
    req.on('response', (res) => {
      if (res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} ${url}`))
        return
      }
      const ct = String(res.headers['content-type'] || 'application/octet-stream').split(';')[0]
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () => {
        const buf = Buffer.concat(chunks)
        resolve(`data:${ct};base64,${buf.toString('base64')}`)
      })
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

/**
 * Render a URL in a hidden BrowserWindow and run an extractor script that
 * returns a JSON-serialisable result. Used by SPA handlers (Xiaohongshu,
 * future Instagram, …) where server-rendered HTML is missing the content.
 *
 * - userAgent override is often needed (XHS shows different / simpler markup
 *   to mobile UAs).
 * - waitForSelector + waitMs gate the extractor on actual content arrival.
 */
export interface RenderOpts {
  url: string
  userAgent?: string
  /** Wait until this CSS selector exists in the DOM before extracting. */
  waitForSelector?: string
  /** Extra settle time after the selector matches (lazy-load images, etc.). */
  settleMs?: number
  /** Hard timeout for the whole render in ms. */
  timeoutMs?: number
  /** The JS to run in-page. Should be a self-contained expression that
   *  returns a JSON-serialisable value. */
  extract: string
}

export async function renderAndExtract<T>(opts: RenderOpts): Promise<T> {
  await assertPublicHttpUrl(opts.url) // SSRF guard — opts.url is renderer-supplied
  const win = new BrowserWindow({
    width: 1280,
    height: 1600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      offscreen: false
    }
  })
  const timeout = opts.timeoutMs ?? 25000
  const settleMs = opts.settleMs ?? 600

  try {
    if (opts.userAgent) win.webContents.setUserAgent(opts.userAgent)

    // SPA share pages (Xiaohongshu, Weibo, WeChat, …) try to bounce into their
    // NATIVE app via a custom-scheme redirect (xhsdiscover://, weixin://, …).
    // Navigating a hidden window to an unhandled scheme aborts the in-flight
    // load (ERR_ABORTED) — which would reject loadURL even though the H5 page
    // we actually want already rendered. Block every non-http(s) navigation so
    // the page stays put and stays scrapeable. Pop-ups are denied outright.
    const blockNonHttp = (e: Electron.Event, navUrl: string): void => {
      if (!/^https?:/i.test(navUrl)) e.preventDefault()
    }
    win.webContents.on('will-navigate', blockNonHttp)
    win.webContents.on('will-redirect', blockNonHttp)
    win.webContents.setWindowOpenHandler(({ url }) =>
      /^https?:/i.test(url) ? { action: 'allow' } : { action: 'deny' }
    )

    // Race the load + extraction against the hard timeout.
    const done = (async (): Promise<T> => {
      try {
        await win.loadURL(opts.url)
      } catch (e) {
        // An app-launch redirect can still abort the load after the H5 content
        // painted. Tolerate ERR_ABORTED and try to extract anyway; re-throw any
        // genuine failure (DNS, connection refused, cert error, …).
        const msg = String((e as Error).message || '')
        if (!/ERR_ABORTED|\(-3\)/.test(msg)) throw e
      }
      if (opts.waitForSelector) {
        await waitForSelector(win, opts.waitForSelector, timeout)
      }
      if (settleMs > 0) await sleep(settleMs)
      const value = (await win.webContents.executeJavaScript(
        `(function(){ try { return ${opts.extract} } catch(e){ return { __error: String(e) } } })()`,
        true
      )) as T
      return value
    })()
    const timer = new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`render timeout after ${timeout}ms: ${opts.url}`)), timeout)
    )
    return await Promise.race([done, timer])
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function waitForSelector(
  win: BrowserWindow,
  selector: string,
  totalTimeout: number
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < totalTimeout) {
    const found = await win.webContents.executeJavaScript(
      `!!document.querySelector(${JSON.stringify(selector)})`,
      true
    )
    if (found) return
    await sleep(150)
  }
  throw new Error(`selector "${selector}" never appeared`)
}

/** Resolve a short link one hop to its canonical URL. Uses GET (not HEAD) with
 *  redirect:'manual' — some shorteners (e.g. xhslink.com) 404 on HEAD but 302 on
 *  GET. The body is drained and discarded; we only want the Location header. */
export async function resolveRedirect(url: string): Promise<string> {
  await assertPublicHttpUrl(url) // SSRF guard — url is renderer-supplied
  return new Promise((resolve) => {
    const req = net.request({ method: 'GET', url, redirect: 'manual' })
    req.on('response', (res) => {
      const loc = res.headers['location']
      res.on('data', () => {}) // drain so the socket can close
      res.on('end', () => {})
      if (loc && res.statusCode >= 300 && res.statusCode < 400) {
        const next = Array.isArray(loc) ? loc[0] : loc
        // Re-validate the unwrapped target before handing it back to a fetcher;
        // a short-link must not be allowed to point at an internal address.
        assertPublicHttpUrl(next).then(
          () => resolve(next),
          () => resolve(url)
        )
      } else {
        resolve(url)
      }
    })
    req.on('error', () => resolve(url))
    req.end()
  })
}
