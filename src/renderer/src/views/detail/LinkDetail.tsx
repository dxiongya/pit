// LinkDetail.tsx — site capture viewer + DESIGN.md analysis tabs.
// Tabs map directly to the awesome-design-md DESIGN.md sections.

import { useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { DesignDoc, Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { copyToClipboard, useToast } from '../../components/Toast'
import { Button } from '../../components/ui'

type TabId =
  | 'prompt'
  | 'pages'
  | 'theme'
  | 'palette'
  | 'type'
  | 'components'
  | 'layout'
  | 'motion'
  | 'guards'
  | 'a11y'

const TABS: { id: TabId; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'pages', label: 'Pages' },
  { id: 'theme', label: 'Theme' },
  { id: 'palette', label: 'Palette' },
  { id: 'type', label: 'Type' },
  { id: 'components', label: 'Components' },
  { id: 'layout', label: 'Layout & IA' },
  { id: 'motion', label: 'Motion' },
  { id: 'guards', label: "Do / Don't" },
  { id: 'a11y', label: 'Accessibility' }
]

export function LinkDetail({
  item,
  onShare
}: {
  item: Item
  onShare: () => void
}): React.JSX.Element {
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('prompt')
  const [currentPage, setCurrentPage] = useState(0)
  // Reset the stage scroll whenever the detail opens or the user switches page,
  // otherwise React keeps the previous scrollTop and the user lands mid-page
  // (no nav, no hero — looks like the screenshot is "cut off at the top").
  const stageBodyRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (stageBodyRef.current) stageBodyRef.current.scrollTop = 0
  }, [currentPage, item.id])

  // Read the saved analysis directly — captured pages + DESIGN.md live on the
  // item itself (set by store.importLink). No more mock fetch.
  const doc = item.design

  if (!doc) {
    return (
      <div className="detail-stage" style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
        <div className="muted" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>No analysis saved for this item.</div>
          <div style={{ fontSize: 12 }}>Press ⌘V on a link to capture + analyze a site.</div>
        </div>
      </div>
    )
  }

  const pageList = doc.pages || []
  const page = pageList[currentPage] || pageList[0]

  // Header "Agent prompt" quick-copy — copies whichever style prompt is available.
  const copyAgentPrompt = (): void => {
    void copyToClipboard(doc.stylePrompt || doc.agentPrompt || doc.description || '')
    toast.push('Style prompt copied')
  }

  return (
    <>
      <div className="detail-stage">
        <div className="detail-stage-head">
          <div className="dot-row" style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div className="url-pill" style={{ flex: 1, marginLeft: 8 }}>
            <I.Globe size={12} />
            <span>
              {doc.url}
              {page ? `/${page.name}` : ''}
            </span>
          </div>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {pageList.length ? `${currentPage + 1} / ${pageList.length}` : '—'}
          </div>
        </div>
        <div
          className="detail-stage-body"
          ref={stageBodyRef}
          style={{
            // Drop flex centring entirely — for the long stitched page we need
            // top-anchored scroll, and `margin: 0 auto` on the frame gives us
            // reliable horizontal centring without flex side-effects.
            display: 'block',
            overflow: 'auto'
          }}
        >
          <div
            className="preview-frame"
            style={{
              width: '85%',
              maxHeight: 'unset',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {page?.slices?.length ? (
              // Stack every slice vertically — this is the actual long page.
              page.slices.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`${page.name}-${i}`}
                  style={{ display: 'block', width: '100%' }}
                />
              ))
            ) : page?.screenshot ? (
              <img
                src={page.screenshot}
                alt={page.name}
                style={{ display: 'block', width: '100%' }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: 16 / 10, background: 'var(--bg-soft)' }} />
            )}
          </div>
        </div>

        {/* page strip */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 18px 14px',
            borderTop: '1px solid var(--hair)',
            overflowX: 'auto'
          }}
        >
          {pageList.map((p, i) => (
            <div
              key={p.name}
              onClick={() => setCurrentPage(i)}
              style={{
                width: 64,
                height: 44,
                borderRadius: 6,
                background: p.screenshot
                  ? `center/cover url(${p.screenshot})`
                  : p.bg || 'var(--bg-soft)',
                border: i === currentPage ? '2px solid var(--ink)' : '1px solid var(--hair)',
                cursor: 'pointer',
                flexShrink: 0,
                opacity: p.status === 'queue' ? 0.4 : 1
              }}
              title={`/${p.name}`}
            />
          ))}
        </div>
      </div>

      {/* right panel */}
      <div className="detail-panel">
        <div className="detail-head">
          <h2>{doc.title}</h2>
          <div className="url mono">{doc.url}</div>
          <div className="tag-row">
            {(doc.tags || []).map((t) => (
              <span key={t} className="tag-pill ai">
                {t}
              </span>
            ))}
          </div>
          {/* Move + Delete + Close are in the overlay actions row (top-right).
              Item-specific shortcuts only. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {doc.url && (
              <Button size="sm" onClick={() => window.open(doc.url, '_blank')}>
                <I.Globe size={13} /> Open site
              </Button>
            )}
            <Button size="sm" onClick={copyAgentPrompt}>
              <I.Copy size={13} /> Copy style prompt
            </Button>
            <Button size="sm" onClick={onShare}>
              <I.Share size={13} /> Share
            </Button>
          </div>
        </div>

        <div className="detail-tabs">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>

        <div className="detail-panel-body">
          {tab === 'prompt' && <PromptTab doc={doc} currentPage={page} />}
          {tab === 'pages' && <PagesAnalysis doc={doc} />}
          {tab === 'theme' && <ThemeAnalysis doc={doc} />}
          {tab === 'palette' && <PaletteAnalysis doc={doc} />}
          {tab === 'type' && <TypeAnalysis doc={doc} />}
          {tab === 'components' && <ComponentsAnalysis doc={doc} />}
          {tab === 'layout' && <LayoutAnalysis doc={doc} />}
          {tab === 'motion' && <MotionAnalysis doc={doc} />}
          {tab === 'guards' && <GuardsAnalysis doc={doc} />}
          {tab === 'a11y' && <A11yAnalysis doc={doc} />}
        </div>
      </div>
    </>
  )
}

export function PromptTab({
  doc,
  currentPage
}: {
  doc: DesignDoc
  currentPage?: DesignDoc['pages'][number]
}): React.JSX.Element {
  const toast = useToast()
  const [sub, setSub] = useState<'replica' | 'style'>('style')
  const [copied, setCopied] = useState(false)
  // Prefer the page-specific replica when one exists (sites have per-page
  // replicas; videos use a single unified replica covering all frames).
  const pageReplica = currentPage?.replicaPrompt
  const replica = pageReplica || doc.replicaPrompt
  const style = doc.stylePrompt || doc.agentPrompt
  const replicaLabel = pageReplica
    ? `Replica · rebuild /${currentPage!.name}`
    : 'Replica · rebuild this design'
  const active = sub === 'style' ? style : replica
  const label = sub === 'style' ? 'Style · apply this design to a new page' : replicaLabel
  const empty =
    sub === 'style'
      ? doc.description || 'No style prompt yet.'
      : 'No replica prompt for this page — re-analyze with the latest model to populate.'
  const copy = (): void => {
    if (!active) return
    void copyToClipboard(active)
    setCopied(true)
    toast.push(`${sub === 'style' ? 'Style' : 'Replica'} prompt copied`)
    setTimeout(() => setCopied(false), 1400)
  }
  return (
    <>
      {/* Sub-tabs so users see both prompt kinds at a glance, instead of one
          being hidden below the fold. Defaults to Style — the more common use. */}
      <div className="prompt-subtabs">
        <button
          className={`prompt-subtab${sub === 'style' ? ' active' : ''}`}
          onClick={() => setSub('style')}
        >
          <I.Sparkles size={12} /> Style
        </button>
        <button
          className={`prompt-subtab${sub === 'replica' ? ' active' : ''}`}
          onClick={() => setSub('replica')}
        >
          <I.Copy size={12} /> Replica
        </button>
      </div>
      <div className="prompt-block" style={{ marginTop: 12 }}>
        <div className="pb-head">
          <span className="pb-lbl">{label}</span>
          <Button
            size="sm"
            variant={copied ? 'accent' : 'default'}
            onClick={copy}
            disabled={!active}
          >
            {copied ? <I.Check size={12} /> : <I.Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div className="pb-text md">
          <ReactMarkdown>{active || empty}</ReactMarkdown>
        </div>
      </div>
    </>
  )
}

function PagesAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  return (
    <>
      <div className="section">
        <div className="section-h">
          <span>Captured pages</span>
          <span className="num">{doc.pages.length}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {doc.pages.map((p) => (
            <div
              key={p.name}
              style={{
                background: 'var(--bg-softer)',
                border: '1px solid var(--hair)',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  aspectRatio: 4 / 3,
                  background: p.screenshot ? `center/cover url(${p.screenshot})` : p.bg
                }}
              />
              <div style={{ padding: '8px 10px' }}>
                <div className="mono" style={{ fontSize: 11 }}>
                  /{p.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="section-h">
          <span>Summary</span>
        </div>
        <div className="prose">{doc.description}</div>
      </div>
    </>
  )
}

export function ThemeAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  return (
    <>
      {doc.theme && (
        <div className="section">
          <div className="section-h">
            <span>Visual theme &amp; atmosphere</span>
          </div>
          <div className="prose">{doc.theme}</div>
        </div>
      )}
      {doc.responsive && (
        <div className="section">
          <div className="section-h">
            <span>Responsive behavior</span>
          </div>
          <div className="prose">{doc.responsive}</div>
        </div>
      )}
      {/* Agent prompt guide removed — the Prompt tab already shows the full
          style + replica prompts, no reason to duplicate it inside Theme. */}
    </>
  )
}

export function PaletteAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  return (
    <>
      <div className="section">
        <div className="section-h">
          <span>Color palette &amp; roles</span>
          <span className="num">{doc.palette.length} colors</span>
        </div>
        <div className="color-grid">
          {doc.palette.map((p) => (
            <div
              key={p.hex}
              className="color-cell"
              style={{ background: p.hex, color: isDark(p.hex) ? '#f5efe6' : '#1c1611' }}
            >
              <div className="role">{p.role}</div>
              <div>{p.hex.toUpperCase()}</div>
              {p.pct != null && <div style={{ opacity: 0.7 }}>{p.pct}%</div>}
            </div>
          ))}
        </div>
      </div>
      <div className="section">
        <div className="section-h">
          <span>Distribution</span>
        </div>
        <div style={{ display: 'flex', gap: 2, height: 24, borderRadius: 4, overflow: 'hidden' }}>
          {doc.palette.map((p) => (
            <div
              key={p.hex}
              style={{ flex: p.pct || 1, background: p.hex }}
              title={`${p.hex} · ${p.pct}%`}
            />
          ))}
        </div>
      </div>
    </>
  )
}

export function TypeAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  // Skip entries missing a name — vision models sometimes return placeholder
  // objects (especially for video frames where typography isn't legible).
  const fonts = (doc.fonts || []).filter((f) => f && typeof f.name === 'string' && f.name.trim())
  if (fonts.length === 0) {
    return (
      <div className="section">
        <div className="section-h">
          <span>Typography rules</span>
          <span className="num">0 faces</span>
        </div>
        <div className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
          No typography extracted — text either wasn't legible in the source, or
          the model couldn't identify specific faces.
        </div>
      </div>
    )
  }
  return (
    <div className="section">
      <div className="section-h">
        <span>Typography rules</span>
        <span className="num">{fonts.length} faces</span>
      </div>
      {fonts.map((f, i) => {
        const name = f.name || ''
        return (
          <div key={i} className="font-row">
            <p
              className="f-sample"
              style={{
                fontFamily: name.includes('Mono')
                  ? 'var(--f-mono)'
                  : name.includes('Tiempos') || name.includes('Serif')
                    ? 'var(--f-accent)'
                    : 'var(--f-ui)',
                fontStyle: name.includes('Tiempos') ? 'italic' : 'normal',
                fontSize: i === 0 ? 36 : i === 1 ? 24 : i === 2 ? 17 : 13
              }}
            >
              {f.sample || name}
            </p>
            <div className="f-meta">
              <div className="fname">{name}</div>
              <div>
                {f.weight || '—'} · {f.size || '—'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ComponentsAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  // Filter to entries with at least a name — the rest is fallback friendly.
  const components = (doc.components || []).filter(
    (c) => c && typeof c.name === 'string' && c.name.trim()
  )
  if (components.length === 0) {
    return (
      <div className="section">
        <div className="section-h">
          <span>Component stylings</span>
          <span className="num">0</span>
        </div>
        <div className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
          No discrete components identified — try re-analyzing, or this asset
          may not have repeatable UI primitives.
        </div>
      </div>
    )
  }
  return (
    <div className="section">
      <div className="section-h">
        <span>Component stylings</span>
        <span className="num">{components.length}</span>
      </div>
      <div className="cmp-list">
        {components.map((c, i) => (
          <div key={c.name + i} className="cmp-row">
            <div className="cmp-thumb">
              <div style={{ width: 40, height: 14, borderRadius: 4, background: 'var(--ink)' }} />
            </div>
            <div className="cmp-info">
              <div className="cmp-name">{c.name}</div>
              {c.tokens && <div className="cmp-tokens">{c.tokens}</div>}
            </div>
            {typeof c.count === 'number' && c.count > 0 && (
              <div className="cmp-count">{c.count}×</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function LayoutAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  const ia = doc.ia || []
  // Parse the column count out of the layout note when possible — drives a
  // *real* visualization. Falls back to just the note text when we can't tell.
  const colMatch = doc.layoutNote?.match(/(\d+)\s*[-–\s]?\s*(?:col|column)/i)
  const cols = colMatch ? Math.min(24, Math.max(2, parseInt(colMatch[1], 10))) : 0

  return (
    <>
      {ia.length > 0 && (
        <div className="section">
          <div className="section-h">
            <span>Information architecture</span>
          </div>
          <div className="ia-tree">
            {ia.map((n, i) => (
              <div key={i} className="ia-node">
                <span className="ind">
                  {'│  '.repeat(n.lvl)}
                  {n.lvl > 0 ? '├─ ' : ''}
                </span>
                <span className="lbl">{n.label}</span>
                <span className="meta">{n.meta}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {doc.layoutNote && (
        <div className="section">
          <div className="section-h">
            <span>Layout grid</span>
          </div>
          <div
            style={{
              background: 'var(--bg-softer)',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--hair)',
              padding: 14
            }}
          >
            {cols > 0 && (
              <div
                title={`${cols}-column grid (parsed from the layout note)`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 4,
                  height: 56,
                  marginBottom: 10
                }}
              >
                {Array.from({ length: cols }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--bg-soft)', borderRadius: 3 }} />
                ))}
              </div>
            )}
            <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {doc.layoutNote}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function MotionAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  const motion = (doc.motion || []).filter((m) => m && (m.type || m.dur))
  if (motion.length === 0) {
    return (
      <div className="section">
        <div className="section-h">
          <span>Depth, elevation &amp; motion</span>
        </div>
        <div className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
          No micro-interaction motion specs extracted.
        </div>
      </div>
    )
  }
  return (
    <div className="section">
      <div className="section-h">
        <span>Depth, elevation &amp; motion</span>
      </div>
      {motion.map((m, i) => (
        <div key={i} className="motion-row">
          <span className="mtype">{m.type || '—'}</span>
          <div className="motion-bar">
            <div className="fill" style={{ width: `${m.bar ?? 0}%` }} />
          </div>
          <span className="mdur">{m.dur || ''}</span>
        </div>
      ))}
      {motion[0]?.easing && (
        <div className="mono" style={{ marginTop: 10, fontSize: 11, color: 'var(--ink-3)' }}>
          Primary easing: {motion[0].easing}
        </div>
      )}
    </div>
  )
}

export function GuardsAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  return (
    <div className="section">
      <div className="section-h">
        <span>Do&apos;s and Don&apos;ts</span>
      </div>
      <div className="guard-grid">
        <div className="guard-col do">
          <h4>Do</h4>
          <ul>
            {(doc.dos || []).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="guard-col dont">
          <h4>Don&apos;t</h4>
          <ul>
            {(doc.donts || []).map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function A11yAnalysis({ doc }: { doc: DesignDoc }): React.JSX.Element {
  const checks = (doc.a11y || []).filter((a) => a && a.label)
  return (
    <div className="section">
      <div className="section-h">
        <span>Accessibility scan</span>
        <span className="num">{checks.length} checks</span>
      </div>
      {checks.length > 0 ? (
        <div className="a11y-card">
          {checks.map((a, i) => (
            <div key={(a.label || '') + i} className="a11y-row">
              <div>
                <div className="lbl" style={{ fontWeight: 600 }}>
                  {a.label}
                </div>
                {a.detail && (
                  <div
                    className="mono"
                    style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}
                  >
                    {a.detail}
                  </div>
                )}
              </div>
              {a.grade && <span className={`grade ${a.grade}`}>{a.grade}</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="muted" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>
          No accessibility checks extracted.
        </div>
      )}
    </div>
  )
}

function isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}
