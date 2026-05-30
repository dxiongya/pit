// link-handlers/xhs.ts — Xiaohongshu (小红书) note extractor.
//
// XHS notes are SPAs (the server returns a skeleton; React/Vue hydrates the
// real content client-side), so a plain fetch + cheerio gets nothing useful.
// Instead we render the URL in a hidden BrowserWindow with a mobile UA
// (mobile gets a slightly simpler markup that's friendlier to scrape) and
// run an in-page extractor that pulls title / author / images / video out
// of the rendered DOM.
//
// Two URL shapes are common:
//   - https://www.xiaohongshu.com/explore/<noteId>
//   - https://www.xiaohongshu.com/discovery/item/<noteId>
//   - http://xhslink.com/<short>   (redirect to one of the above)

import type { LinkHandler, ExtractedLink, ExtractedMedia } from './types'
import { downloadToDataUrl, renderAndExtract, resolveRedirect } from './util'

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'

export const xhsHandler: LinkHandler = {
  id: 'xhs',
  label: '小红书',
  match(url) {
    const h = url.hostname.toLowerCase()
    return (
      h === 'xiaohongshu.com' ||
      h === 'www.xiaohongshu.com' ||
      h === 'xhslink.com' ||
      h.endsWith('.xiaohongshu.com')
    )
  },
  async extract(url, ctx): Promise<ExtractedLink> {
    ctx.onProgress?.('Resolving link…')
    const resolved = url.startsWith('http://xhslink.com')
      ? await resolveRedirect(url)
      : url

    ctx.onProgress?.('Rendering note…')
    // In-page extractor: walk the DOM for the common XHS note shape.
    // The selectors below are conservative — they target multiple known
    // class names because XHS rotates them periodically.
    const extractScript = `(function(){
      const out = { title:'', author:'', text:'', images:[], video:null, isLoginWall:false }
      // Login walls are the most common failure mode — surface them explicitly.
      const wallText = (document.body.innerText || '').slice(0, 400)
      if (/登录|Login|请先登录/.test(wallText) && !document.querySelector('img[src*="ci.xiaohongshu.com"]')) {
        out.isLoginWall = true
        return out
      }

      const meta = (sel) => { const m = document.querySelector(sel); return m ? (m.getAttribute('content') || '').trim() : '' }

      // Title — known containers, then h1, then og:title / <title>.
      const titleEl =
        document.querySelector('.note-detail .title, .note-content .title, .note-text .title') ||
        document.querySelector('h1') ||
        document.querySelector('.title')
      if (titleEl) out.title = titleEl.textContent.trim()
      if (!out.title) out.title = meta('meta[property="og:title"]') || (document.title || '').replace(/\\s*[-|–｜].*$/, '').trim()

      // Author handle.
      const authorEl =
        document.querySelector('.author-wrapper .user-nickname, .username, .author .name')
      if (authorEl) out.author = authorEl.textContent.trim()

      // Description / note text — known containers, then meta description.
      const descEl =
        document.querySelector('.note-detail .desc, .note-content .desc, .note-text .desc, #detail-desc')
      if (descEl) out.text = descEl.textContent.trim()
      if (!out.text) out.text = meta('meta[name="description"]') || meta('meta[property="og:description"]')

      // Images — XHS rotates container class names constantly, so matching by
      // class (.note-detail img, .swiper-slide img, …) breaks silently. Match by
      // CDN HOST instead: note images live on *.xhscdn.com (sns-webpic-* /
      // sns-na-*). Skip avatars (sns-avatar-*), emoji, tiny icons, and the junk
      // www.xiaohongshu.com placeholder imgs. Keep the FULL src (its ?imageView2
      // size params are needed — stripping them can 403).
      const seen = new Set()
      document.querySelectorAll('img').forEach((img) => {
        const raw = img.currentSrc || img.getAttribute('src') || img.dataset.src
        if (!raw) return
        let host = ''
        try { host = new URL(raw, location.href).host } catch (e) { return }
        if (!/xhscdn\\.com$/.test(host)) return
        if (/avatar/i.test(host) || /avatar|emoji/i.test(raw)) return
        const w = img.naturalWidth || img.width || 0
        const h = img.naturalHeight || img.height || 0
        if (w && w < 200 && h && h < 200) return
        const key = raw.split('?')[0]
        if (seen.has(key)) return
        seen.add(key)
        out.images.push({ src: raw, width: w, height: h })
      })

      // Video (single).
      const v = document.querySelector('video')
      if (v) {
        const src = v.getAttribute('src') || (v.querySelector('source') && v.querySelector('source').src)
        if (src) out.video = { src }
      }
      return out
    })()`

    let extracted: {
      title: string
      author: string
      text: string
      images: { src: string; width?: number; height?: number }[]
      video: { src: string } | null
      isLoginWall?: boolean
      __error?: string
    }
    try {
      extracted = await renderAndExtract({
        url: resolved,
        userAgent: MOBILE_UA,
        // The note container always renders before content paints — wait for
        // any of the common ones (use body as the safest universal anchor;
        // the in-page script will detect "login wall" content separately).
        waitForSelector: 'body',
        settleMs: 1500,
        timeoutMs: 30000,
        extract: extractScript
      })
    } catch (e) {
      throw new Error(`Xiaohongshu render failed: ${(e as Error).message}`)
    }
    if (extracted.__error) {
      throw new Error(`Xiaohongshu extractor: ${extracted.__error}`)
    }
    if (extracted.isLoginWall) {
      throw new Error(
        'Xiaohongshu requires login for this note — open the page in a browser, sign in, then retry.'
      )
    }

    ctx.onProgress?.(`Downloading ${extracted.images.length} images…`)
    const { media: images, dropped } = await downloadAll(extracted.images)
    const videos: ExtractedMedia[] = extracted.video
      ? [{ src: extracted.video.src }]
      : []

    return {
      kind: 'note',
      title: extracted.title || 'Xiaohongshu note',
      author: extracted.author || undefined,
      canonicalUrl: resolved,
      text: extracted.text || undefined,
      images,
      videos,
      warning:
        images.length === 0 && videos.length === 0
          ? 'No media extracted — the note may be text-only or the layout changed.'
          : dropped > 0
            ? `${dropped} of ${extracted.images.length} images couldn't be downloaded (blocked or expired).`
            : undefined
    }
  }
}

async function downloadAll(
  raw: { src: string; width?: number; height?: number }[]
): Promise<{ media: ExtractedMedia[]; dropped: number }> {
  // Parallel with a small cap so we don't hammer the CDN. Results are written
  // back at their SOURCE index (not pushed on completion) so the carousel order
  // is preserved regardless of which downloads finish first.
  const POOL = 4
  const slots: (ExtractedMedia | null)[] = new Array(raw.length).fill(null)
  let cursor = 0
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (true) {
        const i = cursor++
        if (i >= raw.length) break
        const item = raw[i]
        try {
          const dataUrl = await downloadToDataUrl(item.src)
          slots[i] = { src: dataUrl, width: item.width, height: item.height }
        } catch {
          // leave the slot null — partial set is fine; counted as dropped below
        }
      }
    })
  )
  const media = slots.filter((m): m is ExtractedMedia => m !== null)
  return { media, dropped: raw.length - media.length }
}
