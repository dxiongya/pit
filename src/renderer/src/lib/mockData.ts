// mockData.ts — built-in collections + mock DESIGN.md.
// SEED_ITEMS is now empty (items come from SQLite). Builtin collections remain
// (they aren't persisted — they're always present in every install).

import type { Collection, Item, DesignDoc } from './types'

/** Built-in (non-removable) collections. User collections come from the DB. */
export const BUILTIN_COLLECTIONS: Collection[] = [
  { id: 'all', name: 'All', color: '#6e6e73', icon: '∞', builtin: true },
  { id: 'recent', name: 'Recent', color: '#a1a1a6', icon: '◷', builtin: true },
  { id: 'inbox', name: 'Inbox', color: '#ff9f0a', icon: '↓', builtin: true }
]

export const COLLECTIONS: Collection[] = BUILTIN_COLLECTIONS

export const ITEMS: Item[] = []

/** Sample DESIGN.md analysis for the "Linear — Method" link. */
export const LINK_DESIGN_DOC: DesignDoc = {
  url: 'https://linear.app/method',
  title: 'Linear — Method',
  theme:
    'Editorial product page with magazine DNA — restrained, paced, high typographic discipline. Reads like a printed essay translated to the web.',
  description:
    "A long-form editorial document about Linear's working method. Treats the product page like a magazine essay: serif display, mono captions, generous margins, low chroma. Subtle motion. High typographic discipline.",
  pages: [
    { name: 'method', status: 'done', bg: 'linear-gradient(180deg, #f5efe6 0%, #e8dfc7 100%)' },
    {
      name: 'method/build',
      status: 'done',
      bg: 'linear-gradient(180deg, #f5efe6 0%, #d4c5a8 100%)'
    },
    {
      name: 'method/ship',
      status: 'done',
      bg: 'linear-gradient(180deg, #1c1611 0%, #4a3f31 100%)'
    },
    {
      name: 'method/cycles',
      status: 'scanning',
      bg: 'linear-gradient(180deg, #f5efe6 0%, #c4884a 100%)'
    },
    { name: 'method/quality', status: 'queue', bg: 'var(--bg-soft)' },
    { name: 'method/team', status: 'queue', bg: 'var(--bg-soft)' }
  ],
  palette: [
    { hex: '#1c1611', role: 'ink', pct: 38 },
    { hex: '#f5efe6', role: 'paper', pct: 32 },
    { hex: '#5e8b6e', role: 'accent', pct: 12 },
    { hex: '#c4884a', role: 'accent-2', pct: 9 },
    { hex: '#8a7e6f', role: 'muted', pct: 6 },
    { hex: '#e2d4ba', role: 'tint', pct: 3 }
  ],
  fonts: [
    {
      sample: 'Display 64',
      name: 'Tiempos Headline',
      weight: 'Light',
      size: '64px / 0.95',
      role: 'display'
    },
    {
      sample: 'Heading 28',
      name: 'Inter Display',
      weight: 'Semibold',
      size: '28px / 1.15',
      role: 'heading'
    },
    { sample: 'Body 16', name: 'Inter', weight: 'Regular', size: '16px / 1.5', role: 'body' },
    {
      sample: 'Mono 12',
      name: 'JetBrains Mono',
      weight: 'Regular',
      size: '12px / 1.4',
      role: 'caption'
    }
  ],
  components: [
    { name: 'Primary button', count: 14, tokens: 'r:8 · h:36 · ink/paper' },
    { name: 'Anchor card', count: 12, tokens: 'r:14 · 1px hair · sh-1' },
    { name: 'Inline code', count: 38, tokens: 'mono · soft bg · r:4' },
    { name: 'Section heading', count: 9, tokens: 'serif · 32px · 0.95 lh' },
    { name: 'Pull quote', count: 4, tokens: 'serif italic · 28px' },
    { name: 'Footnote', count: 11, tokens: 'mono 12 · muted' }
  ],
  ia: [
    { lvl: 0, label: 'method', meta: 'index' },
    { lvl: 1, label: 'hero', meta: '1 h1, 1 lead' },
    { lvl: 1, label: 'principles', meta: '6 sections' },
    { lvl: 2, label: 'build', meta: '→ /method/build' },
    { lvl: 2, label: 'ship', meta: '→ /method/ship' },
    { lvl: 2, label: 'cycles', meta: '→ /method/cycles' },
    { lvl: 2, label: 'quality', meta: '→ /method/quality' },
    { lvl: 1, label: 'footer', meta: '4 link clusters' }
  ],
  layoutNote: '12-col · 1216 max · gutter 24 · margin auto · asymmetric (cols 2–8 body)',
  motion: [
    { type: 'Page transition', easing: 'cubic-bezier(.2,.8,.2,1)', dur: '320ms', bar: 32 },
    { type: 'Anchor scroll', easing: 'ease-out', dur: '480ms', bar: 48 },
    { type: 'Hover lift', easing: 'ease', dur: '160ms', bar: 16 },
    { type: 'Cursor halo', easing: 'linear (rAF)', dur: 'continuous', bar: 100 }
  ],
  dos: [
    'Lead with serif display at large sizes; let it set the tone.',
    'Keep body measure narrow (cols 2–8) for an essay feel.',
    'Use mono only for metadata, captions, and footnotes.',
    'Favor low-frequency, deliberate motion over flourish.'
  ],
  donts: [
    "Don't add stepped CSS gradients — keep grounds flat.",
    "Don't crowd the margins; whitespace is the brand.",
    "Don't introduce a second saturated accent.",
    "Don't animate on every hover; reserve motion for transitions."
  ],
  responsive:
    'Single column below 760px; body measure widens to full bleed minus 24px gutters. Display type clamps 32→64px. Touch targets ≥ 44px. Footnotes collapse inline.',
  agentPrompt:
    'Build a long-form editorial product page: serif display (Tiempos-like) at 48–64px, Inter body at 16/1.5, JetBrains Mono captions. Paper background #f5efe6, ink #1c1611, single muted-green accent #5e8b6e. Asymmetric 12-col grid, body in cols 2–8, generous margins. Low-frequency deliberate motion (320ms cubic-bezier(.2,.8,.2,1)). No second accent, no stepped gradients.',
  a11y: [
    { label: 'Contrast (AA body)', grade: 'A', detail: '4.9 : 1 — passes WCAG AA' },
    { label: 'Heading hierarchy', grade: 'A', detail: 'No skipped levels' },
    { label: 'Focus visible', grade: 'A', detail: 'Custom ring, 3px offset' },
    { label: 'Alt text coverage', grade: 'B', detail: '82% — 9 images missing alt' },
    { label: 'Reduced motion', grade: 'C', detail: 'No prefers-reduced-motion handling' }
  ],
  tags: ['editorial', 'product', 'serif', 'asymmetric-grid', 'long-form', 'b2b', 'paper-on-ink']
}

