// Film grain + vignette overlay — apply ONCE at Master level (map-scenes.md §5).
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

export const Grain: React.FC<{opacity?: number; vignette?: number}> = ({
  opacity = 0.14,
  vignette = 0.35,
}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2); // step every 2 frames — filmic, not video-noisy
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={seed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)"
          opacity={opacity} style={{mixBlendMode: 'overlay'}} />
      </svg>
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,${vignette}) 100%)`,
      }} />
    </AbsoluteFill>
  );
};
