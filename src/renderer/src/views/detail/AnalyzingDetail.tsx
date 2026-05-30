// AnalyzingDetail.tsx — shown in the detail overlay while a pasted item is still
// being captured/analyzed in the background. Left: the placeholder shot(s) with a
// particle scan animation; right: a per-path progress trail that mirrors what the
// pipeline is ACTUALLY doing — special links read post content, generic sites add
// a source-code read (real palette/fonts/tech), images/video have their own steps.

import type { Item, SourceFacts } from '../../lib/types'
import { I } from '../../lib/icons'

/** Keep only the model's prose preamble — drop the JSON tail it streams after. */
function thinkOf(s: string): string {
  if (!s) return ''
  const cuts = [s.indexOf('```'), s.indexOf('{')].filter((i) => i >= 0)
  const cut = cuts.length ? Math.min(...cuts) : -1
  return (cut >= 0 ? s.slice(0, cut) : s).trim()
}

type StepState = 'done' | 'active' | 'queue'
interface Step {
  id: string
  label: string
  state: StepState
  detail?: React.ReactNode
}

/** Special source the item was pasted from (drives the first "read" step). The
 *  stub keeps kind:'image' during extraction, so we sniff the URL host. */
function specialKind(item: Item): 'tweet' | 'note' | null {
  const u = (item.url || '').toLowerCase()
  if (/(\/\/|\.)?(x\.com|twitter\.com|mobile\.twitter\.com)(\/|$)/.test(u)) return 'tweet'
  if (/xiaohongshu\.com|xhslink\.com/.test(u)) return 'note'
  return null
}

/** Coarse pipeline phase from the item's live signals (real, not guessed):
 *  - writing : the model switched to emitting JSON (``` or {)
 *  - visioning : prose is streaming / progress says it's analyzing
 *  - acqDone : the acquisition stage (capture / extract / frames) has finished */
