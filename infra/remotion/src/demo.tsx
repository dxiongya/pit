// Real-product demo scenes — actual pit screenshots (captured from the running
// app, in public/demo/) framed in a window with motion + a moving cursor, so the
// video shows the genuine workflow, not just abstract graphics.

import React from 'react'
import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C } from './theme'
import { Eyebrow, FadeUp, Headline, Scene, useEnter } from './ui'

const TrafficLights: React.FC = () => (
  <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
    {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
      <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />
    ))}
  </div>
)

/** Window-chrome frame around a screenshot, with an enter pop + slow Ken Burns. */
const DemoFrame: React.FC<{
  src: string
  label: string
  delay?: number
  /** Ken Burns end-scale and pan (% of image) over the scene. */
  zoomTo?: number
  panTo?: [number, number]
  width?: number
}> = ({ src, label, delay = 4, zoomTo = 1, panTo = [0, 0], width = 800 }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const enter = useEnter(delay, 24)
  const t = interpolate(frame, [delay, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const scale = interpolate(t, [0, 1], [1, zoomTo])
  const px = interpolate(t, [0, 1], [0, panTo[0]])
  const py = interpolate(t, [0, 1], [0, panTo[1]])
  return (
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: 'hidden',
        background: C.card,
        border: `1px solid ${C.hair2}`,
        boxShadow: '0 44px 110px rgba(0,0,0,0.6)',
        transform: `translateY(${(1 - enter) * 44}px) scale(${0.95 + enter * 0.05})`,
        opacity: enter
      }}
    >
      <div
        style={{
          height: 40,
          background: C.bg2,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          borderBottom: `1px solid ${C.hair}`,
          position: 'relative'
        }}
      >
        <TrafficLights />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: C.ink3
          }}
        >
          {label}
        </div>
      </div>
      {/* aspect locked to the capture (1280×832 web content); slight upward
          shift trims the app's own empty titlebar strip. */}
      <div style={{ aspectRatio: '1280 / 800', overflow: 'hidden' }}>
        <Img
          src={staticFile(src)}
          style={{
            width: '100%',
            display: 'block',
            marginTop: '-2.5%',
            transform: `scale(${scale}) translate(${px}%, ${py}%)`,
            transformOrigin: 'center center'
          }}
        />
      </div>
    </div>
  )
}

/** A macOS-style pointer that eases from → to and pulses a click ring at clickAt. */
const Cursor: React.FC<{
  from: [number, number]
  to: [number, number]
  startAt?: number
  clickAt?: number
}> = ({ from, to, startAt = 8, clickAt }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const p = interpolate(frame, [startAt, startAt + fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const x = interpolate(p, [0, 1], [from[0], to[0]])
  const y = interpolate(p, [0, 1], [from[1], to[1]])
  const click =
    clickAt != null
      ? interpolate(frame, [clickAt, clickAt + 14], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp'
        })
      : 0
  return (
    <>
      {click > 0 && click < 1 && (
        <div
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: 70,
            height: 70,
            marginLeft: -35,
            marginTop: -35,
            borderRadius: '50%',
            border: `3px solid ${C.accent2}`,
            transform: `scale(${click})`,
            opacity: 1 - click
          }}
        />
      )}
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))'
        }}
      >
        <path d="M4 2l6 16 2.5-6.5L19 9z" fill="#fff" stroke="#000" strokeWidth="1.2" />
      </svg>
    </>
  )
}

const Header: React.FC<{ eyebrow: string; color: string; headline: string }> = ({
  eyebrow,
  color,
  headline
}) => (
  <FadeUp style={{ textAlign: 'center', marginBottom: 18 }}>
    <Eyebrow color={color}>{eyebrow}</Eyebrow>
    <Headline size={46}>{headline}</Headline>
  </FadeUp>
)

// ── Step 1: Capture (real library + ⌘V + cursor) ──────────────────────────
export const CaptureDemo: React.FC = () => {
  const kbd = useEnter(40, 18)
  return (
    <Scene style={{ flexDirection: 'column', justifyContent: 'center', padding: 30 }}>
      <Header eyebrow="Step 1 · Capture" color={C.accent} headline="Paste anything into your library." />
      <div style={{ position: 'relative' }}>
        <DemoFrame src="demo/library.png" label="pit — All" delay={4} zoomTo={1.04} panTo={[0, -2]} />
        <Cursor from={[20, 80]} to={[88, 8]} startAt={14} clickAt={38} />
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: -26,
            display: 'flex',
            gap: 10,
            opacity: kbd,
            transform: `translateY(${(1 - kbd) * 14}px)`
          }}
        >
          {['⌘', 'V'].map((k) => (
            <div
              key={k}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 24,
                fontWeight: 600,
                width: 48,
                height: 48,
                borderRadius: 12,
                background: C.cardHi,
                border: `1px solid ${C.hair2}`,
                boxShadow: '0 5px 0 rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {k}
            </div>
          ))}
        </div>
      </div>
    </Scene>
  )
}

// ── Step 2: Analyze (real DESIGN.md, Ken Burns into the panel) ─────────────
export const AnalyzeDemo: React.FC = () => (
  <Scene style={{ flexDirection: 'column', justifyContent: 'center', padding: 30 }}>
    <Header eyebrow="Step 2 · Analyze" color={C.purple} headline="AI reads it into a DESIGN.md." />
    <DemoFrame
      src="demo/analysis.png"
      label="acedesign.studio"
      delay={4}
      zoomTo={1.16}
      panTo={[14, 4]}
      width={840}
    />
  </Scene>
)

// ── Step 3: Organize (real collection) ────────────────────────────────────
export const CollectionsDemo: React.FC = () => (
  <Scene style={{ flexDirection: 'column', justifyContent: 'center', padding: 30 }}>
    <Header eyebrow="Step 3 · Organize" color={C.teal} headline="Auto-routed into collections." />
    <DemoFrame src="demo/collection.png" label="pit — Web" delay={4} zoomTo={1.05} panTo={[0, -3]} />
  </Scene>
)

// ── Step 4: Share (real subset picker + cursor on Create link) ────────────
export const ShareDemo: React.FC = () => (
  <Scene style={{ flexDirection: 'column', justifyContent: 'center', padding: 30 }}>
    <Header eyebrow="Step 4 · Share" color={C.amber} headline="Share just the parts you pick." />
    <div style={{ position: 'relative' }}>
      <DemoFrame src="demo/share.png" label="pit — Share" delay={4} zoomTo={1.06} panTo={[0, 2]} />
      <Cursor from={[20, 85]} to={[64, 78]} startAt={20} clickAt={64} />
    </div>
  </Scene>
)
