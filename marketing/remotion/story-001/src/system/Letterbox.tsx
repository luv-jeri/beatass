// Cinematic letterbox — solid black bars top and bottom, over everything.
import React from 'react';
import {AbsoluteFill} from 'remotion';

export const Letterbox: React.FC<{fraction?: number}> = ({fraction = 0.12}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: `${fraction * 100}%`, background: '#000'}} />
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: `${fraction * 100}%`, background: '#000'}} />
  </AbsoluteFill>
);
