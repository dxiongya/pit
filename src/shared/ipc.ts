// shared/ipc.ts — the single source of truth for types that cross the
// renderer ↔ preload ↔ main IPC boundary.
//
// These shapes were previously hand-declared in three places (the renderer's
// provider.ts, the preload bridge, and main's ai.ts), so a rename on one side
// silently drifted — and the renderer's try/catch wrappers turned the resulting
// runtime mismatch into a mock-data fallback rather than a visible failure.
// Importing them from here makes any drift a compile error instead.
//
// Type-only module: every consumer must `import type { … }` so it fully erases
// at build time (the file lives outside the renderer/main bundle roots).

/** A resolved provider request as sent over the bridge to main/ai.ts. */
export interface RoleRequest {
  kind: 'anthropic' | 'openai' | 'google' | 'openai-compatible'
  /** Display name of the provider instance; optional on the wire. */
  name?: string
  model: string
  apiKey: string
  baseURL?: string
}

/** Input to the routing classifier (`pit:route`). */
export interface RouteInput {
  req: RoleRequest
  item: { title?: string; description?: string; tags?: string[] }
  collections: { id: string; name: string; prompt?: string; tags?: string[]; skip?: string[] }[]
  threshold: number
}

/** Result of the routing classifier. */
export interface RoutingResult {
  suggestions: { collectionId: string; confidence: number; reason: string }[]
  best: string
}

/** Deterministic source-level design facts harvested from the live DOM/CSS of a
 *  captured page (real colors / fonts / tokens / tech) — fed to the AI analysis
 *  as ground truth instead of letting it guess from screenshots. */
export interface SourceFacts {
  /** Area-weighted real colors (computed styles), most-used first. */
  palette: { hex: string; weight: number }[]
  /** Real font families (computed), with the size + weight scale each uses. */
  fonts: { family: string; sizes: number[]; weights: string[]; usage: number }[]
  bodyFont?: string
  /** Declared CSS custom properties from :root (design tokens), when present. */
  tokens: Record<string, string>
  tokenCount: number
  colorTokenCount: number
  tech: { framework: string[]; cssMethod: string[]; iconLib: string[] }
  assets: {
    /** The site's real logo: inline SVG markup and/or an <img> URL, plus
     *  high-quality icon fallbacks (apple-touch / SVG favicon / mask). */
    logo: {
      svg: string | null
      img: string | null
      source: string | null
      appleTouchIcon: string | null
      svgFavicon: string | null
      maskIcon: string | null
    }
    favicon: string | null
    ogImage: string | null
    themeColor: string | null
    loadedFonts: string[]
    imgCount: number
    inlineSvgCount: number
  }
  sampledNodes?: number
}

/** One captured page from the site-capture pipeline (`pit:capture-site`). */
export interface CapturedPage {
  name: string
  url: string
  /** First slice — used as the placeholder thumbnail. */
  screenshot?: string
  /** Full page cut into vision-friendly segments. */
  slices?: string[]
  /** Source-level design facts harvested from this page's live DOM/CSS. */
  source?: SourceFacts
  error?: string
}
