// The eight scenes of the pit explainer: hook → problem → 4 usage steps →
// service direction → outro. Each scene gets a scene-local frame (Series resets
// useCurrentFrame to 0 per sequence), so enter delays are relative to its start.

import React from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, MONO } from './theme'
import { BrandMark, Card, Eyebrow, FadeUp, Headline, Kbd, Pill, Scene, Sub, useEnter } from './ui'

// ── 1. Intro ──────────────────────────────────────────────────────────────
export const IntroScene: React.FC = () => {
  const word = useEnter(14)
  return (
    <Scene style={{ flexDirection: 'column', gap: 8 }}>
      <BrandMark size={132} />
      <FadeUp delay={14} style={{ marginTop: 30 }}>
        <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -4, opacity: word }}>pit</div>
      </FadeUp>
      <FadeUp delay={26}>
        <div style={{ fontSize: 34, color: C.ink2, letterSpacing: 0.5 }}>
          your <span style={{ color: C.accent2, fontWeight: 600 }}>design-reference brain</span>
        </div>
      </FadeUp>
    </Scene>
  )
}

// ── 2. Problem ────────────────────────────────────────────────────────────
const Chip: React.FC<{ label: string; color: string; x: number; y: number; delay: number }> = ({
  label,
  color,
  x,
  y,
  delay
}) => {
  const s = useEnter(delay)
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: `translate(-50%,-50%) scale(${0.8 + s * 0.2})`,
        opacity: s,
        padding: '14px 24px',
        borderRadius: 14,
        background: C.card,
        border: `1px solid ${C.hair}`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        fontSize: 26,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 4, background: color }} />
      {label}
    </div>
  )
}

export const ProblemScene: React.FC = () => (
  <Scene>
    <Chip label="a website" color={C.blue} x={22} y={28} delay={4} />
    <Chip label="a tweet" color={C.teal} x={76} y={24} delay={9} />
    <Chip label="a screenshot" color={C.accent} x={18} y={70} delay={14} />
    <Chip label="小红书 note" color={C.purple} x={80} y={68} delay={19} />
    <Chip label="a screen recording" color={C.amber} x={50} y={82} delay={24} />
    <FadeUp delay={30} style={{ textAlign: 'center', zIndex: 2 }}>
      <Headline size={58}>References live everywhere.</Headline>
      <Sub>Bookmarks, camera roll, DMs, a hundred open tabs. None of it is searchable.</Sub>
    </FadeUp>
  </Scene>
)

// ── 3. Capture ────────────────────────────────────────────────────────────
export const CaptureScene: React.FC = () => {
  const sources = ['Websites', 'X / Twitter', '小红书', 'Image sets', 'Screen recordings']
  return (
    <Scene style={{ flexDirection: 'column' }}>
      <FadeUp>
        <Eyebrow>Step 1 · Capture</Eyebrow>
      </FadeUp>
      <FadeUp delay={6} style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 18 }}>
        <Kbd size={84}>⌘</Kbd>
        <Kbd size={84}>V</Kbd>
        <Headline size={62}>Paste anything.</Headline>
      </FadeUp>
      <FadeUp delay={18}>
        <Sub>Drop a link or image — or a whole share blob copied from an app.</Sub>
      </FadeUp>
      <div style={{ display: 'flex', gap: 16, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
        {sources.map((label, i) => (
          <FadeUp key={label} delay={28 + i * 6}>
            <Pill color={C.ink}>{label}</Pill>
          </FadeUp>
        ))}
      </div>
    </Scene>
  )
}

// ── 4. Analyze (the centerpiece) ──────────────────────────────────────────
const Swatch: React.FC<{ color: string; delay: number }> = ({ color, delay }) => {
  const s = useEnter(delay, 16)
  return (
    <div
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        background: color,
        transform: `scale(${s})`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)'
      }}
    />
  )
}

const MdRow: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <FadeUp delay={delay} y={14} style={{ fontFamily: MONO, fontSize: 23, color: C.ink2, lineHeight: 1.7 }}>
    {children}
  </FadeUp>
)

