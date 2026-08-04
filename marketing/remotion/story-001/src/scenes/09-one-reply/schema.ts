// Prop schema — Studio controls + MotionKit export (see preset-export.md).
export const schema = {
  src: {type: 'text', label: 'Clip file (public/)', default: 'clips/current/scene-9.mp4'},
  clipSeconds: {type: 'number', label: 'Source clip length (s)', default: 8, min: 1, max: 30, step: 0.5},
  sfxVolume: {type: 'number', label: 'Clip SFX volume', default: 0.22, min: 0, max: 1, step: 0.05},
  quote: {type: 'text', label: 'Cliffhanger quote', default: 'अगर विलेन ही सच बोल रहा हो?'},
  quoteAt: {type: 'number', label: 'Quote reveal (s, scene-local)', default: 6.1, min: 0, max: 10, step: 0.1},
  tease: {type: 'text', label: 'Part 2 tease', default: 'confess anonymously - beatass.com'},
  teaseAt: {type: 'number', label: 'Tease reveal (s, scene-local)', default: 7.4, min: 0, max: 10, step: 0.1},
} as const;

export const durationInFrames = 315;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
