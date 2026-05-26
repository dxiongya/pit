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

      // Title — try several known containers.
      const titleEl =
        document.querySelector('.note-detail .title, .note-content .title, .note-text .title') ||
        document.querySelector('h1') ||
        document.querySelector('.title')
      if (titleEl) out.title = titleEl.textContent.trim()

      // Author handle.
      const authorEl =
        document.querySelector('.author-wrapper .user-nickname, .username, .author .name')
      if (authorEl) out.author = authorEl.textContent.trim()

      // Description / note text.
      const descEl =
        document.querySelector('.note-detail .desc, .note-content .desc, .note-text .desc')
      if (descEl) out.text = descEl.textContent.trim()

      // Images — the carousel uses <img> tags inside .swiper-slide etc.
      // De-dup by src.
      const seen = new Set()
      const imgs = document.querySelectorAll(
        '.note-detail img, .swiper-slide img, .img-container img, .image-container img, .note-content img'
      )
      imgs.forEach((img) => {
        const src = img.getAttribute('src') || img.dataset.src
        if (!src) return
        // Skip avatars and tiny icons.
        if (src.includes('avatar') || src.includes('emoji')) return
        const w = img.naturalWidth || img.width || 0
        const h = img.naturalHeight || img.height || 0
        if (w > 0 && w < 200 && h > 0 && h < 200) return
        // Prefer the highest-res variant by stripping size suffixes XHS appends.
        const clean = src.replace(/\\?[^?]*$/, '')
        if (seen.has(clean)) return
        seen.add(clean)
        out.images.push({ src: clean, width: w, height: h })
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
    const images = await downloadAll(extracted.images)
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
          : undefined
    }
  }
}

async function downloadAll(
  raw: { src: string; width?: number; height?: number }[]
): Promise<ExtractedMedia[]> {
  // Parallel with a small cap so we don't hammer the CDN.
  const POOL = 4
  const out: ExtractedMedia[] = []
  const queue = [...raw]
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (queue.length) {
        const next = queue.shift()
        if (!next) break
        try {
          const dataUrl = await downloadToDataUrl(next.src)
          out.push({ src: dataUrl, width: next.width, height: next.height })
        } catch {
          // skip — partial set is fine, the dispatcher will still build an item
        }
      }
    })
  )
  return out
}
