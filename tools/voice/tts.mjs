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

// Optional delivery knobs (ElevenLabs voice_settings). Left out = model default.
// stability: LOW = more emotional swing, HIGH = flat/consistent (0-1)
// style: style exaggeration (0-1) · speed: 0.7-1.2 · similarity: 0-1
const voiceSettings = {};
for (const [flag, apiKey] of [
  ['stability', 'stability'],
  ['similarity', 'similarity_boost'],
  ['style', 'style'],
  ['speed', 'speed'],
]) {
  const v = arg(flag);
  if (v !== null) voiceSettings[apiKey] = parseFloat(v);
}
const settings = Object.keys(voiceSettings).length ? voiceSettings : undefined;
if (!textFile || !out || !voice) {
  console.error('Usage: tts.mjs --text <file> --out <mp3> --voice <id> [--model <id>] [--align <json>]');
  process.exit(1);
}

const text = readFileSync(textFile, 'utf8').trim();

// --stitch: generate sentence-by-sentence with continuity context. Each chunk
// is told the text before it (previous_text), after it (next_text), and the
// request ids of earlier chunks (request stitching), so prosody flows across
// joins. NOT supported by eleven_v3 (API limitation) — use multilingual_v2.
if (process.argv.includes('--stitch')) {
  if (model.startsWith('eleven_v3')) {
    console.error('--stitch is not supported by eleven_v3; use --model eleven_multilingual_v2');
    process.exit(1);
  }
  const { execSync } = await import('node:child_process');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const chunks = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  const dir = mkdtempSync(join(tmpdir(), 'tts-stitch-'));
  const requestIds = [];
  const merged = { characters: [], character_start_times_seconds: [], character_end_times_seconds: [] };
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunks[i],
        model_id: model,
        voice_settings: settings,
        previous_text: chunks.slice(0, i).join(' ') || undefined,
        next_text: chunks.slice(i + 1).join(' ') || undefined,
        previous_request_ids: requestIds.slice(-3),
      }),
    });
    if (!res.ok) {
      console.error(`ElevenLabs ${res.status} on chunk ${i + 1}: ${(await res.text()).slice(0, 300)}`);
      process.exit(1);
    }
    const rid = res.headers.get('request-id');
    if (rid) requestIds.push(rid);
    const data = await res.json();
    const part = join(dir, `chunk-${String(i).padStart(2, '0')}.mp3`);
    writeFileSync(part, Buffer.from(data.audio_base64, 'base64'));
    const a = data.alignment ?? data.normalized_alignment;
    merged.characters.push(...a.characters);
    merged.character_start_times_seconds.push(...a.character_start_times_seconds.map((t) => t + offset));
    merged.character_end_times_seconds.push(...a.character_end_times_seconds.map((t) => t + offset));
    // offset advances by the chunk's REAL audio length (ffprobe), not the
    // last character time — chunks can carry trailing silence.
    offset += parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${part}"`).toString());
    // inter-chunk spacer character pinned to the join instant
    merged.characters.push(' ');
    merged.character_start_times_seconds.push(offset);
    merged.character_end_times_seconds.push(offset);
    console.log(`  chunk ${i + 1}/${chunks.length}: "${chunks[i].slice(0, 40)}..." ok`);
  }
  writeFileSync(join(dir, 'list.txt'), chunks.map((_, i) => `file 'chunk-${String(i).padStart(2, '0')}.mp3'`).join('\n'));
  // re-encode (not -c copy): per-chunk mp3 timestamps jitter at joins and
  // some decoders hiccup on the seams
  execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${join(dir, 'list.txt')}" -c:a libmp3lame -b:a 192k "${out}"`);
  if (align) writeFileSync(align, JSON.stringify(merged, null, 1));
  console.log(`wrote ${out}${align ? ' + ' + align : ''} (${chunks.length} stitched chunks, model ${model})`);
  process.exit(0);
}

const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}` + (align ? '/with-timestamps' : '');
const res = await fetch(url, {
  method: 'POST',
  headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ text, model_id: model, voice_settings: settings }),
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
