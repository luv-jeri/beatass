export const schema = {
  quote: {type: 'text', label: 'Quote', default: '"THERE IS SOME TRUTH BEHIND IT."'},
  quoteAt: {type: 'number', label: 'Quote at (s)', default: 0.15, min: 0, max: 10, step: 0.05},
  partLabel: {type: 'text', label: 'Part label', default: 'PART 2'},
  partAt: {type: 'number', label: 'Part at (s)', default: 1.1, min: 0, max: 10, step: 0.05},
  tease: {type: 'text', label: 'Tease', default: 'THE INTERNET HUNTS HIM DOWN'},
  teaseAt: {type: 'number', label: 'Tease at (s)', default: 1.35, min: 0, max: 10, step: 0.05},
} as const;

export const durationInFrames = 90;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
