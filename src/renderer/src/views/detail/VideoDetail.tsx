// VideoDetail.tsx — keyframe-based video viewer.
//
// Stage = the current keyframe; below it sits the per-frame motion caption.
// A horizontal strip of all keyframes supports click-to-jump and hover-to-scrub
// (mouse X position maps linearly to frame index — same feel as a video editor
// timeline). A ▶ button auto-cycles frames at 1 fps so the user can preview the
// sequence without dragging.
//
// Right panel reuses LinkDetail's analysis components (palette/theme/motion/
// etc.) since the underlying DesignDoc shape is identical, plus a "Sequence"
// tab that surfaces the video-specific fields (sequence / transitions /
// motionVerbs) written by analyzeVideo.

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { DesignDoc, Item } from '../../lib/types'
import { I } from '../../lib/icons'
import { copyToClipboard, useToast } from '../../components/Toast'
import { Button } from '../../components/ui'
import { useStore } from '../../lib/store'
import { Lightbox } from './Lightbox'
import {
  PromptTab,
  ThemeAnalysis,
  PaletteAnalysis,
  TypeAnalysis,
  ComponentsAnalysis
} from './LinkDetail'

// Video-only tab set — drops Layout/Motion/Guards/A11y from the site/image
// tabs since those don't apply to a keyframe sequence (the sequence narrative
// + per-frame motion captions already cover motion + IA).
type TabId = 'prompt' | 'sequence' | 'theme' | 'palette' | 'type' | 'components'

const TABS: { id: TabId; label: string }[] = [
  { id: 'prompt', label: 'Prompt' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'theme', label: 'Theme' },
  { id: 'palette', label: 'Palette' },
  { id: 'type', label: 'Type' },
  { id: 'components', label: 'Components' }
]

const PLAYBACK_FPS = 1.5 // gentle preview speed — fast enough to feel like motion, slow enough to read

