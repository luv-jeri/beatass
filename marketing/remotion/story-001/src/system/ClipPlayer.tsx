// Shared player for the Flow-generated clips. If the narration slot is longer
// than the clip, the clip slows to fit (a 10s clip in an 11.6s slot plays at
// 0.86x — invisible for noir pacing). If the slot is shorter, the sequence
// simply trims the tail. Clip SFX stays low under the narration.
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig} from 'remotion';

export const ClipPlayer: React.FC<{src: string; clipSeconds: number; sfxVolume: number}> = ({
  src,
  clipSeconds,
  sfxVolume,
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const slotSeconds = durationInFrames / fps;
  const playbackRate = clipSeconds < slotSeconds ? clipSeconds / slotSeconds : 1;
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(src)}
        playbackRate={playbackRate}
        volume={sfxVolume}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </AbsoluteFill>
  );
};
