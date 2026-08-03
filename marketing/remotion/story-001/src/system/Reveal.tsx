// Shared timed reveal: children pop in (system spring) at `at` seconds.
import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {system} from './sceneSystem';

export const Reveal: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const f = frame - at * fps;
  if (f < 0) return null;
  const s = spring({frame: f, fps, config: system.springs.pop});
  return (
    <div style={{transform: `scale(${0.94 + 0.06 * s})`, opacity: Math.min(1, s * 1.4)}}>
      {children}
    </div>
  );
};
