import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile} from 'remotion';
import {system} from './system/sceneSystem';
import {scenes} from './scenes';
import {timeline, voFile} from './timeline';
import {Grain} from './system/Grain';
import {Captions} from './system/Captions';
import {Letterbox} from './system/Letterbox';

// STORY-003: no card scenes, so captions never suppress.
const SUPPRESS: Array<[number, number]> = [];

// STORY-003 music arc: curious felt-piano while the cottage still feels like
// shelter, dark drone from the paintings beat (25.7s) to the end. The drone
// is 28.1s long so it end-fades before the final card — the last seconds sit
// on the sting alone.
const MUSIC_A_END = Math.round((25.7 + 3.6) * 30);
const MUSIC_B_FROM = Math.round(25.7 * 30);
const MUSIC_B_LEN = Math.round(28.1 * 30);
// v3 audio law (Sanjay 2026-08-04): the VO is the main character; music and
// SFX are side characters. Three soft accents only, never louder than speech.
const SFX: Array<{file: string; from: number; volume: number}> = [
  {file: 'sfx/paper-whoosh-soft.mp3', from: 0, volume: 0.3},
  {file: 'sfx/sub-pulse-soft.mp3', from: Math.round(45.4 * 30), volume: 0.32},
  {file: 'sfx/sting-soft.mp3', from: Math.round(51.6 * 30), volume: 0.32},
];

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
    <Letterbox fraction={0.12} />
    {voFile ? <Audio src={staticFile(voFile)} /> : null}
    <Sequence from={0} durationInFrames={MUSIC_A_END}>
      <Audio
        src={staticFile('vo/part-1-v3-music-a.mp3')}
        volume={(f) => interpolate(f, [0, 30, MUSIC_A_END - 90, MUSIC_A_END], [0, 0.12, 0.12, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    <Sequence from={MUSIC_B_FROM} durationInFrames={MUSIC_B_LEN}>
      <Audio
        src={staticFile('vo/part-1-v3-music-b.mp3')}
        volume={(f) => interpolate(f, [0, 120, MUSIC_B_LEN - 90, MUSIC_B_LEN], [0, 0.14, 0.14, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    {SFX.map((s) => (
      <Sequence key={s.file + s.from} from={s.from}>
        <Audio src={staticFile(s.file)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
