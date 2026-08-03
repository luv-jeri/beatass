/**
 * Carries the confessions you approved in the dashboard down to your laptop,
 * where the Instagram poster can reach them.
 *
 *   node tools/instagram/queue-pull.mjs           pull everything you queued
 *   node tools/instagram/queue-pull.mjs --sync    mark the posted ones as posted
 *   node tools/instagram/queue-pull.mjs --dry     say what it would do, write nothing
 *   node tools/instagram/queue-pull.mjs --local   use the local dev database
 *
 * Why this exists: the website runs on Cloudflare, and Cloudflare cannot log in
 * to Instagram. So pressing Post in the dashboard does not post - it writes
 * 'queued' against the message. This tool runs on your machine, fetches those
 * messages' clips, and drops them into the content folder with a caption, which
 * is exactly what post.mjs already knows how to publish.
 *
 *   dashboard "Post this"  ->  queued  ->  queue-pull  ->  post.mjs  ->  --sync  ->  posted
 *
 * It refuses to touch anything whose sender did not tick the share box. That is
 * checked here as well as in the dashboard, on purpose: consent is worth
 * checking twice.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SITE = 'https://beatass.com';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const DRY = args.includes('--dry');
const SYNC = args.includes('--sync');

const say = (m) => console.log(m);
const die = (m) => { console.error('\n✗ ' + m + '\n'); process.exit(1); };

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) die('database query failed:\n' + (r.stderr || r.stdout || '').slice(-800));
  try { return JSON.parse(r.stdout)[0].results; }
  catch { die('could not read the database answer:\n' + (r.stdout || '').slice(-400)); }
}

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const dir = path.join(ROOT, CONFIG.contentDir);
const fileFor = (id, ext) => path.join(dir, `q-${id}.${ext}`);

/** The confession, then the standing caption, then the tags. No names appear
 *  anywhere: the recipient's name is never part of what gets posted. */
export function captionFor(body) {
  const tags = (CONFIG.hashtags || []).map((t) => '#' + t.replace(/^#/, '')).join(' ');
  const words = String(body || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return [words ? '"' + words + '"' : '', CONFIG.caption, tags].filter(Boolean).join('\n\n');
}

/* ---------- --sync: what actually went out ---------- */

if (SYNC) {
  const logFile = path.join(dir, '.posted.json');
  if (!fs.existsSync(logFile)) die('nothing has been posted from this machine yet.');
  const posted = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  const ids = Object.keys(posted)
    .map((f) => (f.match(/^q-([a-f0-9]{16})\./) || [])[1])
    .filter(Boolean);
  if (!ids.length) { say('no queued confessions have been posted yet.'); process.exit(0); }
  const now = Math.floor(Date.now() / 1000);
  if (!DRY) {
    d1(`UPDATE messages SET post_state = 'posted', posted_at = ${now} ` +
       `WHERE share_ok = 1 AND post_state = 'queued' AND id IN (${ids.map(sq).join(',')})`);
  }
  const still = d1(`SELECT COUNT(*) c FROM messages WHERE share_ok = 1 AND post_state = 'queued'`);
  say(`${ids.length} posted file(s) seen. ${DRY ? 'Nothing written.' : 'Marked as posted.'}`);
  say(`${(still[0] && still[0].c) || 0} still queued.`);
  process.exit(0);
}

/* ---------- pull ---------- */

const rows = d1(
  "SELECT id, body, has_gif, has_mp4 FROM messages " +
  "WHERE share_ok = 1 AND post_state = 'queued' ORDER BY score DESC"
);
if (!rows.length) { say('nothing queued. Press "Post this" on something at /admin first.'); process.exit(0); }

fs.mkdirSync(dir, { recursive: true });
let pulled = 0, skipped = 0;

for (const m of rows) {
  /* Instagram will not take a GIF upload, so a message without an MP4 cannot be
     posted. Say so rather than writing a file that silently never publishes. */
  if (!m.has_mp4) {
    say(`  skip ${m.id}: no MP4 for this one, Instagram will not take the GIF.`);
    skipped++;
    continue;
  }
  const dest = fileFor(m.id, 'mp4');
  if (fs.existsSync(dest)) { say(`  have ${m.id} already`); continue; }
  if (DRY) { say(`  would pull ${m.id} -> ${path.relative(ROOT, dest)}`); pulled++; continue; }

  const url = `${SITE}/media/${m.id}.mp4`;
  const res = await fetch(url);
  if (!res.ok) { say(`  skip ${m.id}: ${url} returned ${res.status}`); skipped++; continue; }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  fs.writeFileSync(fileFor(m.id, 'txt'), captionFor(m.body));
  say(`  pulled ${m.id} -> ${path.relative(ROOT, dest)}`);
  pulled++;
}

say(`\n${pulled} ready to post, ${skipped} skipped.`);
if (pulled) {
  say('\nnext, and nothing goes out until you run it:');
  say('  node tools/instagram/post.mjs --dry-run     see it without posting');
  say('  node tools/instagram/post.mjs               post one');
  say('  node tools/instagram/queue-pull.mjs --sync  tell the dashboard it went out');
}