export const AI_STEPS = [
  { id: 's1', title: 'Fetched sitemap', det: '6 pages discovered · robots.txt OK' },
  { id: 's2', title: 'Captured screenshots', det: '3 / 6 done · 1440×900 @ 2x' },
  { id: 's3', title: 'Extracting DESIGN.md', det: 'sampling DOM + computed styles' },
  { id: 's4', title: 'Mapping components', det: 'pending' },
  { id: 's5', title: 'Auto-routing to collections', det: 'pending' }
]

export const AI_STREAM_LINES = [
  '> Editorial product page with magazine DNA.',
  '> Serif display + monospace utility, paper background.',
  '> Asymmetric 12-col grid, generous whitespace.',
  '> Matches "Editorial Layouts" (94%) and "Product Surfaces" (61%).'
]

export const TAG_BANK: Record<string, string[]> = {
  Type: [
    'serif',
    'sans',
    'mono',
    'display',
    'editorial',
    'b2b',
    'utility',
    'long-form',
    'marketing'
  ],
  Mood: [
    'warm',
    'cool',
    'neutral',
    'jewel',
    'pastel',
    'earthen',
    'high-contrast',
    'low-chroma',
    'minimal',
    'maximal'
  ],
  Form: ['asymmetric-grid', 'card-grid', 'masonry', 'list', 'split', 'full-bleed', 'magazine'],
  Surface: ['web', 'mobile', 'desktop', 'print', 'packaging', 'signage', 'object'],
  Skip: ['stock-photo', 'AI-generated', 'thumbnail-only']
}

export const COVER_COLORS = [
  '#e8624a',
  '#e6a73a',
  '#8fa84a',
  '#2f8e8a',
  '#4356a0',
  '#8b4a7c',
  '#e89bb0',
  '#1c1611'
]
