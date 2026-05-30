// provider.ts — AI capability layer for pit.
//
// Providers are user-created instances (any number, any kind). Each functional
// role (`design`, `routing`) binds to a provider instance + one of its models,
// and roles may use different providers. This file resolves a role to a concrete
// request and is the single seam to the main process (`window.pit`). Capture,
// analyze, routing and testConnection are all wired to real main-process IPC;
// the mock DesignDoc / offline routing heuristic only kick in when a provider is
// unconfigured or a call throws (e.g. the bridge isn't reloaded), not by default.

import type {
  AIRole,
  AISettings,
  Collection,
  DesignDoc,
  Item,
  ModelSpec,
  Provider,
  ProviderKind,
  RoutingSuggestion
} from '../types'
import { LINK_DESIGN_DOC } from '../mockData'
import type { Modality, ModelModality } from '../catalog/types'
import { lookupModel } from '../catalog/lookup'
// Canonical IPC contract types (shared with preload + main). Re-exported below
// so existing consumers of these names from this module keep working.
import type { RoleRequest, RouteInput, RoutingResult, CapturedPage } from '../../../../shared/ipc'
export type { RoleRequest, RoutingResult, CapturedPage }

/** Per-kind metadata: how it's called, defaults, and UI hints. */
export const KIND_META: Record<
  ProviderKind,
  {
    name: string
    short: string // badge label
    color: string
    mark: string
    needsBaseURL?: boolean
    defaultModels: string[]
  }
> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    short: 'Anthropic',
    color: '#e8624a',
    mark: 'C',
    defaultModels: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']
  },
  openai: {
    name: 'OpenAI',
    short: 'OpenAI',
    color: '#10a37f',
    mark: 'O',
    defaultModels: ['gpt-5-5', 'gpt-5-4', 'gpt-5-4-mini']
  },
  google: {
    name: 'Google (Gemini)',
    short: 'Gemini',
    color: '#4285f4',
    mark: 'G',
    defaultModels: ['gemini-2-5-pro', 'gemini-2-5-flash']
  },
  'openai-compatible': {
    name: 'OpenAI Compatible',
    short: 'OpenAI Compatible',
    color: '#6e6e73',
    mark: '∿',
    needsBaseURL: true,
    defaultModels: []
  }
}

export const PROVIDER_KINDS = Object.keys(KIND_META) as ProviderKind[]

/** What modality on input a role minimally needs to function. */
export const ROLE_META: Record<AIRole, { name: string; desc: string; needsInput?: Modality }> = {
  design: {
    name: 'Design understanding',
    desc: 'Reads page/image/video-keyframe screenshots → DESIGN.md (palette, type, components, layout, motion, a11y). Needs an image-input model — videos are pre-extracted to keyframes locally, so any vision model works.',
    needsInput: 'image'
  },
  derive: {
    name: 'Derive · codegen',
    desc: 'Generates HTML derivatives — same design system, different palette or different content — from an analyzed item. Benefits from a strong code-aware text model (Claude / GPT family).'
  },
  routing: {
    name: 'Routing · auto-classify',
    desc: 'Sorts each new item into the best-matching collection, based on its summary/tags and each collection’s prompt. A small, fast text model is ideal.'
  }
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  providers: [
    {
      id: 'anthropic',
      kind: 'anthropic',
      brand: 'anthropic',
      name: 'Anthropic',
      apiKey: '',
      // modality is auto-resolved from the catalog at runtime
      models: [{ id: 'claude-opus-4-7' }, { id: 'claude-haiku-4-5' }]
    },
    {
      id: 'openai',
      kind: 'openai',
      brand: 'openai',
      name: 'OpenAI',
      apiKey: '',
      models: [{ id: 'gpt-5-5' }, { id: 'gpt-5-4-mini' }]
    },
    {
      id: 'google',
      kind: 'google',
      brand: 'google',
      name: 'Google',
      apiKey: '',
      // Gemini is the only family with video-input today, so it ships as a default
      models: [{ id: 'gemini-2-5-pro' }, { id: 'gemini-2-5-flash' }]
    }
  ],
  roles: {
    design: { providerId: 'anthropic', model: 'claude-opus-4-7' },
    derive: { providerId: 'anthropic', model: 'claude-opus-4-7' },
    routing: { providerId: 'anthropic', model: 'claude-haiku-4-5' }
  },
  features: {
    captureScreenshots: true,
    extractDesignDoc: true,
    autoRoute: true,
    // Lower default — the routing model is much smarter than tag-overlap was;
    // 80 was too conservative and sent most items to Inbox. 55 commits a best
    // guess whenever any collection clearly fits better than Inbox.
    routeThreshold: 55
  }
}

