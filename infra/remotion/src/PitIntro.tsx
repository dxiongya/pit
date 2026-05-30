// PitIntro — the full explainer. Hook + problem (motion graphics), the four
// usage steps shown with REAL pit screenshots (demo.tsx), then direction + outro.
// Total = 90+90+160+190+150+160+150+90 = 1080 frames = 36s @ 30fps.

import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import { DirectionScene, IntroScene, OutroScene, ProblemScene } from './scenes'
import { AnalyzeDemo, CaptureDemo, CollectionsDemo, ShareDemo } from './demo'

export const PIT_INTRO_FRAMES = 1080

export const PitIntro: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={90}>
        <IntroScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90}>
        <ProblemScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={160}>
        <CaptureDemo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={190}>
        <AnalyzeDemo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <CollectionsDemo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={160}>
        <ShareDemo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <DirectionScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90}>
        <OutroScene />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
)
