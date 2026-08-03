export const schema = {
  labelText: {type: 'text', label: 'Top label', default: 'TRUE STORY - 2013'},
  labelAt: {type: 'number', label: 'Label at (s)', default: 0.15, min: 0, max: 10, step: 0.05},
  line1: {type: 'text', label: 'Line 1', default: 'IN 2013 A MAN CONFESSED TO MURDER...'},
  line1At: {type: 'number', label: 'Line 1 at (s)', default: 0.5, min: 0, max: 10, step: 0.05},
  line2: {type: 'text', label: 'Line 2', default: '...IN A MEME.'},
  line2At: {type: 'number', label: 'Line 2 at (s)', default: 3.2, min: 0, max: 10, step: 0.05},
} as const;

export const durationInFrames = 123;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