export function newProviderId(): string {
  return `p_${Math.random().toString(36).slice(2, 9)}`
}

/** Default model of a provider (first entry). */
export function defaultModel(p: Provider): string {
  return p.models[0]?.id || ''
}

/**
 * Effective modality for a given model id on a provider:
 *  1. Look it up in the static catalog (covers all major vendor models).
 *  2. Else use the per-model override the user set in Settings (custom gateway).
 *  3. Else fall back to text-only.
 */
export function getModelModality(p: Provider, modelId: string): ModelModality {
  const cat = lookupModel(modelId)
  if (cat) return cat.modality
  const spec = p.models.find((m) => m.id === modelId)
  if (spec?.modality) return spec.modality
  return { input: ['text'], output: ['text'] }
}

/** Does the bound model accept this modality on input? Drives role warnings. */
export function supportsInput(p: Provider, modelId: string, modality: Modality): boolean {
  return getModelModality(p, modelId).input.includes(modality)
}

/** Convenience: model produces this output modality (image gen / TTS / video gen). */
export function producesOutput(p: Provider, modelId: string, modality: Modality): boolean {
  return getModelModality(p, modelId).output.includes(modality)
}

/**
 * Modality to seed onto a fresh ModelSpec for a model id the user just typed.
 * Catalog-known ids get nothing here (lookup at use-time is the source of truth);
 * unknown ids get a text-only default the user can widen via the modality toggles.
 */
export function modalityForNewModel(id: string): ModelSpec['modality'] | undefined {
  if (lookupModel(id)) return undefined // catalog covers it
  return { input: ['text'], output: ['text'] }
}

/** Is the provider usable (key present, or a local baseURL that needs none)? */
export function isProviderConfigured(p: Provider): boolean {
  return Boolean(p.apiKey) || (p.kind === 'openai-compatible' && Boolean(p.baseURL))
}

export function findProvider(settings: AISettings, providerId: string): Provider | undefined {
  return settings.providers.find((p) => p.id === providerId)
}

/** Resolve a role to its provider instance + model (with a sane fallback). */
export function resolveRole(
  settings: AISettings,
  role: AIRole
): { provider?: Provider; model: string } {
  const binding = settings.roles[role]
  const provider = findProvider(settings, binding.providerId) || settings.providers[0]
  const model = binding.model || (provider ? defaultModel(provider) : '')
  return { provider, model }
}

/** A short "Name · model" label for role/option display. */
export function bindingLabel(
  settings: AISettings,
  binding: { providerId: string; model: string }
): string {
  const p = findProvider(settings, binding.providerId)
  if (!p) return 'Unassigned'
  return `${p.name} · ${binding.model || defaultModel(p)}`
}

/* ============================================================
   Routing — feature 4. Local heuristic (offline fallback / live preview).
   ============================================================ */

export function scoreItemForCollection(item: Item, collection: Collection): number {
  if (collection.builtin) return 0
  let s = 30
  const tags = item.tags || []
  for (const t of tags) {
    if (collection.tags?.includes(t)) s += 18
    if (collection.skip?.includes(t)) s -= 30
  }
  return Math.max(0, Math.min(100, s))
}

