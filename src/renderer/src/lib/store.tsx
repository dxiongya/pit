/* eslint-disable react-refresh/only-export-components */
// store.tsx — global app state: settings, collections, library items.
// Settings persist through the main-process bridge (window.pit) with a
// localStorage fallback so the renderer also works in a plain browser.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type {
  AppSettings,
  CapturedPage,
  Collection,
  Item,
  ModelSpec,
  Provider,
  RoleBinding
} from './types'
import { BUILTIN_COLLECTIONS } from './mockData'
import {
  DEFAULT_AI_SETTINGS,
  analyzeImage,
  analyzeSiteShots,
  analyzeVideoFrames,
  captureSite,
  routeItem
} from './ai/provider'
import { lookupModel } from './catalog/lookup'

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}
function hostOf(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
/** Resolves to the data URL's intrinsic W/H ratio, or 0 if it can't be read. */
function measureAspect(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = (): void =>
      resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 0)
    img.onerror = (): void => resolve(0)
    img.src = dataUrl
  })
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  accent: '#e8624a',
  radius: 'round',
  density: 'comfortable',
  cols: 4,
  ai: DEFAULT_AI_SETTINGS
}

interface SettingsBridge {
  getSettings?: () => Promise<Partial<AppSettings> | null>
  setSettings?: (s: AppSettings) => Promise<void>
}

function settingsBridge(): SettingsBridge | undefined {
  return (window as unknown as { pit?: SettingsBridge }).pit
}

const LS_KEY = 'pit:settings'

async function loadSettings(): Promise<AppSettings> {
  const b = settingsBridge()
  try {
    if (b?.getSettings) {
      const s = await b.getSettings()
      if (s) return mergeSettings(s)
    }
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return mergeSettings(JSON.parse(raw))
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS
}

function mergeSettings(partial: Partial<AppSettings>): AppSettings {
  // Tolerate older persisted shapes: roles used `provider` before `providerId`,
  // and providers used to be a keyed object instead of an array.
  const migrate = (b: unknown): RoleBinding | undefined => {
    if (!b || typeof b !== 'object') return undefined
    const o = b as Record<string, unknown>
    const model = typeof o.model === 'string' ? o.model : ''
    const providerId =
      typeof o.providerId === 'string'
        ? o.providerId
        : typeof o.provider === 'string'
          ? o.provider
          : ''
    return providerId ? { providerId, model } : undefined
  }
  // tolerate older shapes: provider.models used to be string[] (no vision flag)
  // Use the shared heuristic — same logic the Settings UI uses for new models.
  // Migrate persisted ModelSpec from the old { id, vision?: bool } shape to
  // { id, modality? }. Catalog hits drop the override (catalog is source of
  // truth); cold-storage user data with vision:true becomes text+image input.
  const migrateProvider = (p: unknown): Provider => {
    const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
    const raw = Array.isArray(o.models) ? o.models : []
    const models: ModelSpec[] = raw.map((m) => {
      if (typeof m === 'string') return { id: m }
      const om = m as { id: string; vision?: boolean; modality?: ModelSpec['modality'] }
      if (om.modality) return { id: om.id, modality: om.modality }
      if (lookupModel(om.id)) return { id: om.id } // catalog covers it
      if (om.vision === true)
        return { id: om.id, modality: { input: ['text', 'image'], output: ['text'] } }
      return { id: om.id }
    })
    return { ...(o as unknown as Provider), models }
  }
  const pai = partial.ai
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    ai: {
      ...DEFAULT_AI_SETTINGS,
      ...(pai || {}),
      providers:
        Array.isArray(pai?.providers) && pai!.providers.length
          ? pai!.providers.map(migrateProvider)
          : DEFAULT_AI_SETTINGS.providers,
      roles: {
        design: migrate(pai?.roles?.design) || DEFAULT_AI_SETTINGS.roles.design,
        // Migration: the standalone `video` role was removed — video frames
        // are now analyzed by the `design` role (same modality, same model).
        // Any persisted roles.video is silently dropped on load.
        // `derive` is new — older settings won't have it; default to design's
        // provider so the codegen tab works out of the box if design is set.
        derive:
          migrate(pai?.roles?.derive) ||
          migrate(pai?.roles?.design) ||
          DEFAULT_AI_SETTINGS.roles.derive,
        routing: migrate(pai?.roles?.routing) || DEFAULT_AI_SETTINGS.roles.routing
      },
      features: {
        ...DEFAULT_AI_SETTINGS.features,
        ...(pai?.features || {}),
        // Migration: the old default threshold (80) was too conservative — it
        // pushed almost everything to Inbox. Lower it to the new default so
        // existing users benefit. Anyone who set a custom value is preserved.
        routeThreshold:
          pai?.features?.routeThreshold === undefined || pai.features.routeThreshold === 80
            ? DEFAULT_AI_SETTINGS.features.routeThreshold
            : pai.features.routeThreshold
      }
    }
  }
}

