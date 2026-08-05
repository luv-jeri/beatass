// Prop schema — Studio controls + MotionKit export (see preset-export.md).
export const schema = {
  src: {type: 'text', label: 'Clip file (public/)', default: 'clips/current/scene-6.mp4'},
  startFromSeconds: {type: 'number', label: 'Clip start offset (s)', default: 3.0, min: 0, max: 8, step: 0.1},
  clipSeconds: {type: 'number', label: 'Source clip length (s)', default: 5.0, min: 1, max: 30, step: 0.5},
  sfxVolume: {type: 'number', label: 'Clip SFX volume', default: 0.22, min: 0, max: 1, step: 0.05},
} as const;

export const durationInFrames = 36;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