/** Rank user collections for an item, best first. */
export function rankCollections(item: Item, collections: Collection[]): RoutingSuggestion[] {
  return collections
    .filter((c) => !c.builtin)
    .map((c) => ({
      collectionId: c.id,
      name: c.name,
      color: c.color,
      confidence: scoreItemForCollection(item, c)
    }))
    .sort((a, b) => b.confidence - a.confidence)
}

/** Score arbitrary tag sets against a collection draft (used by New Collection preview). */
export function draftMatchScore(
  itemTags: string[],
  selectedTags: Set<string>,
  skip: Set<string>
): number {
  let s = 30
  for (const t of itemTags) {
    if (selectedTags.has(t)) s += 18
    if (skip.has(t)) s -= 30
  }
  return Math.max(0, Math.min(100, s))
}

/* ============================================================
   Bridge to the main process (real capture + AI), with mock fallback.
   ============================================================ */

/** Concrete request the main process needs to call a provider. */
export function providerRequest(provider: Provider, model: string): RoleRequest {
  return {
    kind: provider.kind,
    name: provider.name,
    model,
    apiKey: provider.apiKey,
    baseURL: provider.baseURL
  }
}

interface PitBridge {
  captureSite?: (url: string, onPage: (page: CapturedPage) => void) => Promise<CapturedPage[]>
  analyzeSite?: (
    pages: { name: string; slices: string[] }[],
    req: RoleRequest,
    onChunk: (chunk: string) => void
  ) => Promise<DesignDoc & { perPageReplicas?: Record<string, string> }>
  analyzeImage?: (dataUrl: string, req: RoleRequest) => Promise<DesignDoc>
  analyzeImageStream?: (
    dataUrl: string,
    req: RoleRequest,
    onChunk: (chunk: string) => void
  ) => Promise<DesignDoc>
  analyzeVideo?: (
    frames: string[],
    req: RoleRequest,
    onChunk: (chunk: string) => void,
    meta?: { durationSec?: number; title?: string }
  ) => Promise<DesignDoc & { motionDescriptions?: string[] }>
  testConnection?: (req: RoleRequest) => Promise<{ ok: boolean; message: string }>
  route?: (input: RouteInput) => Promise<RoutingResult>
  suggestCollectionDescription?: (input: {
    req: RoleRequest
    name: string
    hint?: string
  }) => Promise<string>
}

function bridge(): PitBridge | undefined {
  return (window as unknown as { pit?: PitBridge }).pit
}

/**
 * Route an item into a collection using the `routing` role. Calls the real
 * provider when one is configured; otherwise falls back to the local heuristic
 * (so behavior matches the New Collection live preview offline).
 */
export async function routeItem(
  item: { title?: string; prompt?: string; tags?: string[] },
  collections: Collection[],
  settings: AISettings
): Promise<RoutingResult> {
  const b = bridge()
  const { provider, model } = resolveRole(settings, 'routing')
  if (b?.route && provider && isProviderConfigured(provider)) {
    try {
      return await b.route({
        req: providerRequest(provider, model),
        item: { title: item.title, description: item.prompt, tags: item.tags },
        collections: collections
          .filter((c) => !c.builtin)
          .map((c) => ({ id: c.id, name: c.name, prompt: c.prompt, tags: c.tags, skip: c.skip })),
        threshold: settings.features.routeThreshold
      })
    } catch {
      /* fall through to heuristic */
    }
  }
  const ranked = rankCollections(item as Item, collections)
  const top = ranked[0]
  const best =
    top && top.confidence >= settings.features.routeThreshold ? top.collectionId : 'inbox'
  return {
    suggestions: ranked.map((r) => ({
      collectionId: r.collectionId,
      confidence: r.confidence,
      reason: 'tag overlap'
    })),
    best
  }
}

/**
 * One-shot AI suggestion for a collection description, fired by the "Suggest"
 * button on the New Collection form. Uses the routing role (text-only, cheap).
 * Returns '' if no routing model is configured — the UI then shows a hint.
 */
