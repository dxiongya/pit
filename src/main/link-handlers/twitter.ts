// link-handlers/twitter.ts — Twitter / X handler that proxies through the
// user's own xapi.to gateway. The exact endpoint shape isn't pinned yet —
// the handler reads the integrations.twitter slice (baseURL + apiKey) from
// Settings and assumes a JSON contract roughly like:
//
//   GET  {baseURL}/twitter/tweet?url={tweet-url}
//   header: X-Api-Key: {apiKey}
//   → {
//       id, author: {handle, name}, text, createdAt,
//       media: [{ type: 'photo'|'video', url, width?, height? }, ...]
//     }
//
// When the real contract is confirmed, only the inside of fetchTweet() needs
// updating — the LinkHandler shape stays the same.

import type { LinkHandler, ExtractedLink, ExtractedMedia } from './types'
import { downloadToDataUrl } from './util'

interface TweetResponse {
  id?: string
  author?: { handle?: string; name?: string }
  text?: string
  media?: Array<{
    type: 'photo' | 'video' | string
    url: string
    width?: number
    height?: number
    caption?: string
  }>
}

export const twitterHandler: LinkHandler = {
  id: 'twitter',
  label: 'Twitter / X',
  match(url) {
    const h = url.hostname.toLowerCase()
    return (
      h === 'twitter.com' ||
      h === 'www.twitter.com' ||
      h === 'x.com' ||
      h === 'www.x.com' ||
      h === 'mobile.twitter.com'
    )
  },
  async extract(url, ctx): Promise<ExtractedLink> {
    const cfg = ctx.integrations?.twitter
    if (!cfg?.baseURL || !cfg?.apiKey) {
      throw new Error(
        'Twitter handler needs xapi.to credentials — set them in Settings → Integrations.'
      )
    }
    ctx.onProgress?.('Fetching tweet…')
    const tweet = await fetchTweet(url, cfg)

    const photos = (tweet.media || []).filter((m) => m.type === 'photo')
    const videos = (tweet.media || []).filter((m) => m.type === 'video' || m.type === 'animated_gif')

    ctx.onProgress?.(`Downloading ${photos.length} images…`)
    const images: ExtractedMedia[] = []
    for (const m of photos) {
      try {
        const dataUrl = await downloadToDataUrl(m.url)
        images.push({ src: dataUrl, caption: m.caption, width: m.width, height: m.height })
      } catch {
        // skip blocked
      }
    }

    return {
      kind: 'tweet',
      title: tweet.text?.slice(0, 80) || 'Tweet',
      author: tweet.author?.handle
        ? `@${tweet.author.handle}`
        : tweet.author?.name,
      canonicalUrl: url,
      text: tweet.text,
      images,
      // Video URLs left as https — Phase 4 dispatch downloads them to tmp
      // before feeding into importVideo.
      videos: videos.map((m) => ({ src: m.url, caption: m.caption })),
      raw: { provider: 'xapi.to', id: tweet.id }
    }
  }
}

async function fetchTweet(
  url: string,
  cfg: { baseURL: string; apiKey: string }
): Promise<TweetResponse> {
  const endpoint =
    cfg.baseURL.replace(/\/$/, '') + '/twitter/tweet?url=' + encodeURIComponent(url)
  const res = await fetch(endpoint, {
    headers: {
      'X-Api-Key': cfg.apiKey,
      Authorization: `Bearer ${cfg.apiKey}`,
      Accept: 'application/json'
    }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`xapi.to ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as TweetResponse
}
