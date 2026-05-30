// Shared motion + layout primitives for the pit explainer scenes.

import React from 'react'
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT, MONO } from './theme'

/** A 0→1 spring keyed off the scene-local frame, with an optional start delay. */
export const useEnter = (delay = 0, durationInFrames = 22): number => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({
    frame: frame - delay,
    fps,
    durationInFrames,
    config: { damping: 200 }
  })
}

/** Fade + rise wrapper. */
export const FadeUp: React.FC<{
  delay?: number
  y?: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ delay = 0, y = 26, children, style }) => {
  const s = useEnter(delay)
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * y}px)`, ...style }}>{children}</div>
  )
}

/** Scene shell: brand background, centered column, generous padding. */
export const Scene: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ children, style }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(130% 130% at 50% -10%, ${C.bg2} 0%, ${C.bg} 60%)`,
      fontFamily: FONT,
      color: C.ink,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 90,
      ...style
    }}
  >
    {children}
  </AbsoluteFill>
)

/** The "p" rounded-square logo mark with a spring pop. */
export const BrandMark: React.FC<{ size?: number; delay?: number }> = ({ size = 112, delay = 0 }) => {
  const s = useEnter(delay, 26)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(155deg, ${C.accent2}, ${C.accent})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontStyle: 'italic',
        fontWeight: 700,
        fontSize: size * 0.6,
        boxShadow: `0 24px 60px ${C.accent}55`,
        transform: `scale(${0.6 + s * 0.4})`,
        opacity: s
      }}
    >
      p
    </div>
  )
}

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.accent
}) => (
  <div
    style={{
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: 5,
      textTransform: 'uppercase',
      color
    }}
  >
    {children}
  </div>
)

export const Headline: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 66
}) => (
  <div style={{ fontSize: size, fontWeight: 700, letterSpacing: -2, lineHeight: 1.04, marginTop: 16 }}>
    {children}
  </div>
)

export const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontSize: 28,
      color: C.ink2,
      marginTop: 20,
      maxWidth: 920,
      textAlign: 'center',
      lineHeight: 1.45
    }}
  >
    {children}
  </div>
)

/** Keycap, e.g. ⌘ V. */
export const Kbd: React.FC<{ children: React.ReactNode; size?: number }> = ({
  children,
  size = 56
}) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: size * 0.5,
      fontWeight: 600,
      minWidth: size,
      height: size,
      padding: `0 ${size * 0.28}px`,
      borderRadius: 14,
      background: C.cardHi,
      border: `1px solid ${C.hair2}`,
      boxShadow: '0 6px 0 rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: C.ink
    }}
  >
    {children}
  </div>
)

/** Rounded surface card used across scenes. */
export const Card: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ children, style }) => (
  <div
    style={{
      background: C.card,
      border: `1px solid ${C.hair}`,
      borderRadius: 20,
      boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      ...style
    }}
  >
    {children}
  </div>
)

export const Pill: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = C.ink2
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 20px',
      borderRadius: 999,
      background: C.card,
      border: `1px solid ${C.hair}`,
      fontSize: 24,
      color
    }}
  >
    {children}
  </div>
)