export async function suggestCollectionDescription(
  name: string,
  hint: string,
  settings: AISettings
): Promise<{ text: string; error?: string }> {
  const b = bridge()
  if (!b?.suggestCollectionDescription)
    return { text: '', error: 'Restart the app to enable AI suggestions.' }
  const { provider, model } = resolveRole(settings, 'routing')
  if (!provider || !isProviderConfigured(provider))
    return { text: '', error: 'No routing model configured — add an API key in Settings.' }
  try {
    const text = await b.suggestCollectionDescription({
      req: providerRequest(provider, model),
      name,
      hint
    })
    return { text }
  } catch (e) {
    return { text: '', error: e instanceof Error ? e.message : 'Suggestion failed' }
  }
}

/**
 * Legacy mock site doc — used by LinkDetail/ImportFlow until they read the
 * item's saved `design`. Real capture + analysis lives in `captureSite` +
 * `analyzeSiteShots` (driven by the background import in the store).
 */
export async function analyzeSite(url: string): Promise<DesignDoc> {
  return { ...LINK_DESIGN_DOC, url, title: titleFromUrl(url) }
}

const EMPTY_DOC: Pick<
  DesignDoc,
  | 'pages'
  | 'fonts'
  | 'components'
  | 'ia'
  | 'motion'
  | 'a11y'
  | 'palette'
  | 'tags'
  | 'theme'
  | 'description'
> = {
  pages: [],
  fonts: [],
  components: [],
  ia: [],
  motion: [],
  a11y: [],
  palette: [],
  tags: [],
  theme: '',
  description: ''
}

/**
 * Fields the AI sometimes returns as an object instead of a string (e.g.
 * `responsive: { breakpoints, touch, collapse }` when the prompt schema lists
 * sub-aspects). Coerce them to strings at the boundary so the renderer can
 * trust the shape and a stale model can't crash the detail view.
 *
 * Strings are kept verbatim; arrays + objects get flattened into readable
 * `key: value` lines (no analysis is lost — just laid out differently).
 */
const TEXT_FIELDS = [
  'title',
  'theme',
  'description',
  'responsive',
  'layoutNote',
  'composition',
  'stylePrompt',
  'agentPrompt',
  'replicaPrompt',
  'sequence',
  'transitions'
] as const
function flattenForRender(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean' || typeof v === 'function') return ''
  if (Array.isArray(v)) {
    return v.map((x) => flattenForRender(x)).filter((s) => s.length > 0).join(' · ')
  }
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const s = flattenForRender(val)
        return s ? `${k}: ${s}` : ''
      })
      .filter(Boolean)
      .join('\n')
  }
  return ''
}
function coerceDocStrings<T extends Record<string, unknown>>(doc: T): T {
  const out = { ...doc }
  for (const f of TEXT_FIELDS) {
    const v = out[f]
    if (v !== undefined && typeof v !== 'string') {
      ;(out as Record<string, unknown>)[f] = flattenForRender(v)
    }
  }
  return out
}

/**
 * Analyze an image → DesignDoc (uses the `design` role's vision model). Calls the
 * real provider when one is configured; otherwise returns a mock. Real results
 * are normalized so missing site-only arrays don't break the UI.
 */
export interface AnalyzeResult {
  doc: DesignDoc
  source: 'real' | 'mock'
  error?: string
}

export async function analyzeImage(
  dataUrl: string,
  title = 'Imported image',
  settings?: AISettings,
  onChunk?: (chunk: string) => void
): Promise<AnalyzeResult> {
  const b = bridge()
  const mock = (): DesignDoc => ({
    ...LINK_DESIGN_DOC,
    url: undefined,
    usable: true,
    assetType: 'photo',
    title,
    pages: [],
    description:
      'A studio image with a strong material palette — warm low-chroma tones, soft raking light, deep shadow. (Sample data; configure a design model to analyze the real image.)'
  })
  if (!settings) return { doc: mock(), source: 'mock' }
  const { provider, model } = resolveRole(settings, 'design')
  const stream = b?.analyzeImageStream
  const once = b?.analyzeImage
  if (!stream && !once)
    return {
      doc: mock(),
      source: 'mock',
      error: 'Restart the app to enable image analysis (preload not loaded yet).'
    }
  if (!provider || !isProviderConfigured(provider))
    return {
      doc: mock(),
      source: 'mock',
      error: 'No design model configured — add an API key in Settings.'
    }
  try {
    const req = providerRequest(provider, model)
    const raw =
      onChunk && stream
        ? await stream(dataUrl, req, onChunk)
        : once
          ? await once(dataUrl, req)
          : await stream!(dataUrl, req, () => {})
    return {
      doc: coerceDocStrings({ ...EMPTY_DOC, ...raw, title: raw.title || title }),
      source: 'real'
    }
  } catch (e) {
    return {
      doc: mock(),
      source: 'mock',
      error: e instanceof Error ? e.message : 'Analysis failed'
    }
  }
}