export const AnalyzeScene: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  // arrow gently pulses
  const pulse = interpolate(Math.sin((frame / fps) * 6), [-1, 1], [0.7, 1])
  return (
    <Scene style={{ flexDirection: 'column' }}>
      <FadeUp style={{ textAlign: 'center', marginBottom: 36 }}>
        <Eyebrow color={C.purple}>Step 2 · Analyze</Eyebrow>
        <Headline size={58}>AI reads the design.</Headline>
      </FadeUp>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {/* left: the captured reference */}
        <FadeUp delay={6} style={{ width: 360 }}>
          <Card style={{ overflow: 'hidden', width: 360, height: 250 }}>
            <div style={{ height: 150, background: `linear-gradient(135deg, ${C.blue}, ${C.purple})` }} />
            <div style={{ padding: 22 }}>
              <div style={{ height: 16, width: '70%', borderRadius: 6, background: C.hair2 }} />
              <div style={{ height: 12, width: '45%', borderRadius: 6, background: C.hair, marginTop: 12 }} />
            </div>
          </Card>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 22, color: C.ink3 }}>captured</div>
        </FadeUp>

        <div style={{ fontSize: 60, color: C.accent2, opacity: pulse }}>→</div>

        {/* right: the DESIGN.md it produces */}
        <FadeUp delay={20} style={{ width: 560 }}>
          <Card style={{ padding: 30, width: 560 }}>
            <div style={{ fontFamily: MONO, fontSize: 26, color: C.ink, marginBottom: 18 }}>
              <span style={{ color: C.accent2 }}>#</span> DESIGN.md
            </div>
            <MdRow delay={30}>
              <span style={{ color: C.ink3 }}>## palette</span>
            </MdRow>
            <FadeUp delay={36} style={{ display: 'flex', gap: 12, margin: '8px 0 16px' }}>
              {[C.blue, C.purple, C.accent, C.amber, C.teal].map((c, i) => (
                <Swatch key={c} color={c} delay={36 + i * 4} />
              ))}
            </FadeUp>
            <MdRow delay={56}>
              <span style={{ color: C.ink3 }}>## type</span> &nbsp;Inter / Berkeley Mono
            </MdRow>
            <MdRow delay={62}>
              <span style={{ color: C.ink3 }}>## components</span> &nbsp;cards · nav · pricing
            </MdRow>
            <MdRow delay={68}>
              <span style={{ color: C.ink3 }}>## tech</span> &nbsp;React · Tailwind · Next
            </MdRow>
          </Card>
        </FadeUp>
      </div>
      <FadeUp delay={80}>
        <Sub>
          Palette, type, components, layout &amp; motion — grounded in the page&apos;s real source,
          not guessed from a screenshot.
        </Sub>
      </FadeUp>
    </Scene>
  )
}

// ── 5. Collections ────────────────────────────────────────────────────────
const MiniTile: React.FC<{ color: string; delay: number }> = ({ color, delay }) => {
  const t = useEnter(delay, 14)
  return (
    <div
      style={{
        width: 60,
        height: 48,
        borderRadius: 8,
        background: `${color}33`,
        border: `1px solid ${color}66`,
        opacity: t,
        transform: `scale(${t})`
      }}
    />
  )
}

const Bucket: React.FC<{ name: string; color: string; delay: number }> = ({ name, color, delay }) => {
  const s = useEnter(delay)
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        width: 300,
        height: 200,
        borderRadius: 18,
        background: C.card,
        border: `1px solid ${C.hair}`,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, fontWeight: 600 }}>
        <span style={{ width: 16, height: 16, borderRadius: 5, background: color }} />
        {name}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <MiniTile key={i} color={color} delay={delay + 12 + i * 5} />
        ))}
      </div>
    </div>
  )
}

