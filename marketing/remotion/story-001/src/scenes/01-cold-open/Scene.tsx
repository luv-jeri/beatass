import React from 'react';
import {AbsoluteFill} from 'remotion';
import {system} from '../../system/sceneSystem';
import {ClipPlayer} from '../../system/ClipPlayer';
import {Reveal} from '../../system/Reveal';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

// Clip with the TRUE STORY label pinned in the empty top third. The hook
// words themselves arrive via the word-synced captions, not a card.
export const Scene: React.FC<Props> = (p) => (
  <AbsoluteFill>
    <ClipPlayer src={String(p.src)} clipSeconds={Number(p.clipSeconds)} sfxVolume={Number(p.sfxVolume)} startFromSeconds={Number(p.startFromSeconds)} />
    <AbsoluteFill style={{alignItems: 'center', pointerEvents: 'none'}}>
      <Reveal at={Number(p.labelAt)}>
        <div style={{...system.type.label, color: system.accent, marginTop: 340, textShadow: `0 0 24px ${system.ink}`}}>
          {String(p.labelText)}
        </div>
      </Reveal>
    </AbsoluteFill>
  </AbsoluteFill>
);

export default Scene;