/**
 * Capture a site's pages as full-page screenshots, streaming each one back via
 * `onPage` (for live placeholder cards). Empty array when no backend (mock).
 */
export async function captureSite(
  url: string,
  onPage: (page: CapturedPage) => void
): Promise<CapturedPage[]> {
  const b = bridge()
  if (b?.captureSite) return b.captureSite(url, onPage)
  return []
}

/**
 * Analyze captured screenshots → DesignDoc using the `design` role's vision
 * model (focused on design + component style). Streams thinking via `onChunk`;
 * falls back to mock with an explanatory error otherwise.
 */
export async function analyzeSiteShots(
  pages: { name: string; slices: string[] }[],
  url: string,
  settings?: AISettings,
  onChunk?: (chunk: string) => void
): Promise<AnalyzeResult & { perPageReplicas?: Record<string, string> }> {
  const b = bridge()
  const title = titleFromUrl(url)
  const mock = (): DesignDoc => ({
    ...LINK_DESIGN_DOC,
    url,
    usable: true,
    assetType: 'web-page',
    title
  })
  if (!settings) return { doc: mock(), source: 'mock' }
  const { provider, model } = resolveRole(settings, 'design')
  if (!b?.analyzeSite)
    return {
      doc: mock(),
      source: 'mock',
      error: 'Restart the app to enable site analysis (preload not loaded yet).'
    }
  if (!provider || !isProviderConfigured(provider))
    return {
      doc: mock(),
      source: 'mock',
      error: 'No design model configured — add an API key in Settings.'
    }
  if (!pages.length)
    return { doc: mock(), source: 'mock', error: 'No screenshots could be captured for this site.' }
  try {
    const req = providerRequest(provider, model)
    const raw = await b.analyzeSite(pages, req, onChunk || (() => {}))
    const perPageReplicas = raw.perPageReplicas
    return {
      doc: coerceDocStrings({
        ...EMPTY_DOC,
        ...raw,
        url,
        title: raw.title || title,
        assetType: raw.assetType || 'web-page'
      }),
      perPageReplicas,
      source: 'real'
    }
  } catch (e) {
    return {
      doc: mock(),
      source: 'mock',
      error: e instanceof Error ? e.message : 'Analysis failed'
    }
  }
}

/**
 * Analyze a video's keyframes → DesignDoc. Routes through the `video` role's
 * vision model when configured; falls back to the `design` role (most users
 * only bind `design`), then to a mock with an explanatory error.
 */
