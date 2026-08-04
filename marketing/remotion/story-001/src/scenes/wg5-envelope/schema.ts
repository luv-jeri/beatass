// Prop schema — Studio controls + MotionKit export (see preset-export.md).
export const schema = {
  src: {type: 'text', label: 'Clip file (public/)', default: 'clips/current/scene-5.mp4'},
  clipSeconds: {type: 'number', label: 'Source clip length (s)', default: 8, min: 1, max: 30, step: 0.5},
  sfxVolume: {type: 'number', label: 'Clip SFX volume', default: 0.22, min: 0, max: 1, step: 0.05},
  cropBottom: {type: 'number', label: 'Crop bottom fraction', default: 0, min: 0, max: 0.4, step: 0.02},
  startFromSeconds: {type: 'number', label: 'Start offset in clip (s)', default: 0, min: 0, max: 8, step: 0.1},
} as const;

export const durationInFrames = 78;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
