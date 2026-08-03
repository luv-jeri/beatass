#!/usr/bin/env node
// Music generation via Gemini Lyria (lyria-3-clip-preview). Key lives in
// ~/.config/beatass/.env (never in repo). Clips come back ~28-31s.
//
//   node tools/audio/music.mjs --prompt "quiet felt piano bed..." --out vo/bed.mp3 \
//        [--register "tag1,tag2" --note "what it is for"]
//
// Prompt rules that worked (2026-08-04): describe it as a BED for narration
// ("background bed under narration, no drums, no melody spikes, quiet,
// sparse") - Lyria takes these constraints seriously. Always ffprobe the
// duration after: clips vary +/-2s and a short clip needs an end-fade in the
// Remotion mix, not silence.
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
if (!prompt || !out) {
  console.error('Usage: music.mjs --prompt "..." --out file.mp3 [--register tags --note "..."]');
  process.exit(1);
}

const env = readFileSync(join(homedir(), '.config/beatass/.env'), 'utf8');
const key = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error('GEMINI_API_KEY not found in ~/.config/beatass/.env');
  process.exit(1);
}

const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/lyria-3-clip-preview:generateContent', {
  method: 'POST',
  headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'},
  body: JSON.stringify({contents: [{parts: [{text: prompt}]}]}),
});
if (!res.ok) {
  console.error(`Lyria ${res.status}: ${(await res.text()).slice(0, 300)}`);
  process.exit(1);
}
const data = await res.json();
const blob = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
if (!blob) {
  console.error('No audio in response: ' + JSON.stringify(data).slice(0, 300));
  process.exit(1);
}
writeFileSync(out, Buffer.from(blob.data, 'base64'));
const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
console.log(`wrote ${out} (${Number(dur).toFixed(1)}s, ${blob.mimeType})`);

if (arg('register') !== null) {
  execFileSync('node', [join(import.meta.dirname, '../library.mjs'), 'add', out, '--type', 'music',
    '--tags', arg('register') || 'music', '--note', arg('note') || prompt.slice(0, 120)], {stdio: 'inherit'});
}
