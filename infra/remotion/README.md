# pit — Remotion explainer

A ~34s motion-graphics intro to **pit** built with [Remotion](https://www.remotion.dev/).
It walks through what pit is and how it's used, then closes on the product direction:

1. **Hook** — _pit, your design-reference brain_
2. **Problem** — references live everywhere, none of it searchable
3. **Step 1 · Capture** — ⌘V to paste anything (sites, X, 小红书, images, recordings)
4. **Step 2 · Analyze** — AI reads the design into a `DESIGN.md` (palette, type, components, tech)
5. **Step 3 · Organize** — collections that auto-route new items
6. **Step 4 · Share** — one public link, just the good parts
7. **Direction** — a design system of record, readable by agents via MCP
8. **Outro** — download CTA

## Run

```bash
pnpm install          # or npm install
pnpm studio           # open the Remotion Studio (live preview + scrub)
pnpm still            # render a single poster frame → out/poster.png
pnpm render           # render the full MP4 → out/pit-intro.mp4
```

`render` / `still` download a headless Chromium on first run. Composition is
1280×720 @ 30fps; edit `src/Root.tsx` to change size/fps and `src/scenes.tsx`
for the content. Brand tokens live in `src/theme.ts`.