async function persistSettings(s: AppSettings): Promise<void> {
  const b = settingsBridge()
  try {
    if (b?.setSettings) await b.setSettings(s)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

interface StoreValue {
  settings: AppSettings
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  collections: Collection[]
  items: Item[]
  addCollection: (c: Collection) => void
  updateCollection: (id: string, patch: Partial<Collection>) => void
  removeCollection: (id: string) => void
  addItem: (item: Item) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  removeItem: (id: string) => void
  moveItem: (itemId: string, collectionId: string) => void
  /** Paste-to-import: add a pending card, then capture/analyze in the background. */
  importLink: (url: string) => void
  importImage: (dataUrl: string) => void
  /** Drag-to-import a video file (by local path). Extracts keyframes in main,
   *  routes through AI for motion analysis (Phase 2). cropRect (recorder
   *  region mode) is forwarded to ffmpeg before keyframe sampling. */
  importVideo: (
    path: string,
    originalName?: string,
    cropRect?: { x: number; y: number; w: number; h: number }
  ) => void
  /** Re-run AI analysis on an existing video item using its already-extracted
   *  keyframes. Useful when the first analyze pass failed (e.g. provider
   *  quota / geo block) and the user switched models in Settings. */
  reanalyzeVideo: (itemId: string) => void
}

interface PersistBridge {
  items?: {
    list: () => Promise<unknown[]>
    upsert: (item: { id: string }) => Promise<void>
    delete: (id: string) => Promise<void>
  }
  collections?: {
    list: () => Promise<unknown[]>
    upsert: (c: { id: string }) => Promise<void>
    delete: (id: string) => Promise<void>
  }
}
function persistBridge(): PersistBridge | undefined {
  return (window as unknown as { pit?: PersistBridge }).pit
}

const StoreCtx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  // Start with builtin collections only; user collections load from the DB.
  const [collections, setCollections] = useState<Collection[]>(BUILTIN_COLLECTIONS)
  const [items, setItems] = useState<Item[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s)
      setHydrated(true)
    })
  }, [])

  // Load persisted items + user collections from SQLite at startup.
  useEffect(() => {
    const b = persistBridge()
    if (!b?.items || !b?.collections) return
    void b.items.list().then((rows) => {
      const items = rows as Item[]
      // Migration: link items used to bake in span:2 — strip it so the new
      // masonry packs them on the same single-column grid as image cards.
      let touched = 0
      for (const i of items) {
        if (i.kind === 'link' && i.span === 2) {
          delete i.span
          touched++
          void b.items?.upsert(i)
        }
      }
      if (touched) console.info(`[pit] migrated ${touched} link items off legacy span:2`)
      setItems(items)
    })
    void b.collections.list().then((rows) => {
      const userCols = rows as Collection[]
      // Builtins are always present + come first; merge user collections after.
      setCollections([...BUILTIN_COLLECTIONS, ...userCols.filter((c) => !c.builtin)])
    })
  }, [])

  // persist on change (after initial hydration)
  useEffect(() => {
    if (hydrated) void persistSettings(settings)
  }, [settings, hydrated])

  // wire visual settings to <body> data-attrs + CSS vars (same as the demo)
  useEffect(() => {
    document.body.dataset.theme = settings.theme
    document.body.dataset.radius = settings.radius
    document.body.dataset.density = settings.density
    document.body.dataset.cols = String(settings.cols)
    document.documentElement.style.setProperty('--accent', settings.accent)
  }, [settings.theme, settings.radius, settings.density, settings.cols, settings.accent])

  const setSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const addCollection = useCallback((c: Collection) => {
    setCollections((cs) => [...cs, c])
    if (!c.builtin) void persistBridge()?.collections?.upsert(c)
  }, [])
  const updateCollection = useCallback((id: string, patch: Partial<Collection>) => {
    setCollections((cs) => {
      const next = cs.map((c) => (c.id === id ? { ...c, ...patch } : c))
      const merged = next.find((c) => c.id === id)
      if (merged && !merged.builtin) void persistBridge()?.collections?.upsert(merged)
      return next
    })
  }, [])
  const removeCollection = useCallback((id: string) => {
    setCollections((cs) => cs.filter((c) => c.id !== id))
    setItems((it) => it.map((i) => (i.collection === id ? { ...i, collection: 'inbox' } : i)))
    void persistBridge()?.collections?.delete(id)
  }, [])

  const addItem = useCallback((item: Item) => {
    setItems((it) => [item, ...it])
    void persistBridge()?.items?.upsert(item)
  }, [])
  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((it) => {
      const next = it.map((i) => (i.id === id ? { ...i, ...patch } : i))
      const merged = next.find((i) => i.id === id)
      // Skip persisting in-flight stream chunks — too noisy + huge text.
      if (merged && !('streamText' in patch && Object.keys(patch).length === 1)) {
        void persistBridge()?.items?.upsert(merged)
      }
      return next
    })
  }, [])
  const removeItem = useCallback((id: string) => {
    setItems((it) => it.filter((i) => i.id !== id))
    void persistBridge()?.items?.delete(id)
  }, [])
  // moveItem must be declared before importImage/importLink — they call it for auto-routing.
  const moveItem = useCallback((itemId: string, collectionId: string) => {
    setItems((it) => {
      const next = it.map((i) => (i.id === itemId ? { ...i, collection: collectionId } : i))
      const moved = next.find((i) => i.id === itemId)
      if (moved) void persistBridge()?.items?.upsert(moved)
      return next
    })
  }, [])
  const importImage = useCallback(
    (dataUrl: string) => {
      const id = uid()
      addItem({
        id,
        kind: 'image',
        collection: 'inbox',
        title: 'Pasted image',
        screenshot: dataUrl,
        status: 'analyzing',
        progress: 'Analyzing image…',
        createdAt: Date.now()
      })
      // Measure the real aspect so the card lays out at the image's ratio
      // (no cropping, no forced-square).
      measureAspect(dataUrl).then((a) => a && updateItem(id, { aspect: a }))
      let stream = ''
      void (async () => {
        try {
          const { doc, source, error } = await analyzeImage(
            dataUrl,
            'Pasted image',
            settings.ai,
            (c) => {
              stream += c
              updateItem(id, { streamText: stream })
            }
          )
          updateItem(id, {
            status: 'ready',
            design: doc,
            title: doc.title || 'Pasted image',
            tags: doc.tags,
            prompt: doc.agentPrompt,
            palette: doc.palette?.map((p) => p.hex),
            progress: undefined,
            error: source === 'mock' ? error : undefined
          })
          // Auto-route: ask the routing model which collection's description
          // best matches; move there if it beats the threshold.
          if (settings.ai.features.autoRoute) {
            void routeItem(
              {
                title: doc.title || 'Pasted image',
                prompt: doc.description || doc.stylePrompt,
                tags: doc.tags
              },
              collections,
              settings.ai
            ).then((r) => {
              if (r.best && r.best !== 'inbox') moveItem(id, r.best)
            })
          }
        } catch (e) {
          updateItem(id, { status: 'failed', error: e instanceof Error ? e.message : 'failed' })
        }
      })()
    },
    [settings.ai, collections, addItem, updateItem, moveItem]
  )
  const importLink = useCallback(
    (url: string) => {
      const id = uid()
      addItem({
        id,
        kind: 'link',
        collection: 'inbox',
        title: hostOf(url),
        url,
        // span:1 (one column) — same width as image cards, so masonry can pack
        // them densely. The old span:2 forced sites to be 2× taller than
        // neighbouring image cards and created huge blank rows.
        status: 'analyzing',
        progress: 'Capturing…',
        createdAt: Date.now()
      })
      let stream = ''
      void (async () => {
        try {
          const shots: string[] = []
          const captured: CapturedPage[] = []
          let thumb: string | undefined
          let pages = 0
          await captureSite(url, (p) => {
            pages += 1
            if (p.slices?.length) {
              // link cards are forced to a 16:10 viewport ratio in Masonry,
              // so no measureAspect needed here (slice geometry ≠ viewport).
              if (!thumb) thumb = p.slices[0]
              // 2 representative slices/page keeps the total request bounded
              shots.push(...p.slices.slice(0, 2))
              // Keep ALL slices so the detail view can render the full long image
              // (slice[0] alone is just the first 1400css px of a much taller page).
              captured.push({
                name: p.name,
                status: 'done',
                screenshot: p.slices[0],
                slices: p.slices
              })
            } else {
              captured.push({ name: p.name, status: 'queue' })
            }
            updateItem(id, {
              screenshot: thumb,
              progress: `Captured ${pages} page${pages > 1 ? 's' : ''}…`,
              // push a snapshot so AnalyzingDetail can show per-page thumbs live
              capturedPages: [...captured]
            })
          })
          updateItem(id, { progress: 'Analyzing design…' })
          // Send the per-page structure (name + slices) so vision can produce a
          // per-page replica prompt for each — previously we flattened to a slice
          // array and the model mixed multiple pages into one bogus replica.
          const pagesForAnalysis = captured
            .filter((p) => p.slices?.length)
            .map((p) => ({ name: p.name, slices: (p.slices || []).slice(0, 3) }))
          const { doc, perPageReplicas, source, error } = await analyzeSiteShots(
            pagesForAnalysis,
            url,
            settings.ai,
            (c) => {
              stream += c
              updateItem(id, { streamText: stream })
            }
          )
          // Merge each page's replica prompt back onto its CapturedPage entry.
          const pagesWithReplicas = captured.map((p) => ({
            ...p,
            replicaPrompt: perPageReplicas?.[p.name]
          }))
          updateItem(id, {
            status: 'ready',
            // Real captured pages (with their replica prompts) replace the
            // vision JSON's (often empty) pages array.
            design: { ...doc, pages: pagesWithReplicas },
            title: doc.title || hostOf(url),
            tags: doc.tags,
            // For sites: use the assembled stylePrompt as the item-level prompt.
            prompt: doc.stylePrompt || doc.agentPrompt,
            palette: doc.palette?.map((p) => p.hex),
            screenshot: shots[0],
            progress: undefined,
            error: source === 'mock' ? error : undefined
          })
          // Auto-route: ask the routing model which collection's description
          // best matches; move there if it beats the threshold.
          if (settings.ai.features.autoRoute) {
            void routeItem(
              {
                title: doc.title || hostOf(url),
                prompt: doc.description || doc.stylePrompt,
                tags: doc.tags
              },
              collections,
              settings.ai
            ).then((r) => {
              if (r.best && r.best !== 'inbox') moveItem(id, r.best)
            })
          }
        } catch (e) {
          updateItem(id, { status: 'failed', error: e instanceof Error ? e.message : 'failed' })
        }
      })()
    },
    [settings.ai, collections, addItem, updateItem, moveItem]
  )

  // Video import — drag-in / paste a local video file. ffmpeg in main extracts
  // ~8 deduped keyframes; we store them as design.pages (mirroring link items)
  // so the existing detail/share plumbing renders them as-is. Phase 2 will route
  // through analyzeVideo for motion-aware AI.
  const importVideo = useCallback(
    (
      path: string,
      originalName?: string,
      cropRect?: { x: number; y: number; w: number; h: number }
    ) => {
      const id = uid()
      const title =
        originalName?.replace(/\.[^.]+$/, '') ||
        path
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, '') ||
        'Video'
      addItem({
        id,
        kind: 'video',
        collection: 'inbox',
        title,
        status: 'analyzing',
        progress: 'Extracting keyframes…',
        createdAt: Date.now()
      })
      let stream = ''
      void (async () => {
        try {
          // Phase 1 — frame extraction (ffmpeg in main, optional crop for
          // recorder region mode).
          const r = await window.pit.video.extract({ path, target: 8, cropRect })
          const pages = r.frames.map((f, i) => ({
            name: `Frame ${i + 1}`,
            status: 'done' as const,
            screenshot: f
          }))
          updateItem(id, {
            screenshot: r.frames[0],
            progress: `Analyzing ${r.frames.length} frames…`,
            // Show frames immediately so the user gets something to look at
            // while AI is thinking.
            design: {
              title,
              theme: '',
              description: '',
              pages,
              palette: [],
              fonts: [],
              components: [],
              ia: [],
              motion: [],
              a11y: [],
              tags: []
            }
          })

          // Phase 2 — single batched vision call. Returns design tokens +
          // sequence/transitions/motionVerbs + per-frame motion captions + a
          // SINGLE unified replicaPrompt covering the whole composition (a
          // video is one design seen from N camera positions, not N designs).
          const { doc, motionDescriptions, source, error } = await analyzeVideoFrames(
            r.frames,
            title,
            settings.ai,
            (c) => {
              stream += c
              updateItem(id, { streamText: stream })
            },
            { durationSec: r.durationSec }
          )
          // Only the motion caption is per-frame now; replica lives on doc.
          const pagesWithMotion = pages.map((p, i) => ({
            ...p,
            motionDescription: motionDescriptions?.[i]
          }))
          updateItem(id, {
            status: 'ready',
            design: { ...doc, pages: pagesWithMotion },
            title: doc.title || title,
            tags: doc.tags,
            prompt: doc.stylePrompt || doc.agentPrompt,
            palette: doc.palette?.map((p) => p.hex),
            progress: undefined,
            error: source === 'mock' ? error : undefined
          })

          // Auto-route — same pattern as importImage / importLink.
          if (settings.ai.features.autoRoute) {
            void routeItem(
              {
                title: doc.title || title,
                prompt: doc.sequence || doc.description || doc.stylePrompt,
                tags: doc.tags
              },
              collections,
              settings.ai
            ).then((rr) => {
              if (rr.best && rr.best !== 'inbox') moveItem(id, rr.best)
            })
          }
        } catch (e) {
          updateItem(id, {
            status: 'failed',
            error: e instanceof Error ? e.message : 'video import failed'
          })
        }
      })()
    },
    [settings.ai, collections, addItem, updateItem, moveItem]
  )

  // Re-run analysis on an existing video item (frames already in DB) — the
  // user typically lands here after the first attempt failed (provider quota
  // / geo block) and they fixed it via Settings + want to retry without
  // re-recording the source.
  const reanalyzeVideo = useCallback(
    (itemId: string) => {
      const it = items.find((x) => x.id === itemId)
      if (!it || it.kind !== 'video') return
      const frames = (it.design?.pages || [])
        .map((p) => p.screenshot)
        .filter((f): f is string => typeof f === 'string' && f.length > 0)
      if (!frames.length) return
      updateItem(itemId, {
        status: 'analyzing',
        progress: 'Re-analyzing…',
        streamText: '',
        error: undefined
      })
      let stream = ''
      void (async () => {
        try {
          const title = it.title || 'Video'
          const { doc, motionDescriptions, source, error } = await analyzeVideoFrames(
            frames,
            title,
            settings.ai,
            (c) => {
              stream += c
              updateItem(itemId, { streamText: stream })
            }
          )
          const pages = (it.design?.pages || []).map((p, i) => ({
            ...p,
            motionDescription: motionDescriptions?.[i]
          }))
          updateItem(itemId, {
            status: 'ready',
            design: { ...doc, pages },
            title: doc.title || title,
            tags: doc.tags,
            prompt: doc.stylePrompt || doc.agentPrompt,
            palette: doc.palette?.map((p) => p.hex),
            progress: undefined,
            error: source === 'mock' ? error : undefined
          })
        } catch (e) {
          updateItem(itemId, {
            status: 'failed',
            error: e instanceof Error ? e.message : 're-analysis failed'
          })
        }
      })()
    },
    [items, settings.ai, updateItem]
  )

  const value = useMemo<StoreValue>(
    () => ({
      settings,
      setSetting,
      updateSettings,
      collections,
      items,
      addCollection,
      updateCollection,
      removeCollection,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      importLink,
      importImage,
      importVideo,
      reanalyzeVideo
    }),
    [
      settings,
      setSetting,
      updateSettings,
      collections,
      items,
      addCollection,
      updateCollection,
      removeCollection,
      addItem,
      updateItem,
      removeItem,
      moveItem,
      importLink,
      importImage,
      importVideo,
      reanalyzeVideo
    ]
  )

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore(): StoreValue {
  const v = useContext(StoreCtx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
