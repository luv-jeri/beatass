import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile} from 'remotion';
import {system} from './system/sceneSystem';
import {scenes} from './scenes';
import {timeline, voFile} from './timeline';
import {Grain} from './system/Grain';
import {Captions} from './system/Captions';
import {Letterbox} from './system/Letterbox';

// STORY-002 P1 (The Wedding Gift): no card scenes, captions never suppress.
const SUPPRESS: Array<[number, number]> = [];

// Music arc: curious felt-piano only while the hook still smells like a wedding
// story; the dark drone takes over at the bedroom discovery (6.5s) and
// end-fades at ~34.6s so "So I went quiet. And I started planning." sits on
// the sting alone.
const MUSIC_A_END = Math.round((6.5 + 2.4) * 30);
const MUSIC_B_FROM = Math.round(6.5 * 30);
const MUSIC_B_LEN = Math.round(28.1 * 30);
// Audio law (Sanjay 2026-08-04): VO is the main character; bed gains are set
// by MEASUREMENT. This VO means -24.4dB, both beds mean -14.3dB, so 0.044
// puts the beds ~17dB under the voice (same margin the approved story-003
// mix used). SFX are the ear-approved soft accents at their approved gains.
const SFX: Array<{file: string; from: number; volume: number}> = [
  {file: 'sfx/paper-whoosh-soft.mp3', from: 0, volume: 0.3},
  {file: 'sfx/sub-pulse-soft.mp3', from: Math.round(6.5 * 30), volume: 0.32},
  {file: 'sfx/sting-soft.mp3', from: Math.round(36.3 * 30), volume: 0.32},
];

// Honesty label: every dark-story reel opens with FICTIONAL STORY (product
// line, CONCEPTS-DARK.md). Sits inside the top letterbox bar, first 2.5s.
const FictionalTag: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: '3.2%',
      width: '100%',
      textAlign: 'center',
      ...system.type.label,
      fontSize: 26,
      color: system.paper,
      opacity: 0.85,
    }}
  >
    FICTIONAL STORY
  </div>
);

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
    <Sequence from={0} durationInFrames={75}>
      <FictionalTag />
    </Sequence>
    {voFile ? <Audio src={staticFile(voFile)} /> : null}
    <Sequence from={0} durationInFrames={MUSIC_A_END}>
      <Audio
        src={staticFile('vo/part-1-v3-music-a.mp3')}
        volume={(f) => interpolate(f, [0, 30, MUSIC_A_END - 60, MUSIC_A_END], [0, 0.044, 0.044, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    <Sequence from={MUSIC_B_FROM} durationInFrames={MUSIC_B_LEN}>
      <Audio
        src={staticFile('vo/part-1-v3-music-b.mp3')}
        volume={(f) => interpolate(f, [0, 120, MUSIC_B_LEN - 117, MUSIC_B_LEN], [0, 0.044, 0.044, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    {SFX.map((s) => (
      <Sequence key={s.file + s.from} from={s.from}>
        <Audio src={staticFile(s.file)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
