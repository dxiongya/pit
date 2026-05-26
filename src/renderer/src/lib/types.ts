// types.ts — pit data model.
// Aligned with the DESIGN.md spec (VoltAgent/awesome-design-md) for site analysis,
// plus the collection / routing / settings models for the 5 product surfaces.

export type ItemKind = 'image' | 'link' | 'video' | 'palette' | 'font' | 'quote' | 'note'

export type View = 'home' | 'collection' | 'new-collection' | 'settings' // AI config

/** A collection — built-in (All / Recent / Inbox) or user-defined with a routing prompt. */
export interface Collection {
  id: string
  name: string
  color: string
  icon: string
  builtin?: boolean
  desc?: string
  /** Free-form instruction the AI reads to decide whether a new item belongs here. */
  prompt?: string
  /** Structured tags that bias routing toward this collection. */
  tags?: string[]
  /** Tags that should never be routed here. */
  skip?: string[]
  /** Auto-route incoming items that match >= threshold. */
  autoRoute?: boolean
  count?: number
}

/** A saved piece of material. */
export interface Item {
  id: string
  kind: ItemKind
  collection: string
  title?: string
  prompt?: string // AI-extracted, copy-pastable description
  tags?: string[]
  // visual
  aspect?: number
  span?: number
  bg?: string
  screenshot?: string // captured/imported image data URL
  // link
  url?: string
  favicon?: string
  // palette
  palette?: string[]
  source?: string
  // font
  sample?: string
  foundry?: string
  classification?: string
  weights?: string
  // quote / note
  text?: string
  author?: string
  body?: string
  meta?: string
  /** full analysis result — kept for the detail view + export */
  design?: DesignDoc
  createdAt?: number
  // background import lifecycle (paste-to-import). `ready` once analysis lands.
  status?: 'analyzing' | 'ready' | 'failed'
  progress?: string // human-readable step, e.g. "Capturing 2/4…"
  streamText?: string // live "thinking" stream, shown in the analyzing popup
  /** Pages already captured during a live link import — drives the per-page
   *  thumbnails in AnalyzingDetail. Mirrored into design.pages on finalize. */
  capturedPages?: CapturedPage[]
  /** AI-generated HTML variants of this item's design (color variations +
   *  custom content rewrites). Stored nested so derivatives don't flood the
   *  main masonry; surfaced in the Derive tab of the detail overlay. */
  derivatives?: Derivative[]
  error?: string
}

/* ============================================================
   Derivatives — Phase 5: design-system-driven HTML codegen.
   ============================================================ */

export interface Derivative {
  id: string
  /** What kind of variation this is — color shift vs content rewrite. */
  kind: 'color' | 'content'
  /** Short human label (e.g. "Cool mist", "Pricing page reframe"). */
  label: string
  /** For multi-page items (link kind), which page this derivative is based on. */
  parentPageName?: string
  /** Single-file HTML (inline CSS) the model produced. */
  html: string
  /** Rendered preview screenshot (data: URL) — used as the card thumbnail. */
  screenshot?: string
  /** Palette override applied (color variations only). */
  palette?: PaletteRole[]
  /** User-supplied prompt that drove the rewrite (content variations only). */
  contentPrompt?: string
  createdAt: number
  /** Set if generation or capture failed — UI shows a retry. */
  error?: string
}

/* ============================================================
   DESIGN.md analysis model — features 1 (link) and 2 (image)
   Mirrors the awesome-design-md / Google Stitch DESIGN.md sections.
   ============================================================ */

export type CaptureStatus = 'queue' | 'scanning' | 'done'

export interface CapturedPage {
  name: string
  status: CaptureStatus
  /** First slice — used as a thumbnail (16:10 viewport tile). */
  screenshot?: string
  /** All vertical slices of the full page (stacked, they form the long image). */
  slices?: string[]
  /** Per-page replica prompt — written by a dedicated vision call on THIS page only. */
  replicaPrompt?: string
  /** Video-only: 1-2 sentence caption of what's happening at this keyframe. */
  motionDescription?: string
  bg?: string
}

export interface PaletteRole {
  hex: string
  role: string // semantic name: ink / paper / primary / accent / danger…
  pct?: number
}

export interface TypeFace {
  name: string
  sample: string
  weight?: string
  size?: string
  role?: string
}

export interface ComponentStyle {
  name: string
  count: number
  tokens: string // r:8 · h:36 · ink/paper
}

export interface IANode {
  lvl: number
  label: string
  meta?: string
}

export interface MotionRule {
  type: string
  easing: string
  dur: string
  bar: number
}

export interface A11yCheck {
  label: string
  grade: 'A' | 'B' | 'C'
  detail: string
}

/** What kind of design asset an image / page is. */
export type AssetType =
  | 'ui'
  | 'web-page'
  | 'video'
  | 'poster'
  | 'photo'
  | 'illustration'
  | 'palette'
  | 'typography'
  | 'logo'
  | 'icon'
  | 'texture'
  | 'other'