export const CollectionsScene: React.FC = () => (
  <Scene style={{ flexDirection: 'column' }}>
    <FadeUp style={{ textAlign: 'center', marginBottom: 40 }}>
      <Eyebrow color={C.teal}>Step 3 · Organize</Eyebrow>
      <Headline size={56}>Collections that file themselves.</Headline>
    </FadeUp>
    <div style={{ display: 'flex', gap: 28 }}>
      <Bucket name="Dashboards" color={C.blue} delay={10} />
      <Bucket name="Landing pages" color={C.accent} delay={20} />
      <Bucket name="Mobile UI" color={C.green} delay={30} />
    </div>
    <FadeUp delay={48}>
      <Sub>Describe a collection in plain words — new items auto-route to where they belong.</Sub>
    </FadeUp>
  </Scene>
)

// ── 6. Share ──────────────────────────────────────────────────────────────
export const ShareScene: React.FC = () => {
  const type = useEnter(28, 30)
  const url = 'pit.ink/p/'
  const code = 'a1b2c3'
  const shown = Math.floor(interpolate(type, [0, 1], [0, code.length]))
  return (
    <Scene style={{ flexDirection: 'column' }}>
      <FadeUp style={{ textAlign: 'center', marginBottom: 40 }}>
        <Eyebrow color={C.amber}>Step 4 · Share</Eyebrow>
        <Headline size={58}>One link. Just the good parts.</Headline>
      </FadeUp>
      <FadeUp delay={12}>
        <Card style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 30,
              color: C.ink,
              padding: '14px 24px',
              background: C.bg,
              borderRadius: 12,
              border: `1px solid ${C.hair}`
            }}
          >
            {url}
            <span style={{ color: C.accent2 }}>{code.slice(0, shown)}</span>
            <span style={{ opacity: shown < code.length ? 1 : 0 }}>|</span>
          </div>
          <div
            style={{
              padding: '14px 28px',
              borderRadius: 12,
              background: `linear-gradient(155deg, ${C.accent2}, ${C.accent})`,
              color: '#fff',
              fontSize: 26,
              fontWeight: 600
            }}
          >
            Copy
          </div>
        </Card>
      </FadeUp>
      <FadeUp delay={40}>
        <Sub>Share one item or a hand-picked subset — live preview, password, expiry.</Sub>
      </FadeUp>
    </Scene>
  )
}

// ── 7. Service direction ──────────────────────────────────────────────────
const Bullet: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <FadeUp delay={delay} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30 }}>
    <span style={{ color: C.accent2, fontSize: 30 }}>◆</span>
    <span style={{ color: C.ink }}>{children}</span>
  </FadeUp>
)

export const DirectionScene: React.FC = () => (
  <Scene style={{ flexDirection: 'column', alignItems: 'flex-start', paddingLeft: 160 }}>
    <FadeUp>
      <Eyebrow>Where it&apos;s going</Eyebrow>
    </FadeUp>
    <FadeUp delay={6}>
      <Headline size={62}>
        A design system
        <br />
        of record.
      </Headline>
    </FadeUp>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 40 }}>
      <Bullet delay={18}>Every reference, searchable design knowledge</Bullet>
      <Bullet delay={28}>Remix any style into new variations</Bullet>
      <Bullet delay={38}>
        Readable by agents through a built-in <span style={{ color: C.accent2 }}>MCP</span> server
      </Bullet>
    </div>
  </Scene>
)

// ── 8. Outro ──────────────────────────────────────────────────────────────
export const OutroScene: React.FC = () => (
  <Scene style={{ flexDirection: 'column', gap: 26 }}>
    <BrandMark size={104} />
    <FadeUp delay={10} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>pit</div>
      <div style={{ fontSize: 30, color: C.ink2, marginTop: 8 }}>
        capture it. understand it. ship it.
      </div>
    </FadeUp>
    <FadeUp delay={24}>
      <Pill color={C.ink}>
        <span style={{ color: C.accent2 }}>↓</span> github.com/dxiongya/pit
      </Pill>
    </FadeUp>
  </Scene>
)
