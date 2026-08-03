import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, staticFile} from 'remotion';
import {system} from './system/sceneSystem';
import {scenes} from './scenes';
import {timeline, voFile} from './timeline';
import {Grain} from './system/Grain';
import {Captions} from './system/Captions';

// Captions hide where a card scene carries its own text (absolute seconds).
const SUPPRESS: Array<[number, number]> = [[0, 4.1], [19.8, 34.4], [44.5, 999]];

export const Master: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: system.bg}}>
    <Img src={system.stageSrc} style={{position: 'absolute', width: '100%', height: '100%', objectFit: 'cover'}} />
    {timeline.map((t) => {
      const S = scenes[t.scene as keyof typeof scenes];
      return (
        <Sequence key={t.scene + t.from} from={t.from} durationInFrames={t.duration}>
          <S.component {...(S.defaults as Record<string, unknown>)} {...(t.props ?? {})} />
        </Sequence>
      );
    })}
    <Captions suppress={SUPPRESS} />
    <Grain opacity={0.1} vignette={0.45} />
    {voFile ? <Audio src={staticFile(voFile)} /> : null}
    <Audio src={staticFile('vo/part-1-music.mp3')} loop volume={0.16} />
  </AbsoluteFill>
);
