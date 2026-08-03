import React from 'react';
import {ClipPlayer} from '../../system/ClipPlayer';
import {schema} from './schema';

type Props = {[K in keyof typeof schema]: (typeof schema)[K]['default']};

export const Scene: React.FC<Props> = (p) => (
  <ClipPlayer src={String(p.src)} clipSeconds={Number(p.clipSeconds)} sfxVolume={Number(p.sfxVolume)} />
);

export default Scene;
