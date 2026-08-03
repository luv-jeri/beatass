import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {system} from '../../system/sceneSystem';
import {Reveal} from '../../system/Reveal';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

export const Scene: React.FC<Props> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: system.springs.settle});
  return (
    <AbsoluteFill style={{backgroundColor: system.bg, justifyContent: 'center', alignItems: 'center'}}>
      <div style={{width: '84%', background: system.paper, borderRadius: 10, padding: '90px 70px',
        transform: `rotate(-1.2deg) translateY(${(1 - enter) * 80}px)`, opacity: enter,
        boxShadow: `0 0 140px ${system.accentSoft}`, display: 'flex', flexDirection: 'column', gap: 48}}>
        <Reveal at={Number(p.topAt)}>
          <div style={{...system.type.label, color: system.accentSoft}}>TOP LINE</div>
          <div style={{...system.type.h2, color: system.ink, marginTop: 10}}>{String(p.topText)}</div>
        </Reveal>
        <Reveal at={Number(p.bottomAt)}>
          <div style={{...system.type.label, color: system.accentSoft}}>BOTTOM LINE</div>
          <div style={{...system.type.h2, color: system.ink, marginTop: 10}}>{String(p.bottomText)}</div>
        </Reveal>
        <Reveal at={Number(p.ruledAt)}>
          <div style={{...system.type.label, color: system.ink, border: `3px solid ${system.ink}`,
            display: 'inline-block', padding: '10px 18px', transform: 'rotate(-2deg)'}}>{String(p.ruledText)}</div>
        </Reveal>
        <Reveal at={Number(p.titleAt)}>
          <div style={{...system.type.label, color: system.accentSoft, fontSize: 40}}>{String(p.titleText)}</div>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};

export default Scene;
