// ImageDetail.tsx — detail view for a saved image/palette/font/words item.
// Uses the item's real saved analysis (item.design) when present, else falls
// back to its basic fields. Prompt is shown first and is one-click copyable;
// palette swatches are real (role/pct) and copyable.

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Item, PaletteRole } from '../../lib/types'
import { I } from '../../lib/icons'
import { useStore } from '../../lib/store'
import { rankCollections } from '../../lib/ai/provider'
import { RoutingRow } from '../../components/RoutingRow'
import { copyToClipboard, useToast } from '../../components/Toast'
import { Button } from '../../components/ui'
import { Lightbox } from './Lightbox'

type TabId = 'prompt' | 'analysis' | 'palette' | 'similar'

function isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length < 6) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

export function ImageDetail({
  item,
  onShare
}: {
  item: Item
  onShare: () => void
}): React.JSX.Element {
  const { items, collections } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState<TabId>('prompt')
  const [copied, setCopied] = useState<'replica' | 'style' | 'hex' | null>(null)
  const [promptSub, setPromptSub] = useState<'style' | 'replica'>('style')
  const [lightbox, setLightbox] = useState(false)

  const design = item.design
  const FALLBACK_ROLES = ['dominant', 'accent', 'shadow', 'deep', 'highlight']
  const palette: PaletteRole[] = design?.palette?.length
    ? design.palette
    : (item.palette || []).map((hex, i) => ({ hex, role: FALLBACK_ROLES[i] || 'tone' }))

  const replicaPrompt = design?.replicaPrompt || ''
  const stylePrompt = design?.stylePrompt || design?.agentPrompt || item.prompt || ''
  const description = design?.description || item.prompt || ''
  const mood = design?.mood || []
  const style = design?.style || []
  const materials = design?.materials || []
  const moodStyleMat = [...mood, ...style, ...materials]

  const routes = rankCollections(item, collections).slice(0, 2)
  const collection = collections.find((c) => c.id === item.collection)

  const copyPrompt = (kind: 'replica' | 'style', text: string): void => {
    if (!text) return
    void copyToClipboard(text)
    setCopied(kind)
    toast.push(`${kind === 'replica' ? 'Replica' : 'Style'} prompt copied`)
    setTimeout(() => setCopied(null), 1400)
  }
  const copyHex = (hex: string): void => {
    void copyToClipboard(hex)
    toast.push(`${hex.toUpperCase()} copied`)
  }
  const copyPalette = (): void => {
    void copyToClipboard(palette.map((p) => p.hex.toUpperCase()).join(', '))
    toast.push('Palette copied')
  }
  const exportAs = (kind: 'css' | 'tailwind' | 'figma' | 'ase'): void => {
    const hexes = palette.map((p) => p.hex.toUpperCase())
    let text = hexes.join(', ')
    if (kind === 'css')
      text = `:root {\n${palette.map((p, i) => `  --color-${i + 1}: ${p.hex.toUpperCase()}; /* ${p.role} */`).join('\n')}\n}`
    else if (kind === 'tailwind')
      text = `colors: {\n${palette.map((p, i) => `  '${p.role || `c${i + 1}`}': '${p.hex.toUpperCase()}',`).join('\n')}\n}`
    void copyToClipboard(text)
    toast.push(`${kind === 'ase' ? '.ase' : kind} copied`)
  }

  return (
    <>
      <div className="detail-stage" style={{ position: 'relative' }}>
        {/* Show the expand affordance whenever there's something visual to
            zoom — screenshot OR an HTML iframe to preview. */}
        {(item.screenshot || item.html) && (
          <button
            type="button"
            className="stage-expand"
            onClick={() => setLightbox(true)}
            title="Expand (zoom + pan)"
          >
            <I.Eye size={14} />
          </button>
        )}
        <div className="detail-stage-head">
          <div className="dot-row" style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div className="url-pill" style={{ flex: 1, marginLeft: 8 }}>
            <I.Image size={12} />
            <span>{(item.title || 'item').toLowerCase().replace(/\s+/g, '-')}.jpg</span>
          </div>
        </div>
        <div className="detail-stage-body">
          {item.kind === 'image' &&
            // Derived items carry the full HTML body — render it live in an
            // iframe so the user sees the actual page, not just the static
            // capture (interactive hover states, scrollable long layouts, …).
            (item.html ? (
              <div
                className="preview-frame"
                style={{
                  width: '92%',
                  height: '100%',
                  background: '#fff',
                  borderRadius: 6,
                  overflow: 'hidden'
                }}
              >
                <iframe
                  srcDoc={item.html}
                  sandbox="allow-same-origin"
                  title={item.title}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                />
              </div>
            ) : item.screenshot ? (
              <div className="preview-frame" style={{ maxWidth: '85%' }}>
                <img
                  src={item.screenshot}
                  alt={item.title}
                  style={{ display: 'block', maxWidth: '100%' }}
                />
              </div>
            ) : (
              <div className="preview-frame" style={{ maxWidth: '85%' }}>
                <div style={{ width: 480, aspectRatio: item.aspect || 1, background: item.bg }} />
              </div>
            ))}
          {item.kind === 'palette' && (
            <div
              style={{
                width: '70%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 14,
                overflow: 'hidden',
                boxShadow: 'var(--sh-2)'
              }}
            >
              {palette.map((c, i) => (
                <div
                  key={i}
                  style={{
                    height: 60,
                    background: c.hex,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 20px',
                    color: isDark(c.hex) ? '#fffaf2' : '#1c1611',
                    fontFamily: 'var(--f-mono)',
                    fontSize: 13
                  }}
                >
                  {c.hex.toUpperCase()}
                </div>
              ))}
            </div>
          )}
          {item.kind === 'font' && (
            <div
              style={{
                fontFamily: item.title?.includes('Mono') ? 'var(--f-mono)' : 'var(--f-accent)',
                fontStyle: item.title?.includes('Mono') ? 'normal' : 'italic',
                fontSize: 200,
                lineHeight: 0.85,
                color: 'var(--ink)'
              }}
            >
              {item.sample || 'Aa'}
            </div>
          )}
          {item.kind === 'quote' && (
            <div
              style={{
                fontFamily: 'var(--f-accent)',
                fontStyle: 'italic',
                fontSize: 48,
                lineHeight: 1.1,
                maxWidth: 560,
                textAlign: 'center',
                padding: 40
              }}
            >
              {item.text}
            </div>
          )}
          {item.kind === 'note' && (
            <div
              style={{
                background: 'var(--bg-soft)',
                padding: 40,
                borderRadius: 14,
                maxWidth: 520,
                fontSize: 18,
                lineHeight: 1.5
              }}
            >
              {item.body}
            </div>
          )}
        </div>
      </div>

      <div className="detail-panel">
        <div className="detail-head">
          <h2>{item.title || 'Untitled'}</h2>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Saved to <strong style={{ color: 'var(--ink)' }}>{collection?.name || 'All'}</strong>
            {design?.assetType && <> · {design.assetType}</>}
            {design?.confidence != null && <> · {design.confidence}%</>}
            {item.source && <> · {item.source}</>}
          </div>
          <div className="tag-row">
            {(item.tags || []).map((t) => (
              <span key={t} className="tag-pill ai">
                {t}
              </span>
            ))}
          </div>
          {/* Move + Delete + Close are in the overlay actions row (top-right).
              We only keep item-specific shortcuts here. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <Button size="sm" onClick={copyPalette} disabled={!palette.length}>
              <I.Copy size={13} /> Copy palette
            </Button>
            <Button size="sm" onClick={onShare}>
              <I.Share size={13} /> Share
            </Button>
            {/* Derived-item shortcuts — only shown when item.html exists. */}
            {item.html && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    void copyToClipboard(item.html || '')
                    toast.push('HTML copied')
                  }}
                >
                  <I.Copy size={13} /> Copy HTML
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([item.html || ''], { type: 'text/html' })
                    const url = URL.createObjectURL(blob)
                    window.open(url, '_blank')
                    setTimeout(() => URL.revokeObjectURL(url), 30000)
                  }}
                >
                  <I.Globe size={13} /> Open externally
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="detail-tabs">
          {(
            [
              { id: 'prompt', label: 'Prompt' },
              { id: 'analysis', label: 'AI analysis' },
              { id: 'palette', label: 'Palette' },
              { id: 'similar', label: 'Similar' }
            ] as { id: TabId; label: string }[]
          ).map((t) => (
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
          {tab === 'prompt' && (
            <>
              <div className="prompt-subtabs">
                <button
                  className={`prompt-subtab${promptSub === 'style' ? ' active' : ''}`}
                  onClick={() => setPromptSub('style')}
                >
                  <I.Sparkles size={12} /> Style
                </button>
                <button
                  className={`prompt-subtab${promptSub === 'replica' ? ' active' : ''}`}
                  onClick={() => setPromptSub('replica')}
                >
                  <I.Copy size={12} /> Replica
                </button>
              </div>
              <div className="prompt-block" style={{ marginTop: 12 }}>
                <div className="pb-head">
                  <span className="pb-lbl">
                    {promptSub === 'style'
                      ? 'Style · apply this look to new work'
                      : 'Replica · recreate this exact image'}
                  </span>
                  <Button
                    size="sm"
                    variant={copied === promptSub ? 'accent' : 'default'}
                    onClick={() =>
                      copyPrompt(promptSub, promptSub === 'style' ? stylePrompt : replicaPrompt)
                    }
                    disabled={!(promptSub === 'style' ? stylePrompt : replicaPrompt)}
                  >
                    {copied === promptSub ? <I.Check size={12} /> : <I.Copy size={12} />}
                    {copied === promptSub ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="pb-text md">
                  <ReactMarkdown>
                    {promptSub === 'style'
                      ? stylePrompt || 'No style prompt yet.'
                      : replicaPrompt || 'No replica prompt — re-analyze to populate.'}
                  </ReactMarkdown>
                </div>
              </div>
            </>
          )}
          {tab === 'analysis' && (
            <>
              {description && (
                <div className="section">
                  <div className="section-h">
                    <span>What it is</span>
                  </div>
                  <div className="prose">{description}</div>
                </div>
              )}

              {moodStyleMat.length > 0 && (
                <div className="section">
                  <div className="section-h">
                    <span>Mood · style · material</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {moodStyleMat.map((m) => (
                      <span key={m} className="tag-pill">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="section">
                <div className="section-h">
                  <span>Routes to</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {routes.map((r) => (
                    <RoutingRow
                      key={r.collectionId}
                      color={r.color}
                      name={r.name}
                      conf={r.confidence}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === 'palette' && (
            <>
              <div className="section">
                <div className="section-h">
                  <span>Extracted palette</span>
                  <span className="num">{palette.length}</span>
                </div>
                <div className="color-grid">
                  {palette.map((c, i) => (
                    <div
                      key={i}
                      className="color-cell"
                      style={{ background: c.hex, color: isDark(c.hex) ? '#fffaf2' : '#1c1611' }}
                      onClick={() => copyHex(c.hex)}
                      title="Click to copy"
                    >
                      <div className="role">{c.role}</div>
                      <div>{c.hex.toUpperCase()}</div>
                      {c.pct != null && <div style={{ opacity: 0.7 }}>{c.pct}%</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="section">
                <div className="section-h">
                  <span>Export</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" onClick={() => exportAs('css')}>
                    <I.Copy size={12} /> CSS vars
                  </Button>
                  <Button size="sm" onClick={() => exportAs('tailwind')}>
                    <I.Copy size={12} /> Tailwind
                  </Button>
                  <Button size="sm" onClick={() => exportAs('figma')}>
                    <I.Copy size={12} /> Figma styles
                  </Button>
                  <Button size="sm" onClick={() => exportAs('ase')}>
                    <I.Copy size={12} /> .ase
                  </Button>
                </div>
              </div>
            </>
          )}
          {tab === 'similar' &&
            (() => {
              // Real similarity by tag overlap + platform compatibility.
              // A `dashboard` tag means very different things on mobile-ui vs
              // desktop-web, so we treat platform tags as a hard exclusion:
              // when both items have a platform tag and they differ, no match.
              const PLATFORMS = new Set(['mobile-ui', 'tablet-ui', 'desktop-web', 'desktop-app'])
              const myTags = new Set(item.tags || [])
              const myPlatform = (item.tags || []).find((t) => PLATFORMS.has(t))
              const similar = items
                .filter((i) => i.id !== item.id && i.tags?.some((t) => myTags.has(t)))
                .map((i) => {
                  const otherPlatform = (i.tags || []).find((t) => PLATFORMS.has(t))
                  return {
                    item: i,
                    // Don't count the shared platform tag itself as "similarity
                    // signal" — every mobile UI shares `mobile-ui`, that's noise.
                    shared: (i.tags || []).filter((t) => myTags.has(t) && !PLATFORMS.has(t)),
                    otherPlatform
                  }
                })
                .filter((s) => {
                  // Hard exclude when both sides declare a platform AND they differ.
                  if (myPlatform && s.otherPlatform && myPlatform !== s.otherPlatform) return false
                  // Require at least one non-platform shared tag (otherwise the
                  // only thing they had in common was the platform itself).
                  return s.shared.length > 0
                })
                .sort((a, b) => b.shared.length - a.shared.length)
                .slice(0, 8)
              if (myTags.size === 0)
                return (
                  <div className="section">
                    <div className="muted" style={{ fontSize: 13 }}>
                      No tags on this item yet — can&apos;t look for similar things.
                    </div>
                  </div>
                )
              if (similar.length === 0)
                return (
                  <div className="section">
                    <div className="muted" style={{ fontSize: 13 }}>
                      Nothing in your library shares tags with this item yet.
                    </div>
                  </div>
                )
              return (
                <div className="section">
                  <div className="section-h">
                    <span>From your library</span>
                    <span className="num">{similar.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {similar.map((s) => (
                      <div
                        key={s.item.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                      >
                        <div
                          style={{
                            aspectRatio: s.item.kind === 'link' ? 16 / 10 : (s.item.aspect ?? 1),
                            background: s.item.screenshot
                              ? `${s.item.kind === 'link' ? 'top' : 'center'}/cover url(${s.item.screenshot})`
                              : s.item.bg ||
                                (s.item.palette
                                  ? `linear-gradient(135deg, ${s.item.palette[0]}, ${s.item.palette[2]})`
                                  : 'var(--bg-soft)'),
                            borderRadius: 8,
                            border: '1px solid var(--hair)'
                          }}
                        />
                        <div
                          className="mono"
                          style={{
                            fontSize: 10.5,
                            color: 'var(--ink-3)',
                            display: 'flex',
                            gap: 4,
                            flexWrap: 'wrap'
                          }}
                          title={s.item.title}
                        >
                          {s.shared.slice(0, 3).map((t) => (
                            <span key={t}>· {t}</span>
                          ))}
                          {s.shared.length > 3 && <span>· +{s.shared.length - 3}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
        </div>
      </div>
      {lightbox && item.screenshot && (
        <Lightbox src={item.screenshot} alt={item.title} onClose={() => setLightbox(false)} />
      )}
    </>
  )
}
