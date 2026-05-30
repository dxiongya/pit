// link-handlers/twitter.ts — Twitter / X handler that shells out to the
// `xapi-to` CLI (https://xapi.to). xapi is a thin gateway over multiple
// data providers; we use its `twitter.tweet_detail` action to fetch the
// tweet payload (text, author, media) and pull image / video URLs out of it.
//
// Calling via the CLI (instead of HTTP directly) avoids us having to track
// xapi's internal endpoint shape — the CLI is the documented surface.

import { spawn } from 'child_process'
import type { LinkHandler, ExtractedLink, ExtractedMedia } from './types'
import { downloadToDataUrl } from './util'

// Hard cap for the spawned xapi-to process. First run includes an `npx -y`
// fetch, so it's generous — but without it a hung child (cold npm fetch,
// registry prompt, network stall) leaves extract() and the renderer's
// "analyzing" card pending forever.
const XAPI_TIMEOUT_MS = 90_000

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
    const apiKey = ctx.integrations?.xapi?.apiKey
    if (!apiKey) {
      throw new Error(
        'xapi API key not configured. Open Settings → Integrations and paste a key from https://xapi.to.'
      )
    }

    const tweetId = extractTweetId(url)
    if (!tweetId) {
      throw new Error(`Could not extract tweet ID from URL: ${url}`)
    }

    ctx.onProgress?.('Calling xapi twitter.tweet_detail…')
    const payload = await runXapi(
      ['call', 'twitter.tweet_detail', '--input', JSON.stringify({ tweet_id: tweetId })],
      apiKey
    )

    const { text, author, images: imgUrls, videos: vidUrls } = parseTweetPayload(payload)

    ctx.onProgress?.(`Downloading ${imgUrls.length} images…`)
    const images: ExtractedMedia[] = []
    let droppedImages = 0
    for (const u of imgUrls) {
      try {
        const dataUrl = await downloadToDataUrl(u)
        images.push({ src: dataUrl })
      } catch {
        droppedImages++ // blocked / expired — count it so we can warn
      }
    }

    return {
      kind: 'tweet',
      title: text?.slice(0, 80) || 'Tweet',
      author: author ? `@${author}` : undefined,
      canonicalUrl: url,
      text,
      images,
      // Video URLs left as https — the dispatcher in store.importLink calls
      // pit:link:fetch-to-tmp to download before feeding into importVideo.
      videos: vidUrls.map((u) => ({ src: u })),
      warning:
        droppedImages > 0
          ? `${droppedImages} of ${imgUrls.length} image${imgUrls.length > 1 ? 's' : ''} couldn't be downloaded (blocked or expired).`
          : undefined,
      raw: { provider: 'xapi', action: 'twitter.tweet_detail', tweetId }
    }
  }
}

function extractTweetId(url: string): string | null {
  const m = url.match(/\/status(?:es)?\/(\d+)/)
  return m ? m[1] : null
}

/**
 * Spawn `npx xapi-to <args>` with XAPI_API_KEY in env. Buffers stdout and
 * parses it as JSON. Resolves to the parsed `data` payload (xapi-to returns
 * { data, success, … } wrapper); rejects with the stderr body on non-zero
 * exit.
 */
function runXapi(args: string[], apiKey: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['-y', 'xapi-to', ...args], {
      env: { ...process.env, XAPI_API_KEY: apiKey },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    // Single settle point so the timeout-kill and the close/error events can't
    // double-resolve, and the timer is always cleared.
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* already exited */
      }
      finish(() =>
        reject(new Error(`xapi-to timed out after ${XAPI_TIMEOUT_MS / 1000}s (npx download or network stall?)`))
      )
    }, XAPI_TIMEOUT_MS)
    proc.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    proc.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    proc.on('error', (e) => {
      finish(() =>
        reject(
          new Error(
            `npx xapi-to failed to spawn: ${e.message}. Make sure Node.js + npx are on your PATH.`
          )
        )
      )
    })
    proc.on('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(`xapi-to exit ${code}: ${stderr.slice(-400) || stdout.slice(-400)}`))
          return
        }
        try {
          resolve(JSON.parse(stdout))
        } catch (e) {
          reject(
            new Error(`xapi-to returned non-JSON: ${(e as Error).message}\n${stdout.slice(0, 400)}`)
          )
        }
      })
    })
  })
}

/**
 * Walk the xapi tweet_detail response and pull out text, author handle, and
 * image / video URLs. The response shape is upstream-determined and may
 * change; we use defensive walks instead of strict typing.
 */
