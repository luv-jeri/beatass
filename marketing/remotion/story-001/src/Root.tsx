import React from 'react';
import {Composition} from 'remotion';
import {Master} from './Master';
import {scenes} from './scenes';
import {timeline} from './timeline';

const FPS = 30, W = 1080, H = 1920;
const total = timeline.length ? Math.max(...timeline.map((t) => t.from + t.duration)) : 300;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Master" component={Master} durationInFrames={total} fps={FPS} width={W} height={H} />
    {Object.entries(scenes).map(([id, s]) => (
      <Composition key={id} id={id.replace(/[^a-zA-Z0-9-]/g, '-')} component={s.component}
        defaultProps={s.defaults as Record<string, unknown>}
        durationInFrames={s.durationInFrames} fps={FPS} width={W} height={H} />
    ))}
  </>
);
