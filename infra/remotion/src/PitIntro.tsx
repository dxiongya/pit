// PitIntro — the full explainer, assembled as a Series of scenes.
// Total = 90+90+150+180+150+120+150+90 = 1020 frames = 34s @ 30fps.

import React from 'react'
import { AbsoluteFill, Series } from 'remotion'
import {
  AnalyzeScene,
  CaptureScene,
  CollectionsScene,
  DirectionScene,
  IntroScene,
  OutroScene,
  ProblemScene,
  ShareScene
} from './scenes'

export const PIT_INTRO_FRAMES = 1020

export const PitIntro: React.FC = () => (
  <AbsoluteFill>
    <Series>
      <Series.Sequence durationInFrames={90}>
        <IntroScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={90}>
        <ProblemScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <CaptureScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={180}>
        <AnalyzeScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={150}>
        <CollectionsScene />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <ShareScene />
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