function parseTweetPayload(payload: unknown): {
  text?: string
  author?: string
  images: string[]
  videos: string[]
} {
  // xapi typically returns { success, data: {...} } — but the CLI sometimes
  // returns the inner data directly. Try both shapes.
  const root =
    isObject(payload) && 'data' in payload && isObject(payload.data)
      ? (payload.data as Record<string, unknown>)
      : isObject(payload)
        ? (payload as Record<string, unknown>)
        : {}

  // Locate the tweet object. xapi-to returns a FLATTENED tweet at `data.tweet`
  // (full_text / author / media right on it); the raw Twitter internal API
  // instead nests the useful fields under a deep `legacy` object. Prefer the
  // flat shape, then fall back to the legacy walks.
  const flat = isObject(root['tweet']) ? (root['tweet'] as Record<string, unknown>) : undefined
  const legacy = walk(root, [
    ['legacy'],
    ['tweet', 'legacy'],
    ['data', 'legacy'],
    ['data', 'tweetResult', 'result', 'legacy'],
    ['threaded_conversation_with_injections_v2', 'instructions', 0, 'entries', 0, 'content', 'itemContent', 'tweet_results', 'result', 'legacy']
  ])
  const tweetObj = flat || (isObject(legacy) ? legacy : isObject(root) ? root : {})

  const text =
    asStr(tweetObj['full_text']) ||
    asStr(tweetObj['text']) ||
    asStr(root['text']) ||
    undefined

  // Author handle — xapi-to → tweet.author.screen_name; raw → user.legacy.screen_name.
  const author =
    asStr(
      walk(tweetObj, [
        ['author', 'screen_name'],
        ['author', 'username'],
        ['user', 'legacy', 'screen_name'],
        ['user', 'screen_name'],
        ['screen_name']
      ])
    ) || undefined

  // Media — Twitter's `extended_entities.media[]` carries photo + video; for
  // videos the playable URL is in `media.video_info.variants` (pick highest
  // bitrate mp4).
  // Pick the FIRST NON-EMPTY media array. (A plain `asArray(a) || asArray(b)`
  // chain is broken here: asArray() always returns an array, and an empty array
  // is truthy, so the chain would always stop at the first — never reaching the
  // xapi-to `tweet.media[]` shape when raw `extended_entities` is absent.)
  const ext = tweetObj['extended_entities']
  const ent = tweetObj['entities']
  const mediaArr =
    [
      isObject(ext) ? ext['media'] : undefined,
      isObject(ent) ? ent['media'] : undefined,
      tweetObj['media'], // xapi-to flat shape: tweet.media[] = {type,url,…}
      root['media']
    ]
      .map(asArray)
      .find((a) => a.length > 0) || []

  const images: string[] = []
  const videos: string[] = []
  for (const m of mediaArr) {
    if (!isObject(m)) continue
    const type = asStr(m['type']) || 'photo'
    if (type === 'photo') {
      const u = asStr(m['media_url_https']) || asStr(m['media_url']) || asStr(m['url'])
      if (u) images.push(addLargeSuffix(u))
    } else if (type === 'video' || type === 'animated_gif') {
      const variants = asArray(
        m['video_info'] && (m['video_info'] as Record<string, unknown>)['variants']
      )
      const mp4s = variants
        .filter((v) => isObject(v) && asStr((v as Record<string, unknown>)['content_type']) === 'video/mp4')
        .map((v) => v as Record<string, unknown>)
        .sort(
          (a, b) =>
            (asNum(b['bitrate']) || 0) - (asNum(a['bitrate']) || 0)
        )
      const best = mp4s[0]
      if (best) {
        const url = asStr(best['url'])
        if (url) videos.push(url)
      } else {
        // No variants array (xapi-to flat shape / animated_gif): the playable
        // URL is in `url` or `media_url_https`.
        const u = asStr(m['url']) || asStr(m['media_url_https']) || asStr(m['media_url'])
        if (u) videos.push(u)
      }
    }
  }

  return { text, author, images, videos }
}

// ── tiny defensive walkers ────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}
function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function asNum(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
/** Walk obj along a list of candidate paths, return the first one that hits
 *  a non-undefined value. Paths can mix string keys and number indices. */
function walk(obj: unknown, paths: (string | number)[][]): unknown {
  for (const path of paths) {
    let cur: unknown = obj
    let ok = true
    for (const step of path) {
      if (typeof step === 'number') {
        if (!Array.isArray(cur) || cur[step] === undefined) {
          ok = false
          break
        }
        cur = cur[step]
      } else {
        if (!isObject(cur) || cur[step] === undefined) {
          ok = false
          break
        }
        cur = cur[step]
      }
    }
    if (ok && cur !== undefined) return cur
  }
  return undefined
}
/** Twitter photo URLs accept ":large" / ":orig" suffixes for higher-res. */
function addLargeSuffix(url: string): string {
  return url.includes('?') || url.endsWith(':large') || url.endsWith(':orig')
    ? url
    : `${url}?name=large`
}
