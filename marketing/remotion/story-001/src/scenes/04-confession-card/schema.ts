// Reveal times are absolute VO word landings minus the scene start (19.8s).
export const schema = {
  topText: {type: 'text', label: 'Top line', default: "MY SISTER'S BOYFRIEND WAS VIOLENT, ON DRUGS"},
  topAt: {type: 'number', label: 'Top at (s)', default: 0.2, min: 0, max: 20, step: 0.05},
  bottomText: {type: 'text', label: 'Bottom line', default: 'SO I ENDED HIS LIFE. NOBODY EVER KNEW.'},
  bottomAt: {type: 'number', label: 'Bottom at (s)', default: 4.7, min: 0, max: 20, step: 0.05},
  ruledText: {type: 'text', label: 'Stamp', default: 'RULED AN OVERDOSE'},
  ruledAt: {type: 'number', label: 'Stamp at (s)', default: 8.9, min: 0, max: 20, step: 0.05},
  titleText: {type: 'text', label: 'Post title', default: '"finally have the guts to say it"'},
  titleAt: {type: 'number', label: 'Title at (s)', default: 11.0, min: 0, max: 20, step: 0.05},
} as const;

export const durationInFrames = 438;

// Plucked default values — the registry and Master consume these as props.
export const defaults = Object.fromEntries(
  Object.entries(schema).map(([k, v]) => [k, v.default])
) as {[K in keyof typeof schema]: (typeof schema)[K]['default']};
