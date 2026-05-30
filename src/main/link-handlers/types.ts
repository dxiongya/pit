// link-handlers/types.ts — shared contracts for source-specific link extractors.
//
// pit treats most links as "go capture the page" (the generic handler), but
// some sources (Twitter, Xiaohongshu, …) carry richer structured content
// inside the page that a screenshot won't surface — the embedded images,
// videos, author, post text. Handlers are pluggable extractors that turn a
// URL into structured media that pit's existing import paths can render.

import type { CapturedPage } from '../capture'
export type { CapturedPage }

/** Structured output every handler returns. The caller dispatches into the
 *  right import path based on `kind` + the media counts. */
export interface ExtractedLink {
  /** Semantic category of the source. Drives import routing (tweet/note
   *  with media → group import, site → captureSite + analyzeSite, …). */
  kind: 'tweet' | 'note' | 'site' | 'media'
  /** Human title (post title, page <title>, etc.). */
  title: string
  /** Optional author / source label ("@elonmusk", "用户名"). */
  author?: string
  /** Canonical URL — handlers may rewrite short links / strip query trash. */
  canonicalUrl: string
  /** Main body text (post copy). */
  text?: string
  /** Images embedded in the post. Each is either a data: URL we already
   *  downloaded OR an https URL for the renderer / store to fetch later. */
  images: ExtractedMedia[]
  /** Videos embedded in the post. */
  videos: ExtractedMedia[]
  /** For 'site' kind: the multi-page captureSite output (back-compat). */
  capturedPages?: CapturedPage[]
  /** Any raw provider-specific payload — useful for debugging / future
   *  fields without rev'ing the type. */
  raw?: Record<string, unknown>
  /** Set when extraction partially failed (e.g. some images blocked). */
  warning?: string
}

export interface ExtractedMedia {
  /** data:image/png;base64,… OR https://… */
  src: string
  /** Optional alt/caption from the post. */
  caption?: string
  /** Best-known dimensions, if the provider returns them. */
  width?: number
  height?: number
}

/** Per-handler context. Different handlers need different config — Twitter
 *  needs an xAPI key, Xiaohongshu currently needs nothing. */
export interface HandlerContext {
  integrations?: IntegrationsConfig
  /** Optional progress callback for UI feedback during extraction. */
  onProgress?: (msg: string) => void
}

/** Persisted in AppSettings.integrations — the user fills it in Settings →
 *  Integrations. Each handler reads its own slice; absent slices mean the
 *  handler will refuse to run (with a friendly "configure X in Settings"
 *  error). */
export interface IntegrationsConfig {
  xapi?: {
    /** xapi-to API key (`sk-…`). Used as XAPI_API_KEY env when spawning
     *  `npx xapi-to` from inside the Twitter handler (and any future
     *  xapi-backed handler). */
    apiKey: string
  }
  // Future: xhs / instagram / pinterest / dribbble / behance / figma …
}

export interface LinkHandler {
  /** Stable id used in logs / settings: 'generic', 'twitter', 'xhs'. */
  id: string
  /** Display name surfaced when the user sees "imported via …". */
  label: string
  /** True if this handler claims the URL. Registry tries handlers in
   *  registration order and uses the first match; the generic one always
   *  returns true and is registered last. */
  match(url: URL): boolean
  /** Do the extraction. Throw with a clear message on failure. */
  extract(url: string, ctx: HandlerContext): Promise<ExtractedLink>
}
