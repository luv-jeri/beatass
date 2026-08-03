// Text-to-speech via ElevenLabs. Key lives in ~/.config/beatass/.env (never in repo).
//
//   node tools/voice/tts.mjs --text vo/script.txt --out vo/track.mp3 \
//        --voice JBFqnCBsd6RMkjVDRZzb [--model eleven_v3] [--align vo/track-alignment.json]
//
// --align uses the with-timestamps endpoint and also writes character-level
// timing JSON (Remotion caption sync reads it).
// ponytail: single API call per run; ElevenLabs glitches on very long pastes,
// so split scripts over ~2500 chars into parts yourself and run per part.

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const envFile = readFileSync(join(homedir(), '.config/beatass/.env'), 'utf8');
const key = envFile.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key || key === 'paste-your-key-here') {
  console.error('No API key in ~/.config/beatass/.env');
  process.exit(1);
}

const textFile = arg('text');
const out = arg('out');
const voice = arg('voice');
const model = arg('model', 'eleven_multilingual_v2');
const align = arg('align');
if (!textFile || !out || !voice) {
  console.error('Usage: tts.mjs --text <file> --out <mp3> --voice <id> [--model <id>] [--align <json>]');
  process.exit(1);
}

const text = readFileSync(textFile, 'utf8').trim();
const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}` + (align ? '/with-timestamps' : '');
const res = await fetch(url, {
  method: 'POST',
  headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, model_id: model }),
});
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}

if (align) {
  const data = await res.json();
  writeFileSync(out, Buffer.from(data.audio_base64, 'base64'));
  writeFileSync(align, JSON.stringify(data.alignment ?? data.normalized_alignment, null, 1));
  console.log(`wrote ${out} + ${align} (${text.length} chars, model ${model})`);
} else {
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote ${out} (${text.length} chars, model ${model})`);
}