function derivePhase(item: Item): { writing: boolean; visioning: boolean; acqDone: boolean } {
  const prog = (item.progress || '').toLowerCase()
  const stream = item.streamText || ''
  const writing = /```|\{/.test(stream)
  const visioning =
    !writing && (stream.length > 0 || /analyz|reading the design|motion/.test(prog))
  return { writing, visioning, acqDone: visioning || writing }
}

/** Real harvested source facts — the payoff of the source-read step. */
function SourceDetail({ s }: { s: SourceFacts }): React.JSX.Element {
  const colors = (s.palette || []).slice(0, 8)
  const fams = (s.fonts || []).slice(0, 3).map((f) => f.family)
  const tech = [...(s.tech?.framework || []), ...(s.tech?.cssMethod || [])]
  const logo = s.assets?.logo
  // Render the real logo SAFELY: untrusted site SVG is shown as an <img>
  // data-URL (img-loaded SVG can't run scripts), never injected into the DOM.
  // Inline SVG often lacks xmlns — add it so the standalone data-URL renders.
  const logoSvg =
    logo?.svg && !/xmlns=/.test(logo.svg)
      ? logo.svg.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
      : logo?.svg
  const logoSrc = logoSvg
    ? `data:image/svg+xml,${encodeURIComponent(logoSvg)}`
    : logo?.img || logo?.svgFavicon || logo?.appleTouchIcon || null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {logoSrc && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'flex-start',
            padding: '5px 9px',
            borderRadius: 6,
            background: '#fff',
            border: '1px solid var(--hair)'
          }}
        >
          <img
            src={logoSrc}
            alt="logo"
            style={{ height: 18, maxWidth: 130, objectFit: 'contain', display: 'block' }}
          />
        </div>
      )}
      {colors.length > 0 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {colors.map((c, i) => (
            <span
              key={i}
              title={c.hex}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: c.hex,
                border: '1px solid var(--hair)'
              }}
            />
          ))}
        </div>
      )}
      {fams.length > 0 && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {fams.join(' · ')}
        </div>
      )}
      {tech.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tech.map((t) => (
            <span key={t} className="tag-pill" style={{ fontSize: 10 }}>
              {t}
            </span>
          ))}
        </div>
      )}
      {s.colorTokenCount > 0 && (
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {s.colorTokenCount} color tokens
        </div>
      )}
    </div>
  )
}

/** Build the ordered step trail for THIS item's actual import path. */
function buildSteps(item: Item, captureDetail: React.ReactNode, thinking: string): Step[] {
  const { writing, visioning, acqDone } = derivePhase(item)
  const acq: StepState = acqDone ? 'done' : 'active'
  const vision: StepState = writing ? 'done' : visioning ? 'active' : 'queue'
  const write: StepState = writing ? 'active' : 'queue'

  const visionStep = (label: string): Step => ({
    id: 'vision',
    label,
    state: vision,
    detail:
      vision === 'active' ? (
        <div className="ai-stream">
          {thinking || 'Looking at the design…'}
          <span className="caret" />
        </div>
      ) : vision === 'done' && thinking ? (
        <div className="ai-stream" style={{ opacity: 0.8 }}>
          {thinking}
        </div>
      ) : undefined
  })
  const writeStep = (): Step => ({
    id: 'write',
    label: 'Writing DESIGN.md',
    state: write,
    detail:
      write === 'active' ? (
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          extracting palette · type · components…
        </span>
      ) : undefined
  })

  const sp = specialKind(item)
  if (sp) {
    return [
      {
        id: 'read',
        label: sp === 'tweet' ? 'Reading tweet content' : 'Reading note content',
        state: acq,
        detail:
          acq === 'active'
            ? item.progress || (sp === 'tweet' ? 'Fetching tweet…' : 'Fetching note…')
            : 'text + media extracted'
      },
      visionStep('Vision is reading the design'),
      writeStep()
    ]
  }

  if (item.kind === 'video') {
    return [
      {
        id: 'frames',
        label: 'Extracting keyframes',
        state: acq,
        detail: acq === 'active' ? item.progress : undefined
      },
      visionStep('Vision is reading the motion'),
      writeStep()
    ]
  }

  if (item.kind === 'link') {
    const pages = item.capturedPages || item.design?.pages || []
    const src = pages.find((p) => p.source)?.source
    return [
      { id: 'capture', label: 'Capturing screenshots', state: acq, detail: captureDetail },
      {
        id: 'source',
        label: 'Reading page source',
        state: src ? (acqDone ? 'done' : 'active') : acqDone ? 'done' : pages.length ? 'active' : 'queue',
        detail: src ? (
          <SourceDetail s={src} />
        ) : acq === 'active' ? (
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            colors · fonts · tokens · tech…
          </span>
        ) : undefined
      },
      visionStep('Vision is reading the design'),
      writeStep()
    ]
  }

  // single / group image
  return [
    {
      id: 'read',
      label: 'Reading the image',
      state: acq,
      detail: acq === 'active' ? item.progress : undefined
    },
    visionStep('Vision is reading the design'),
    writeStep()
  ]
}

function StepRow({ state, label, detail }: Step): React.JSX.Element {
  return (
    <div className={`step ${state}`}>
      <div className="bullet">
        <div className="b" />
      </div>
      <div className="body">
        <div className="ttl">{label}</div>
        {detail && <div className="det">{detail}</div>}
      </div>
    </div>
  )
}

export function AnalyzingDetail({ item }: { item: Item }): React.JSX.Element {
  const thinking = thinkOf(item.streamText || '')
  const isLink = item.kind === 'link'
  const name = (item.url || item.title || 'item').replace(/^https?:\/\//, '')
  const pages = item.capturedPages || item.design?.pages || []
  const { visioning, writing } = derivePhase(item)
  const scanning = visioning || writing

  // Capture-step detail: the live grid of captured pages (link path only).
  const captureDetail =
    isLink && pages.length > 0 ? (
      <div>
        <div style={{ marginBottom: 6 }}>
          {pages.length} page{pages.length > 1 ? 's' : ''}
          {derivePhase(item).acqDone ? ' captured' : ' so far…'}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
            gap: 6
          }}
        >
          {pages.map((p) => (
            <div key={p.name} title={`/${p.name}`}>
              <div
                style={{
                  aspectRatio: 16 / 10,
                  borderRadius: 4,
                  background: p.screenshot
                    ? `top center / cover url(${p.screenshot})`
                    : 'var(--bg-soft)',
                  border: '1px solid var(--hair)',
                  opacity: p.status === 'queue' ? 0.4 : 1
                }}
              />
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  color: 'var(--ink-3)',
                  marginTop: 3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                /{p.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    ) : undefined

  const steps = buildSteps(item, captureDetail, thinking)

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
            {isLink ? <I.Globe size={12} /> : <I.Image size={12} />}
            <span>{name}</span>
          </div>
        </div>
        <div className="detail-stage-body" style={{ overflow: 'auto' }}>
          <div
            style={{
              width: '88%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: '14px 0'
            }}
          >
            {isLink && pages.length > 0 ? (
              pages.map((p, pi) => (
                <div
                  key={p.name}
                  className="preview-frame"
                  style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}
                >
                  {p.slices?.length ? (
                    p.slices.map((src, si) => (
                      <img
                        key={si}
                        src={src}
                        alt={`${p.name}-${si}`}
                        style={{ display: 'block', width: '100%' }}
                      />
                    ))
                  ) : p.screenshot ? (
                    <img
                      src={p.screenshot}
                      alt={p.name}
                      style={{ display: 'block', width: '100%' }}
                    />
                  ) : (
                    <div style={{ aspectRatio: 16 / 10, background: 'var(--bg-soft)' }} />
                  )}
                  <div
                    className="mono"
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      padding: '3px 8px',
                      fontSize: 11,
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      zIndex: 5
                    }}
                  >
                    /{p.name}
                  </div>
                  {scanning && (
                    <div className="scan-overlay" style={{ '--page-i': pi } as React.CSSProperties}>
                      <div className="scan-grid" />
                      <div className="scan-line" />
                      <div className="scan-particles">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <span key={i} style={{ '--i': i } as React.CSSProperties} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div
                className="preview-frame"
                style={{ aspectRatio: item.aspect, position: 'relative', alignSelf: 'center' }}
              >
                {item.screenshot ? (
                  <img
                    src={item.screenshot}
                    alt={item.title}
                    style={{ display: 'block', width: '100%' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 480,
                      aspectRatio: item.aspect || 1.4,
                      background: 'var(--bg-soft)'
                    }}
                  />
                )}
                <div className="scan-overlay">
                  <div className="scan-grid" />
                  <div className="scan-line" />
                  <div className="scan-particles">
                    {Array.from({ length: 20 }).map((_, i) => (
                      <span key={i} style={{ '--i': i } as React.CSSProperties} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="detail-panel">
        <div className="detail-head">
          <h2>{item.title || 'Analyzing…'}</h2>
          <div
            className="muted"
            style={{ fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span className="scan-dot" />
            {item.progress || 'Analyzing…'}
          </div>
        </div>

        <div className="detail-panel-body">
          <div className="ai-log" style={{ padding: 0 }}>
            {steps.map((s) => (
              <StepRow key={s.id} {...s} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
