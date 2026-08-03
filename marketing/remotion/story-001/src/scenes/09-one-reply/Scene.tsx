import React from 'react';
import {AbsoluteFill} from 'remotion';
import {system} from '../../system/sceneSystem';
import {ClipPlayer} from '../../system/ClipPlayer';
import {Reveal} from '../../system/Reveal';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

// The lone-reply clip; the cliffhanger text rises over it after the VO ends.
export const Scene: React.FC<Props> = (p) => (
  <AbsoluteFill>
    <ClipPlayer src={String(p.src)} clipSeconds={Number(p.clipSeconds)} sfxVolume={Number(p.sfxVolume)} />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 48, alignItems: 'center', maxWidth: '86%', textAlign: 'center'}}>
        <Reveal at={Number(p.quoteAt)}>
          <div style={{...system.type.h2, color: system.paper, textShadow: `0 0 32px ${system.ink}, 0 4px 0 ${system.ink}`}}>
            {String(p.quote)}
          </div>
        </Reveal>
        <Reveal at={Number(p.teaseAt)}>
          <div style={{...system.type.label, color: system.accent, textShadow: `0 0 24px ${system.ink}`}}>
            {String(p.tease)}
          </div>
        </Reveal>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

export default Scene;
