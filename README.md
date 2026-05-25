# pit

A design-material collector — capture links and images, let AI read their design
content (palette, type, components, layout…), and auto-route them into prompt-driven
collections. Electron + React + TypeScript. Visual language ported from Bottomless.

## Features

1. **Link import** — paste a URL, capture each page, and extract a `DESIGN.md`
   analysis (theme, palette & roles, typography, components, layout/IA, motion,
   do/don't, responsive, a11y, agent prompt) following the
   [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) spec.
2. **Image collection** — drop an image; pit extracts its palette, mood, materials,
   and style, then suggests where it belongs.
3. **Share** — public link + channel shortcuts, with an inline live preview.
4. **Collections & routing** — custom collections, each with a free-form **prompt**
   plus structured tags. The AI reads every collection's prompt to auto-route new
   items. The New Collection builder shows a live preview of what would land there.
5. **AI settings** — multi-provider, switchable: Anthropic / OpenAI / any
   OpenAI-compatible endpoint (Ollama, vLLM…). Capture & routing feature toggles.

## Architecture

```
src/
  main/
    index.ts        Electron window (hiddenInset titlebar) + IPC registration
    settings.ts     Durable settings (JSON in userData)
  preload/
    index.ts        window.pit bridge (settings today; capture/analyze reserved)
  renderer/src/
    App.tsx         Window shell + router + overlays
    styles/app.css  Full design system (tokens, themes, radius/density)
    lib/
      types.ts      Data model incl. the DESIGN.md schema
      mockData.ts   Seed library, collections, sample analysis
      icons.tsx     Line-icon set
      store.tsx     App state (settings/collections/items) + persistence
      ai/provider.ts  AI capability layer + routing heuristics + mock fallback
    components/     Sidebar, TopBar, Masonry/Card, Toast, RoutingRow
    views/          HomeView, CollectionView, ImportFlow, ImageImport,
                    NewCollectionView, SettingsView, detail/*
```

### The AI / capture seam

`lib/ai/provider.ts` is the single seam between UI and real AI. Today it runs a
local routing heuristic and returns mock analysis. When the main process implements
the reserved IPC channels (`pit:capture-site`, `pit:analyze-site`,
`pit:analyze-image`, `pit:test-connection`) and `preload/index.ts` exposes them on
`window.pit`, the provider detects them and delegates automatically — **no UI change
required**. Until then, the absence of those methods triggers the mock fallback.

Settings (appearance + provider config) already persist for real via
`pit:get-settings` / `pit:set-settings`, with a `localStorage` fallback.

## Project Setup

```bash
pnpm install
pnpm dev        # run the app
pnpm build      # typecheck + bundle main/preload/renderer
pnpm typecheck  # tsc for node + web
pnpm lint       # eslint
pnpm build:mac  # package (also build:win / build:linux)
```