export async function analyzeVideoFrames(
  frames: string[],
  title: string,
  settings: AISettings,
  onChunk?: (chunk: string) => void,
  meta?: { durationSec?: number }
): Promise<AnalyzeResult & { motionDescriptions?: string[] }> {
  const b = bridge()
  const mock = (): DesignDoc => ({
    ...EMPTY_DOC,
    url: undefined,
    usable: true,
    assetType: 'video',
    title,
    description:
      'A short motion sequence. (Sample data; configure a design or video model to analyze the real frames.)'
  })
  if (!b?.analyzeVideo) {
    return {
      doc: mock(),
      source: 'mock',
      error: 'Restart the app to enable video analysis (preload not loaded yet).'
    }
  }
  // Video frames are pre-extracted to images locally — same modality as the
  // `design` role, so we route through it uniformly. Avoids a separate role
  // binding the user has to configure for what's really the same need.
  const { provider, model } = resolveRole(settings, 'design')
  if (!provider || !isProviderConfigured(provider)) {
    return {
      doc: mock(),
      source: 'mock',
      error: 'No design model configured — add an API key in Settings.'
    }
  }
  if (!frames.length) {
    return {
      doc: mock(),
      source: 'mock',
      error: 'No keyframes were extracted from the video.'
    }
  }
  try {
    const req = providerRequest(provider, model)
    const raw = await b.analyzeVideo(frames, req, onChunk || (() => {}), {
      durationSec: meta?.durationSec,
      title
    })
    return {
      doc: coerceDocStrings({
        ...EMPTY_DOC,
        ...raw,
        title: raw.title || title,
        assetType: raw.assetType || 'video'
      }),
      motionDescriptions: raw.motionDescriptions,
      source: 'real'
    }
  } catch (e) {
    return {
      doc: mock(),
      source: 'mock',
      error: e instanceof Error ? e.message : 'Analysis failed'
    }
  }
}

/**
 * Derive HTML variants — resolves the `derive` role (falls back to `design`
 * since they share the same model class) and calls into the main process
 * through window.pit.derive.{proposePalettes,run}. UI components stay
 * provider-agnostic.
 */
function deriveReq(settings: AISettings): RoleRequest | null {
  let { provider, model } = resolveRole(settings, 'derive')
  if (!provider || !isProviderConfigured(provider)) {
    const d = resolveRole(settings, 'design')
    provider = d.provider
    model = d.model
  }
  if (!provider || !isProviderConfigured(provider)) return null
  return providerRequest(provider, model)
}

export async function proposePalettes(
  palette: { hex: string; role?: string; pct?: number }[],
  count: number,
  settings: AISettings
): Promise<{ label: string; palette: { hex: string; role?: string; pct?: number }[] }[]> {
  const b = bridge() as PitBridge & {
    derive?: {
      proposePalettes: (
        input: {
          req: RoleRequest
          palette: { hex: string; role?: string; pct?: number }[]
          count?: number
        }
      ) => Promise<{ label: string; palette: { hex: string; role?: string; pct?: number }[] }[]>
    }
  }
  const req = deriveReq(settings)
  if (!b?.derive || !req) return []
  return b.derive.proposePalettes({ req, palette, count })
}

export async function runDerive(
  input: {
    replicaPrompt: string
    designTokens?: {
      theme?: string
      fonts?: { name?: string; weight?: string; size?: string; role?: string }[]
      layoutNote?: string
    }
    palette?: { hex: string; role?: string; pct?: number }[]
    contentPrompt?: string
  },
  settings: AISettings
): Promise<{ html: string; screenshot?: string; error?: string }> {
  const b = bridge() as PitBridge & {
    derive?: {
      run: (
        input: {
          req: RoleRequest
          replicaPrompt: string
          designTokens?: {
            theme?: string
            fonts?: { name?: string; weight?: string; size?: string; role?: string }[]
            layoutNote?: string
          }
          palette?: { hex: string; role?: string; pct?: number }[]
          contentPrompt?: string
        }
      ) => Promise<{ html: string; screenshot?: string; error?: string }>
    }
  }
  const req = deriveReq(settings)
  if (!b?.derive || !req) {
    return { html: '', error: 'No derive/design model configured — add one in Settings.' }
  }
  return b.derive.run({ req, ...input })
}

/** Verify a concrete provider request (per provider, or per model in the editor). */
export async function testProvider(req: RoleRequest): Promise<{ ok: boolean; message: string }> {
  const b = bridge()
  if (b?.testConnection) return b.testConnection(req)
  // browser fallback (no main process): can only sanity-check config
  if (!req.apiKey && req.kind !== 'openai-compatible')
    return { ok: false, message: 'No API key set' }
  return { ok: true, message: 'Config OK (no backend)' }
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
