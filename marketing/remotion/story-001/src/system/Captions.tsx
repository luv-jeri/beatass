// Word-synced karaoke captions from the ElevenLabs alignment. Chunks of up to
// three words pop in on their spoken time. Suppressed during card scenes
// (cards carry their own text).
import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {system} from './sceneSystem';
import {words} from '../captions-data';

type Chunk = {text: string; s: number; e: number};

const buildChunks = (): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: {ws: string[]; s: number; e: number} | null = null;
  for (const w of words) {
    const endsSentence = /[.?!;:]$/.test(w.w);
    if (!cur) cur = {ws: [w.w], s: w.s, e: w.e};
    else if (cur.ws.length >= 3 || w.s - cur.e > 0.6) {
      chunks.push({text: cur.ws.join(' '), s: cur.s, e: cur.e});
      cur = {ws: [w.w], s: w.s, e: w.e};
    } else {
      cur.ws.push(w.w);
      cur.e = w.e;
    }
    if (cur && endsSentence) {
      chunks.push({text: cur.ws.join(' '), s: cur.s, e: cur.e});
      cur = null;
    }
  }
  if (cur) chunks.push({text: cur.ws.join(' '), s: cur.s, e: cur.e});
  return chunks;
};

export const Captions: React.FC<{suppress: Array<[number, number]>}> = ({suppress}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const chunks = useMemo(buildChunks, []);
  if (suppress.some(([a, b]) => t >= a && t < b)) return null;
  const active = chunks.find((c) => t >= c.s - 0.05 && t < c.e + 0.2);
  if (!active) return null;
  const age = (t - (active.s - 0.05)) * fps;
  const scale = interpolate(age, [0, 4], [0.9, 1], {extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', pointerEvents: 'none'}}>
      <div
        style={{
          ...system.type.caption,
          color: system.paper,
          textShadow: `0 0 24px ${system.ink}, 0 4px 0 ${system.ink}, 0 -4px 0 ${system.ink}, 4px 0 0 ${system.ink}, -4px 0 0 ${system.ink}`,
          transform: `scale(${scale})`,
          textAlign: 'center',
          maxWidth: '86%',
          marginBottom: 420,
        }}
      >
        {active.text}
      </div>
    </AbsoluteFill>
  );
};
