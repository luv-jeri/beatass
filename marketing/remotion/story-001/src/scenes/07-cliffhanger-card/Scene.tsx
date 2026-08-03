import React from 'react';
import {AbsoluteFill} from 'remotion';
import {system} from '../../system/sceneSystem';
import {Reveal} from '../../system/Reveal';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

export const Scene: React.FC<Props> = (p) => (
  <AbsoluteFill style={{backgroundColor: system.bg, justifyContent: 'center', alignItems: 'center'}}>
    <div style={{display: 'flex', flexDirection: 'column', gap: 48, alignItems: 'center', maxWidth: '88%', textAlign: 'center'}}>
      <Reveal at={Number(p.quoteAt)}>
        <div style={{...system.type.h1, color: system.paper}}>{String(p.quote)}</div>
      </Reveal>
      <Reveal at={Number(p.partAt)}>
        <div style={{...system.type.label, color: system.accent}}>{String(p.partLabel)}</div>
      </Reveal>
      <Reveal at={Number(p.teaseAt)}>
        <div style={{...system.type.h2, color: system.paper}}>{String(p.tease)}</div>
      </Reveal>
    </div>
  </AbsoluteFill>
);

export default Scene;
