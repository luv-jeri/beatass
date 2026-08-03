#!/usr/bin/env node
// Sound-effect generation via ElevenLabs /v1/sound-generation. Key lives in
// ~/.config/beatass/.env (never in repo).
//
//   node tools/audio/sfx.mjs --prompt "soft gentle paper whoosh, muted, subtle" \
//        --seconds 1.5 --out sfx/whoosh.mp3 [--register "tag1,tag2" --note "..."]
//
// Audio law (Sanjay 2026-08-04): SFX are side characters. Write "soft",
// "muted", "subtle", "distant" INTO the prompt - a loud sample mixed quiet
// still sounds harsh. Reels use at most 3 accents at ~0.3 volume.
import {readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
};
const prompt = arg('prompt');
const out = arg('out');
const seconds = Number(arg('seconds') || 2);
if (!prompt || !out) {
  console.error('Usage: sfx.mjs --prompt "..." --seconds 2 --out file.mp3 [--register tags --note "..."]');
  process.exit(1);
}

const env = readFileSync(join(homedir(), '.config/beatass/.env'), 'utf8');
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error('ELEVENLABS_API_KEY not found in ~/.config/beatass/.env');
  process.exit(1);
}

const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
  method: 'POST',
  headers: {'xi-api-key': key, 'Content-Type': 'application/json'},
  body: JSON.stringify({text: prompt, duration_seconds: seconds}),
});
if (!res.ok) {
  console.error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log(`wrote ${out} (${seconds}s requested)`);

if (arg('register') !== null) {
  execFileSync('node', [join(import.meta.dirname, '../library.mjs'), 'add', out, '--type', 'sfx',
    '--tags', arg('register') || 'sfx', '--note', arg('note') || prompt.slice(0, 120)], {stdio: 'inherit'});
}
