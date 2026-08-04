import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile} from 'remotion';
import {system} from './system/sceneSystem';
import {scenes} from './scenes';
import {timeline, voFile} from './timeline';
import {Grain} from './system/Grain';
import {Captions} from './system/Captions';
import {Letterbox} from './system/Letterbox';

// STORY-005 HI (The Villain Was Right, Hindi): no card scenes, captions never suppress.
const SUPPRESS: Array<[number, number]> = [];

// Music arc: urgent staccato-string pulse through the public shaming; the
// emotional swell takes over at the door (17.6s) and end-fades so the
// Hindi WHAT IF card sits on the brand music-box note alone.
const MUSIC_A_END = Math.round(21.2 * 30);
const MUSIC_B_FROM = Math.round(17.6 * 30);
const MUSIC_B_LEN = Math.round((42.7 - 17.6) * 30);
// Audio law (Sanjay 2026-08-04): VO is the main character; bed gains are set
// by MEASUREMENT. VO means -24.6dB (EN) / -24.1dB (HI); both beds mean
// ~-14.6dB, so 0.045 puts them ~17dB under the voice. slap-crack measures
// -36.9dB raw: 0.9 lands it ~12dB under VO — a real spike accent, not a bed.
const SFX: Array<{file: string; from: number; volume: number}> = [
  {file: 'sfx/paper-whoosh-soft.mp3', from: 0, volume: 0.3},
  {file: 'sfx/slap-crack-soft.mp3', from: Math.round(5.6 * 30), volume: 0.9},
  {file: 'sfx/sub-pulse-soft.mp3', from: Math.round(22.4 * 30), volume: 0.32},
  {file: 'sfx/music-box-note.mp3', from: Math.round(38.3 * 30), volume: 1.0},
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
    FICTIONAL CONFESSION
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
        src={staticFile('vo/story-005-music-a.mp3')}
        volume={(f) => interpolate(f, [0, 30, MUSIC_A_END - 60, MUSIC_A_END], [0, 0.045, 0.045, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    <Sequence from={MUSIC_B_FROM} durationInFrames={MUSIC_B_LEN}>
      <Audio
        src={staticFile('vo/story-005-music-b.mp3')}
        volume={(f) => interpolate(f, [0, 120, MUSIC_B_LEN - 117, MUSIC_B_LEN], [0, 0.045, 0.045, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
      />
    </Sequence>
    {SFX.map((s) => (
      <Sequence key={s.file + s.from} from={s.from}>
        <Audio src={staticFile(s.file)} volume={s.volume} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
