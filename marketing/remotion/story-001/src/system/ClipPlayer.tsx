// Shared player for the Flow-generated clips. If the narration slot is longer
// than the clip, the clip slows to fit (a 10s clip in an 11.6s slot plays at
// 0.86x — invisible for noir pacing). If the slot is shorter, the sequence
// simply trims the tail. Clip SFX stays low under the narration.
//
// cropBottom: Flow stamps a watermark near the bottom edge; stills/clips are
// generated with an empty bottom band, and this crop cuts that band off by
// oversizing the video and anchoring it to the top.
import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useVideoConfig} from 'remotion';

export const ClipPlayer: React.FC<{src: string; clipSeconds: number; sfxVolume: number; cropBottom?: number; startFromSeconds?: number}> = ({
  src,
  clipSeconds,
  sfxVolume,
  cropBottom = 0.2,
  startFromSeconds = 0,
}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const slotSeconds = durationInFrames / fps;
  const playbackRate = clipSeconds < slotSeconds ? clipSeconds / slotSeconds : 1;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <OffthreadVideo
        src={staticFile(src)}
        startFrom={Math.round(startFromSeconds * fps)}
        playbackRate={playbackRate}
        volume={sfxVolume}
        style={{width: '100%', height: `${100 / (1 - cropBottom)}%`, objectFit: 'cover', objectPosition: 'top'}}
      />
    </AbsoluteFill>
  );
};
