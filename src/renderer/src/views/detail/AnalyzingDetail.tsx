// AnalyzingDetail.tsx — shown in the detail overlay while a pasted item is still
// being captured/analyzed in the background. Left: the placeholder shot with a
// particle scan animation; right: a 3-step progress trail + live "thinking" stream.

import type { Item } from '../../lib/types'
import { I } from '../../lib/icons'

/** Keep only the model's prose preamble — drop the JSON tail it streams after. */
function thinkOf(s: string): string {
  if (!s) return ''
  const cuts = [s.indexOf('```'), s.indexOf('{')].filter((i) => i >= 0)
  const cut = cuts.length ? Math.min(...cuts) : -1
  return (cut >= 0 ? s.slice(0, cut) : s).trim()
}

type StepState = 'done' | 'active' | 'queue'

/**
 * Derive 3-step progress from the item's live state:
 *  1. Capturing screenshots   — driven by progress text ("Captured N pages…")
 *  2. Vision is reading them  — streamText starts arriving (prose preamble)
 *  3. Writing DESIGN.md JSON  — streamText hits ``` or { (model switched to JSON)
 */
function deriveSteps(item: Item): {
  capturing: StepState
  thinking: StepState
  writing: StepState
} {
  const prog = (item.progress || '').toLowerCase()
  const stream = item.streamText || ''
  const inJson = /```|\{/.test(stream)
  const analyzing = prog.includes('analyz')
  if (inJson) return { capturing: 'done', thinking: 'done', writing: 'active' }
  if (analyzing || stream.length > 0)
    return { capturing: 'done', thinking: 'active', writing: 'queue' }
  return { capturing: 'active', thinking: 'queue', writing: 'queue' }
}

function StepRow({
  state,
  label,
  detail
}: {
  state: StepState
  label: string
  detail?: React.ReactNode
}): React.JSX.Element {
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
  const steps = deriveSteps(item)
  const pages = item.capturedPages || item.design?.pages || []

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
              // Show every captured page (and every slice within) — the whole
              // stack scans at once, so it feels like vision is reading all of
              // them in parallel (which it actually is — one multi-image request).
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
                  {/* Page name tag in the corner */}
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
                  {/* Per-page scan overlay, staggered start so they cascade */}
                  {steps.thinking !== 'queue' && steps.writing !== 'done' && (
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
              // Single image (or no pages yet) — keep the original single-frame look
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
            <StepRow
              state={steps.capturing}
              label={isLink ? 'Capturing screenshots' : 'Reading the image'}
              detail={
                isLink && pages.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: 6 }}>
                      {pages.length} page{pages.length > 1 ? 's' : ''}
                      {steps.capturing === 'active' ? ' so far…' : ' captured'}
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
                ) : steps.capturing === 'active' ? (
                  item.progress
                ) : undefined
              }
            />
            <StepRow
              state={steps.thinking}
              label="Vision is reading the design"
              detail={
                steps.thinking === 'active' ? (
                  <div className="ai-stream">
                    {thinking || 'Looking at the design…'}
                    <span className="caret" />
                  </div>
                ) : steps.thinking === 'done' && thinking ? (
                  <div className="ai-stream" style={{ opacity: 0.8 }}>
                    {thinking}
                  </div>
                ) : undefined
              }
            />
            <StepRow
              state={steps.writing}
              label="Writing DESIGN.md"
              detail={
                steps.writing === 'active' ? (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    extracting palette · type · components…
                  </span>
                ) : undefined
              }
            />
          </div>
        </div>
      </div>
    </>
  )
}
