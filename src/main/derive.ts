// derive.ts — generates HTML derivatives from an analyzed item's design.
//
// Two modes:
//   1. COLOR variations — keep the design, swap palette. We derive 3 candidate
//      palettes algorithmically (HSL-based shifts: cool / earth / mono) for
//      determinism and zero token cost, then ask the derive-role model in
//      ONE call to name them. Cheap + diverse.
//   2. CONTENT variations — keep the style, rewrite content per user prompt.
//      One codegen call per prompt.
//
// Codegen: a single call to the `derive` role with the source replicaPrompt +
// design tokens + (palette override / content prompt). Output: single-file
// HTML with inline CSS, no external CDN, ready for offline preview + screenshot.

import { BrowserWindow, session } from 'electron'
import { callModel, type RoleRequest } from './ai'

// ─── orchestrators — IPC-facing high-level helpers ─────────────────────

interface DeriveOneInput {
  req: RoleRequest
  replicaPrompt: string
  designTokens?: GenerateHtmlInput['designTokens']
  palette?: PaletteToken[]
  contentPrompt?: string
}

export interface DerivedOne {
  html: string
  screenshot?: string
  error?: string
}

/** Generate one derivative + capture its preview. Used in parallel for color
 *  variations and serially for content prompts. Catches errors so a single
 *  failure doesn't sink a batch. */
export async function deriveOne(input: DeriveOneInput): Promise<DerivedOne> {
  try {
    const html = await generateHtml(input)
    const screenshot = await captureHtml(html).catch(() => undefined)
    return { html, screenshot }
  } catch (e) {
    return { html: '', error: (e as Error).message }
  }
}

// ─── palette generation (code-derived) ────────────────────────────────

interface RgbColor {
  r: number
  g: number
  b: number
}

interface HslColor {
  h: number
  s: number
  l: number
}

interface PaletteToken {
  hex: string
  role?: string
  pct?: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function hexToRgb(hex: string): RgbColor | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const h = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function rgbToHsl({ r, g, b }: RgbColor): HslColor {
  const r1 = r / 255
  const g1 = g / 255
  const b1 = b / 255
  const max = Math.max(r1, g1, b1)
  const min = Math.min(r1, g1, b1)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r1) h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) * 60
    else if (max === g1) h = ((b1 - r1) / d + 2) * 60
    else h = ((r1 - g1) / d + 4) * 60
  }
  return { h, s: s * 100, l: l * 100 }
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const sn = clamp(s, 0, 100) / 100
  const ln = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (h < 60) [r1, g1, b1] = [c, x, 0]
  else if (h < 120) [r1, g1, b1] = [x, c, 0]
  else if (h < 180) [r1, g1, b1] = [0, c, x]
  else if (h < 240) [r1, g1, b1] = [0, x, c]
  else if (h < 300) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 }
}

function shiftColor(hex: string, op: PaletteOp): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  const next: HslColor = { ...hsl }
  switch (op.kind) {
    case 'hue': // rotate hue by op.deg degrees
      next.h = (hsl.h + op.deg + 360) % 360
      break
    case 'mono': // collapse chroma toward target hue, drop saturation
      next.h = op.targetH ?? hsl.h
      next.s = clamp(hsl.s * 0.25, 0, 20)
      break
    case 'earth': // pull hue toward warm earth band 25-55, modest sat
      next.h = 25 + ((hsl.h % 30) + 30) % 30 // jitter 25-55
      next.s = clamp(35 + (hsl.s - 50) * 0.3, 20, 55)
      next.l = clamp(hsl.l, 20, 80)
      break
    case 'cool': // pull hue toward 180-240, keep saturation
      next.h = 190 + ((hsl.h % 50) + 50) % 50 // jitter 190-240
      break
  }
  return rgbToHex(hslToRgb(next))
}

type PaletteOp =
  | { kind: 'hue'; deg: number }
  | { kind: 'mono'; targetH?: number }
  | { kind: 'earth' }
  | { kind: 'cool' }

interface VariationStrategy {
  fallbackLabel: string
  op: PaletteOp
}

