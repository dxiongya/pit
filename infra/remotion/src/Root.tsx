import React from 'react'
import { Composition } from 'remotion'
import { PIT_INTRO_FRAMES, PitIntro } from './PitIntro'

export const RemotionRoot: React.FC = () => (
  <Composition
    id="PitIntro"
    component={PitIntro}
    durationInFrames={PIT_INTRO_FRAMES}
    fps={30}
    width={1280}
    height={720}
  />
)
