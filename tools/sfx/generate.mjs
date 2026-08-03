/**
 * Makes the doll's sound effects with ElevenLabs, once, into files we keep.
 *
 *   node tools/sfx/generate.mjs            make anything that is missing
 *   node tools/sfx/generate.mjs --only pin remake one
 *   node tools/sfx/generate.mjs --force    remake everything
 *   node tools/sfx/generate.mjs --check    just grade what is already there
 *
 * The files land in design/assets/sfx/ and are committed, because they are
 * assets like the doll art is: made once, reviewed by ear, then shipped. This
 * script is not part of the build and never runs on a visitor's machine - it
 * costs money to run and the site must not depend on an outside service being
 * up. build.py copies the files into public/sfx/.
 *
 * Existing files are never overwritten without --force, so re-running this by
 * habit cannot quietly spend credits or replace a sound Sanjay already liked.
 *
 * The key lives at ~/.config/beatass/.env, outside the repo, and is the same
 * one the reel narration uses (secrets law: never in any repo).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const OUT = path.join(ROOT, 'design', 'assets', 'sfx');
const API = 'https://api.elevenlabs.io/v1/sound-generation';

/* Every prompt is a physical description, not a mood. "satisfying" gets you
   a stock whoosh; "a needle pushed through thick felt" gets you a needle.
   `no music` is in all of them because the model adds a score otherwise. */
const SOUNDS = {
  'punch': {
    text: 'one fist hitting a soft cloth doll stuffed with cotton, a single dull muffled thud with a low body underneath, close microphone, dry room, no music, no voices',
    seconds: 0.9, influence: 0.75, peak: -3
  },
  'punch-hard': {
    text: 'a heavy punch landing on a stuffed cloth doll, deep muffled impact, low thump, cotton compressing, close and dry, no music, no voices',
    seconds: 1.1, influence: 0.75, peak: -2
  },
  'pin': {
    text: 'a sharp sewing needle pushed slowly through thick felt fabric, a short crisp puncture then the shaft sliding through the cloth, extremely close microphone, dry, no music, no voices',
    seconds: 0.8, influence: 0.8, peak: -4
  },
  'fire': {
    text: 'dry cloth catching fire, a sudden soft whoosh as the flame takes hold, close, dry, no music, no voices',
    seconds: 1.4, influence: 0.7, peak: -4
  },
  /* the one that has to loop: it plays for as long as the doll burns */
  'fire-loop': {
    text: 'a small steady fire burning cloth, continuous crackling and popping embers, close microphone, even and unchanging, no music, no voices',
    seconds: 6, influence: 0.5, loop: true, peak: -6
  },
  'love': {
    text: 'a warm gentle sparkle of tiny soft bells, comforting and short, close, no voices',
    seconds: 1.4, influence: 0.55, peak: -6
  },
  'reset': {
    text: 'a cloth doll being shaken out and settling, one quick soft fabric rustle, close, dry, no music, no voices',
    seconds: 0.8, influence: 0.7, peak: -8
  }
};

function key() {
  const f = path.join(os.homedir(), '.config', 'beatass', '.env');
  const m = (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '').match(/^ELEVENLABS_API_KEY\s*=\s*(.+)$/m);
  const k = (m && m[1].trim()) || process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error(`no ELEVENLABS_API_KEY. Put it in ${f} (never in this repo).`);
  return k;
}

/** Is this file actually a sound, or did we just save a dud? */
function grade(file, want) {
  const out = { file: path.basename(file), kb: Math.round(fs.statSync(file).size / 1024) };
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (probe.status !== 0) { out.note = 'ffprobe not available, length not checked'; return out; }
  out.seconds = Math.round(parseFloat(probe.stdout) * 100) / 100;
  const vol = spawnSync('ffmpeg', ['-v', 'info', '-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const max = (vol.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
  const mean = (vol.stderr || '').match(/mean_volume:\s*(-?[\d.]+) dB/);
  if (max) out.peakDb = parseFloat(max[1]);
  if (mean) out.meanDb = parseFloat(mean[1]);
  /* the two ways a generated effect comes back useless */
  out.problems = [];
  if (out.peakDb !== undefined && out.peakDb < -35) out.problems.push('almost silent');
  if (out.meanDb !== undefined && out.meanDb > -6) out.problems.push('clipped or wall-of-noise');
  if (want && out.seconds && Math.abs(out.seconds - want) > 0.6) out.problems.push(`length ${out.seconds}s, asked for ${want}s`);
  return out;
}

async function make(name, spec, k) {
  const body = { text: spec.text, duration_seconds: spec.seconds, prompt_influence: spec.influence };
  if (spec.loop) body.loop = true;
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'xi-api-key': k, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`${name}: ElevenLabs said ${r.status} ${(await r.text()).slice(0, 200)}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) throw new Error(`${name}: came back ${buf.length} bytes, which is not a sound`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name + '.mp3'), buf);
  return grade(path.join(OUT, name + '.mp3'), spec.seconds);
}

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');
const checkOnly = args.includes('--check');

const names = only ? [only] : Object.keys(SOUNDS);
if (only && !SOUNDS[only]) { console.error(`no sound called "${only}". Try: ${Object.keys(SOUNDS).join(', ')}`); process.exit(1); }

if (checkOnly) {
  console.log('\nwhat is on disk:\n');
  for (const n of names) {
    const f = path.join(OUT, n + '.mp3');
    if (!fs.existsSync(f)) { console.log(`  MISSING  ${n}.mp3`); continue; }
    const g = grade(f, SOUNDS[n].seconds);
    console.log(`  ${(g.problems || []).length ? 'CHECK ' : 'ok    '} ${n.padEnd(12)} ${String(g.seconds).padStart(5)}s  ${String(g.kb).padStart(4)}KB  peak ${g.peakDb}dB  ${(g.problems || []).join(', ')}`);
  }
  console.log('\nthese are made once and judged by ear. Regenerate one with --only <name> --force\n');
  process.exit(0);
}

const k = key();
let made = 0, skipped = 0;
console.log('');
for (const n of names) {
  const f = path.join(OUT, n + '.mp3');
  if (fs.existsSync(f) && !force) { console.log(`  kept     ${n}.mp3 (already there, --force to remake)`); skipped++; continue; }
  try {
    const g = await make(n, SOUNDS[n], k);
    made++;
    console.log(`  made     ${n.padEnd(12)} ${String(g.seconds || '?').padStart(5)}s  ${String(g.kb).padStart(4)}KB  peak ${g.peakDb}dB  ${(g.problems || []).join(', ')}`);
  } catch (e) {
    console.error(`  FAILED   ${n}: ${e.message}`);
    process.exitCode = 1;
  }
  await new Promise((r) => setTimeout(r, 1200));
}
console.log(`\n${made} made, ${skipped} kept, in design/assets/sfx/`);
console.log('Listen to them before shipping. A file that grades fine can still sound wrong.\n');