/**
 * Unified design analysis for a site OR an image. Sites fill the full set;
 * images fill a self-adapting subset (palette / mood / style / materials / …).
 */
export interface DesignDoc {
  url?: string
  title: string
  /** Whether this is usable as design reference (false → show a warning). */
  usable?: boolean
  /** Why it's not usable / low-confidence (when usable is false or confidence low). */
  reason?: string
  /** Detected asset category. */
  assetType?: AssetType
  /** Analysis confidence, 0–100. */
  confidence?: number
  /** Notes on what couldn't be extracted. */
  warnings?: string[]
  /** 1. Visual Theme & Atmosphere */
  theme: string
  /** narrative description / summary */
  description: string
  /** affective descriptors (warm / calm / playful …) */
  mood?: string[]
  /** visual style (flat / editorial / 3d / studio-photo …) */
  style?: string[]
  /** physical material reads (ceramic / linen / matte …) — objects & textures */
  materials?: string[]
  /** composition / layout note (image) */
  composition?: string
  pages: CapturedPage[]
  /** 2. Color Palette & Roles */
  palette: PaletteRole[]
  /** 3. Typography Rules */
  fonts: TypeFace[]
  /** 4. Component Stylings */
  components: ComponentStyle[]
  /** 5. Layout Principles */
  ia: IANode[]
  layoutNote?: string
  /** 6. Depth & Elevation */
  motion: MotionRule[]
  /** 7. Do's and Don'ts */
  dos?: string[]
  donts?: string[]
  /** 8. Responsive Behavior */
  responsive?: string
  /** Video-only: 1-2 sentence narrative of what happens across the sequence. */
  sequence?: string
  /** Video-only: short verb-phrases capturing motion kinds (pan-right, zoom-in…). */
  motionVerbs?: string[]
  /** Video-only: 1-2 sentence note on how scenes connect (cuts / pans / crossfades). */
  transitions?: string
  /** 9a. Replica prompt — recreate THIS page (exact hex/copy/layout/components). */
  replicaPrompt?: string
  /** 9b. Style prompt — apply this design system to a DIFFERENT page (no specific copy). */
  stylePrompt?: string
  /** Legacy single prompt — kept for backward compatibility; equals stylePrompt when both are present. */
  agentPrompt?: string
  a11y: A11yCheck[]
  tags: string[]
}

/* ============================================================
   AI routing — feature 4
   ============================================================ */

export interface RoutingSuggestion {
  collectionId: string
  name: string
  color: string
  confidence: number // 0..100
}

/* ============================================================
   AI provider settings — feature 5
   ============================================================ */

/** Provider category — decides how its API is called. */
export type ProviderKind = 'anthropic' | 'openai' | 'google' | 'openai-compatible'

/**
 * A user-created provider instance. Multiple instances of the same kind are
 * allowed (e.g. two `openai-compatible` providers: GLM and OpenRouter), each
 * with its own credentials and its own list of models.
 */
/**
 * One model offered by a provider. Modality (input/output channels) is the
 * authoritative capability marker. For known models it's auto-resolved from the
 * catalog (lib/catalog); for unknown ids (custom gateway models) the user can
 * override it here. Falls back to {input:[text],output:[text]} if neither.
 */
export interface ModelSpec {
  id: string
  modality?: {
    input: ('text' | 'image' | 'audio' | 'video')[]
    output: ('text' | 'image' | 'audio' | 'video')[]
  }
}

export interface Provider {
  id: string
  kind: ProviderKind
  brand?: string // preset brand id (drives the logo); absent for custom providers
  name: string // user label, e.g. "GLM"
  apiKey: string
  baseURL?: string // for openai-compatible / custom gateways
  models: ModelSpec[] // first entry is the default
}

/**
 * Functional roles a model is assigned to. Create providers once, then bind
 * each role to a provider instance + one of its models (roles may mix providers):
 *  - `design`  — image-input: screenshots → DESIGN.md (tasks A & B, also drives
 *                video keyframe analysis — videos are pre-extracted to images
 *                client-side, so any vision model works universally)
 *  - `derive`  — generates HTML derivatives (color variations + content rewrites)
 *                from an analyzed item's design system. Benefits from a strong
 *                code-aware text model (Claude / GPT family).
 *  - `routing` — text-only: classify an item into a collection (task C)
 */
export type AIRole = 'design' | 'derive' | 'routing'

/** Which provider instance + model serves a given role. */
export interface RoleBinding {
  providerId: string
  model: string
}

export interface AISettings {
  /** User-created provider instances. */
  providers: Provider[]
  /** Role → provider instance + model. */
  roles: Record<AIRole, RoleBinding>
  features: {
    captureScreenshots: boolean
    extractDesignDoc: boolean
    autoRoute: boolean
    routeThreshold: number // 0..100
  }
}

export interface AppSettings {
  theme: 'light' | 'dark'
  accent: string
  radius: 'sharp' | 'round' | 'full'
  density: 'compact' | 'comfortable' | 'spacious'
  cols: number
  ai: AISettings
}