const STRATEGIES: VariationStrategy[] = [
  { fallbackLabel: 'Cool shift', op: { kind: 'cool' } },
  { fallbackLabel: 'Earth grade', op: { kind: 'earth' } },
  { fallbackLabel: 'Mono accent', op: { kind: 'mono' } }
]

export interface PaletteVariation {
  label: string
  palette: PaletteToken[]
}

/** Derive `count` palette variations algorithmically. Returns array sized
 *  min(count, STRATEGIES.length). Each variation preserves the original
 *  palette's role names + percentages. */
export function buildPaletteVariations(
  source: PaletteToken[],
  count = 3
): PaletteVariation[] {
  const palette = source.filter((p) => p && typeof p.hex === 'string' && p.hex.startsWith('#'))
  if (palette.length === 0) return []
  const out: PaletteVariation[] = []
  for (let i = 0; i < Math.min(count, STRATEGIES.length); i++) {
    const s = STRATEGIES[i]
    out.push({
      label: s.fallbackLabel,
      palette: palette.map((p) => ({
        hex: shiftColor(p.hex, s.op),
        role: p.role,
        pct: p.pct
      }))
    })
  }
  return out
}

/** Ask the derive-role model to give each algorithmic variation a short,
 *  evocative label ("warm-burn", "mono-grade", "cool-mist"). One call total.
 *  Falls back to the algorithmic label on failure. */
export async function namePaletteVariations(
  req: RoleRequest,
  variations: PaletteVariation[]
): Promise<PaletteVariation[]> {
  if (variations.length === 0) return variations
  const sys =
    'You name color palettes for a design system. Output ONE name per palette, ' +
    'each 2-3 words hyphenated like "cool-mist" / "warm-burn" / "mono-grade". ' +
    'Output ONLY the names, one per line, in input order. No JSON, no preface.'
  const user = variations
    .map((v, i) => `Palette ${i + 1}: ${v.palette.map((p) => p.hex).join(', ')}`)
    .join('\n')
  try {
    const text = await callModel(req, sys, user, false)
    const lines = text
      .split('\n')
      .map((s) => s.trim().replace(/^[-•*\d.()]+\s*/, ''))
      .filter(Boolean)
    return variations.map((v, i) => ({ ...v, label: lines[i] || v.label }))
  } catch {
    return variations
  }
}

// ─── HTML codegen ─────────────────────────────────────────────────────

const HTML_CODEGEN_SYSTEM = `You generate a SINGLE self-contained HTML file from a design system specification.

OUTPUT RULES — STRICT:
- Output ONLY the HTML, starting with <!doctype html>. No preface, no commentary, no markdown fences.
- Single file: all CSS INLINE inside <style> in <head>. No external stylesheets, no CDN, no fonts loaded from the network — use system font stacks.
- No JavaScript unless absolutely needed for the layout (it shouldn't be).
- Target viewport 1280×800 (use that as max-width / aspect cue), but keep the layout responsive down to ~720px.
- Use the provided palette as CSS custom properties at the top of <style>.
- Faithfully recreate the design described in the REPLICA — copy verbatim text, dimensions, components.
- If a CONTENT PROMPT is provided, REWRITE the content per the prompt while keeping the visual language (layout, typography, components, spacing). The palette stays as provided.
- If a PALETTE OVERRIDE is provided, use it INSTEAD of any colors mentioned in the replica.

The output must render meaningfully when loaded in a browser — every section visible, no broken images (use solid color blocks or SVG placeholders).`

export interface GenerateHtmlInput {
  req: RoleRequest
  replicaPrompt: string
  /** Original design tokens — provided as context the model can lean on. */
  designTokens?: {
    theme?: string
    fonts?: { name?: string; weight?: string; size?: string; role?: string }[]
    layoutNote?: string
  }
  /** New palette to apply (color-variation mode). */
  palette?: PaletteToken[]
  /** User prompt to rewrite content (content-variation mode). */
  contentPrompt?: string
}