export function VideoDetail({
  item,
  onShare
}: {
  item: Item
  onShare: () => void
}): React.JSX.Element {
  const toast = useToast()
  const { reanalyzeVideo } = useStore()
  const [tab, setTab] = useState<TabId>('prompt')
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(false)
  // Distinguish hover-scrub from sticky selection: a hovered frame snaps back
  // to the clicked one when the cursor leaves the strip.
  const [hoverFrame, setHoverFrame] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  const doc = item.design
  if (!doc) {
    return (
      <div className="detail-stage" style={{ display: 'grid', placeItems: 'center', padding: 40 }}>
        <div className="muted" style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>No analysis saved for this video.</div>
          <div style={{ fontSize: 12 }}>Drop a video file onto pit to capture + analyze.</div>
        </div>
      </div>
    )
  }

  const frames = doc.pages || []
  const showFrame = hoverFrame ?? frame
  const current = frames[showFrame] || frames[0]
  // Multi-page image items reuse this component but call them "images" and
  // hide the ▶ playback (no motion to scrub through).
  const isGroup = item.kind === 'image'
  const unitWord = isGroup ? 'image' : 'frame'
  const unitWordCap = isGroup ? 'Image' : 'Frame'

  // Auto-cycle frames when "play" is on. Pauses if the user starts scrubbing.
  useEffect(() => {
    if (!playing || frames.length < 2) return
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length)
    }, 1000 / PLAYBACK_FPS)
    return () => clearInterval(interval)
  }, [playing, frames.length])

  // Hover scrub — map mouse X across the strip to a frame index.
  const onStripMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!stripRef.current || frames.length === 0) return
    const rect = stripRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const t = Math.max(0, Math.min(1, x / rect.width))
    const idx = Math.min(frames.length - 1, Math.floor(t * frames.length))
    setHoverFrame(idx)
  }
  const onStripLeave = (): void => setHoverFrame(null)

  const copyStyle = (): void => {
    void copyToClipboard(doc.stylePrompt || doc.agentPrompt || doc.description || '')
    toast.push('Style prompt copied')
  }

  return (
    <>
      <div className="detail-stage" style={{ position: 'relative' }}>
        {current?.screenshot && (
          <button
            type="button"
            className="stage-expand"
            onClick={() => setLightbox(true)}
            title="Expand current frame (zoom + pan)"
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
            <span>
              {item.title}
              {current ? ` · ${current.name}` : ''}
            </span>
          </div>
          {!isGroup && (
            <button
              onClick={() => setPlaying((p) => !p)}
              className="ui-btn default sm no-drag"
              title={playing ? 'Pause' : 'Play sequence'}
              style={{ minWidth: 0, padding: '0 10px' }}
            >
              {playing ? '❚❚' : '▶'}
            </button>
          )}
          <div className="muted mono" style={{ fontSize: 11, marginLeft: 6 }}>
            {frames.length ? `${showFrame + 1} / ${frames.length}` : '—'}
          </div>
        </div>

        <div
          className="detail-stage-body"
          style={{ display: 'block', overflow: 'auto' }}
        >
          <div
            className="preview-frame"
            style={{
              width: '85%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            {current?.screenshot ? (
              <img
                src={current.screenshot}
                alt={current.name}
                style={{ display: 'block', width: '100%' }}
              />
            ) : (
              <div style={{ width: '100%', aspectRatio: 16 / 9, background: 'var(--bg-soft)' }} />
            )}
            {current?.motionDescription && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-soft)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  lineHeight: 1.5
                }}
              >
                <span className="muted mono" style={{ fontSize: 11, marginRight: 8 }}>
                  {unitWordCap.toUpperCase()} {showFrame + 1}
                </span>
                {current.motionDescription}
              </div>
            )}
          </div>
        </div>

        {/* frame strip with click-to-select + hover-to-scrub */}
        <div
          ref={stripRef}
          onMouseMove={onStripMove}
          onMouseLeave={onStripLeave}
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 18px 14px',
            borderTop: '1px solid var(--hair)',
            overflowX: 'auto'
          }}
        >
          {frames.map((p, i) => {
            const isLive = i === showFrame
            const isSticky = i === frame
            return (
              <div
                key={p.name + i}
                onClick={() => {
                  setFrame(i)
                  setPlaying(false)
                }}
                style={{
                  width: 64,
                  height: 44,
                  borderRadius: 6,
                  background: p.screenshot
                    ? `center/cover url(${p.screenshot})`
                    : 'var(--bg-soft)',
                  border: isLive
                    ? '2px solid var(--accent)'
                    : isSticky
                      ? '2px solid var(--ink)'
                      : '1px solid var(--hair)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.08s ease',
                  transform: isLive ? 'translateY(-2px)' : 'none'
                }}
                title={p.name}
              />
            )
          })}
        </div>
      </div>

      {/* right panel — reuses LinkDetail's tab content */}
      <div className="detail-panel">
        <div className="detail-head">
          <h2>{doc.title || item.title}</h2>
          <div className="muted mono" style={{ fontSize: 11 }}>
            {isGroup ? 'image group' : 'video'} · {frames.length} {unitWord}
            {frames.length === 1 ? '' : 's'}
          </div>
          <div className="tag-row">
            {(doc.tags || []).map((t) => (
              <span key={t} className="tag-pill ai">
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button size="sm" onClick={copyStyle}>
              <I.Copy size={13} /> Copy style prompt
            </Button>
            <Button size="sm" onClick={onShare}>
              <I.Share size={13} /> Share
            </Button>
          </div>
        </div>

        {item.error && (
          <div
            style={{
              margin: '12px 0 4px',
              padding: '10px 12px',
              background: 'color-mix(in oklab, #ff453a 10%, var(--bg-card))',
              borderLeft: '3px solid #ff453a',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--ink-2)',
              lineHeight: 1.5
            }}
            title={item.error}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <strong style={{ color: '#ff453a' }}>Analysis failed.</strong>{' '}
                {parseHumanError(item.error)}
              </div>
              <Button
                size="sm"
                onClick={() => reanalyzeVideo(item.id)}
                title="Re-run analysis on the existing keyframes"
              >
                <I.Sparkles size={12} /> Retry
              </Button>
            </div>
          </div>
        )}

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
          {tab === 'prompt' && <PromptTab doc={doc} currentPage={current} />}
          {tab === 'sequence' && <SequenceTab doc={doc} />}
          {tab === 'theme' && <ThemeAnalysis doc={doc} />}
          {tab === 'palette' && <PaletteAnalysis doc={doc} />}
          {tab === 'type' && <TypeAnalysis doc={doc} />}
          {tab === 'components' && <ComponentsAnalysis doc={doc} />}
        </div>
      </div>
      {lightbox && current?.screenshot && (
        <Lightbox
          src={current.screenshot}
          alt={current.name}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}

// Map raw error strings from the AI providers into a single-line, actionable
// hint. Falls through to the original message if no pattern matches.
function parseHumanError(raw: string): string {
  if (/HTTP 429|quota|rate.?limit/i.test(raw)) {
    return 'AI provider rate-limited or quota exhausted. Switch the design/video model in Settings, or wait for the quota window to reset.'
  }
  if (/HTTP 401|HTTP 403|unauthorized|invalid api/i.test(raw)) {
    return 'AI provider rejected the API key. Re-check it in Settings.'
  }
  if (/HTTP 5\d\d|timeout|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return 'AI provider returned a server/network error. Try again in a minute.'
  }
  // Strip the long IPC wrapper for readability.
  const trimmed = raw.replace(/^Error invoking remote method '[^']+':\s*/i, '').slice(0, 240)
  return trimmed
}

// Video-only tab — surfaces the sequence narrative, scene transitions, and
// the short motionVerbs vocabulary written by analyzeVideo's STYLE batch pass.
function SequenceTab({ doc }: { doc: DesignDoc }): React.JSX.Element {
  return (
    <div className="prompt-card">
      {doc.sequence && (
        <>
          <div className="hk">SEQUENCE · WHAT HAPPENS</div>
          <div className="pb-text md">
            <ReactMarkdown>{doc.sequence}</ReactMarkdown>
          </div>
        </>
      )}

      {doc.transitions && (
        <>
          <div className="hk" style={{ marginTop: 16 }}>
            TRANSITIONS
          </div>
          <div className="pb-text md">
            <ReactMarkdown>{doc.transitions}</ReactMarkdown>
          </div>
        </>
      )}

      {doc.motionVerbs && doc.motionVerbs.length > 0 && (
        <>
          <div className="hk" style={{ marginTop: 16 }}>
            MOTION VOCABULARY
          </div>
          <div className="tag-row" style={{ marginTop: 8 }}>
            {doc.motionVerbs.map((v) => (
              <span key={v} className="tag-pill ai">
                {v}
              </span>
            ))}
          </div>
        </>
      )}

      {!doc.sequence && !doc.transitions && (!doc.motionVerbs || doc.motionVerbs.length === 0) && (
        <div className="muted" style={{ padding: 16, textAlign: 'center' }}>
          Sequence analysis pending — re-import with an AI model configured.
        </div>
      )}
    </div>
  )
}
