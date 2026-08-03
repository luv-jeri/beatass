import React from 'react';
import {AbsoluteFill} from 'remotion';
import {system} from '../../system/sceneSystem';
import {Reveal} from '../../system/Reveal';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

export const Scene: React.FC<Props> = (p) => (
  <AbsoluteFill style={{backgroundColor: system.bg, justifyContent: 'center', alignItems: 'center'}}>
    <div style={{display: 'flex', flexDirection: 'column', gap: 56, alignItems: 'center', maxWidth: '86%', textAlign: 'center'}}>
      <Reveal at={Number(p.labelAt)}>
        <div style={{...system.type.label, color: system.accentSoft}}>{String(p.labelText)}</div>
      </Reveal>
      <Reveal at={Number(p.line1At)}>
        <div style={{...system.type.h1, color: system.paper}}>{String(p.line1)}</div>
      </Reveal>
      <Reveal at={Number(p.line2At)}>
        <div style={{...system.type.h1, color: system.accent}}>{String(p.line2)}</div>
      </Reveal>
    </div>
  </AbsoluteFill>
);

export default Scene;