export async function generateHtml(input: GenerateHtmlInput): Promise<string> {
  const parts: string[] = []
  parts.push(`REPLICA (rebuild this design as the structural baseline):`)
  parts.push(input.replicaPrompt)

  if (input.designTokens?.theme) {
    parts.push('', `THEME: ${input.designTokens.theme}`)
  }
  if (input.designTokens?.fonts?.length) {
    parts.push(
      '',
      `TYPOGRAPHY: ${input.designTokens.fonts
        .map((f) => `${f.role || ''} ${f.name || ''} ${f.weight || ''} ${f.size || ''}`.trim())
        .join(' · ')}`
    )
  }
  if (input.designTokens?.layoutNote) {
    parts.push('', `LAYOUT: ${input.designTokens.layoutNote}`)
  }

  if (input.palette && input.palette.length) {
    parts.push('', 'PALETTE OVERRIDE (use these colors, ignore the replica\'s palette):')
    for (const p of input.palette) {
      parts.push(`  ${p.hex}  ${p.role || ''}${p.pct ? ` (${p.pct}%)` : ''}`)
    }
  }
  if (input.contentPrompt) {
    parts.push(
      '',
      'CONTENT PROMPT (rewrite the visible text + sections per this, keep the visual style):',
      input.contentPrompt
    )
  }

  parts.push('', 'Output the single-file HTML now.')
  const user = parts.join('\n')

  const text = await callModel(input.req, HTML_CODEGEN_SYSTEM, user, false)
  return extractHtml(text)
}

/** Strip any accidental markdown fences or preface and return clean HTML. */
function extractHtml(raw: string): string {
  let s = raw.trim()
  // Strip ```html ... ``` fences if the model added them despite the prompt.
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  // Some models prepend "Here's the HTML:" — slice from first <!doctype or <html.
  const idx = s.search(/<!doctype\s+html|<html[\s>]/i)
  if (idx > 0) s = s.slice(idx).trim()
  return s
}

// ─── HTML render → screenshot ─────────────────────────────────────────

// The derivative HTML is untrusted model output. Two layers stop it from
// beaconing out (e.g. a stray <img src=http://attacker> or <script>fetch()</script>)
// while we render it for a thumbnail:
//  1. a dedicated in-memory session that cancels every non-data: request, and
//  2. a strict CSP injected into the document itself (no scripts, data:-only
//     images/fonts), as defense-in-depth.
const RENDER_PARTITION = 'derive-render'
const RENDER_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'"
let renderNetBlocked = false

function blockRenderNetwork(): void {
  if (renderNetBlocked) return
  session.fromPartition(RENDER_PARTITION).webRequest.onBeforeRequest((details, cb) => {
    // Allow only the in-memory data: document; deny all real network egress.
    cb({ cancel: !details.url.startsWith('data:') })
  })
  renderNetBlocked = true
}

/** Inject a strict CSP <meta> so untrusted HTML can't run scripts or load
 *  external resources even if the network block ever has a gap. */
function withCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${RENDER_CSP}">`
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + meta)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${meta}</head>`)
  return meta + html
}

/**
 * Render an HTML string in a hidden BrowserWindow and capture a screenshot.
 * Returns a PNG data URL ready to store as the derivative's thumbnail.
 *
 * - Window is offscreen=false but show=false (Chromium throttling stays off,
 *   capturePage works) and sized to a desktop-typical 1280x800.
 * - Network is blocked + a strict CSP is injected (untrusted model HTML).
 * - Uses loadURL('data:text/html;base64,…') so we don't need a tmp file.
 * - Waits for did-finish-load + a small settle delay so CSS/SVG/images paint
 *   before capture.
 */
export async function captureHtml(
  html: string,
  width = 1280,
  height = 800
): Promise<string> {
  blockRenderNetwork()
  const win = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      // No preload — derivative HTML is untrusted; isolate it in a network-
      // blocked partition.
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      offscreen: false,
      partition: RENDER_PARTITION
    }
  })
  try {
    const dataUrl =
      'data:text/html;charset=utf-8;base64,' +
      Buffer.from(withCsp(html), 'utf-8').toString('base64')
    const loaded = new Promise<void>((resolve) => {
      const done = (): void => {
        win.webContents.off('did-finish-load', done)
        resolve()
      }
      win.webContents.once('did-finish-load', done)
    })
    await win.loadURL(dataUrl)
    await loaded
    // Settle for layout / font swap / SVG paint before grabbing pixels.
    await new Promise((r) => setTimeout(r, 350))
    const image = await win.webContents.capturePage()
    return image.toDataURL()
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}
