/**
 * Proves the observability + sender-fingerprint foundation (migration 004):
 *   1. a confession carries the sender's browser/device onto its stored row,
 *   2. sending it writes a 'received' row into the events action-log,
 *   3. a sender we have blocked is refused, and the refusal is logged.
 *
 *   node test-events.mjs
 *
 * Like test-queue.mjs, this runs the REAL Worker against the REAL local database
 * over real HTTP - the fingerprint is read off the live request and the block is
 * a SQL lookup, neither of which a unit test of the surrounding JS would exercise.
 * It uses ig-handle-only sends (no email) so nothing is mailed, seeds nothing in
 * production, and cleans up the rows it makes.
 */
import { spawn, spawnSync } from 'child_process';

const PORT = 8789;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = 'events-test@localhost';
const PASSWORD = 'not-a-real-password-' + Math.random().toString(36).slice(2);
/* Fresh secret every run: the per-IP rate counter is keyed off a hash of it and
   local KV survives between runs, so a fixed secret would eventually 429 the
   first send for a reason unrelated to the code under test. */
const SECRET = 'events-test-' + Math.random().toString(36).slice(2);

const IP = '203.0.113.77';                         // a documentation-range IP, never a real one
const UA = 'SpecBrowser/9 (BeatassTestPhone)';     // distinctive, so we can prove it round-tripped

const d1 = (sql, json) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db', '--local',
    ...(json ? ['--json'] : []), '--command', sql], { encoding: 'utf8', maxBuffer: 8e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout).slice(-500));
  return json ? JSON.parse(r.stdout)[0].results : null;
};

const errs = [];
const check = (label, got, want) => {
  if (got !== want) errs.push(`${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
  console.log(`  ${got === want ? 'ok  ' : 'FAIL'} ${label}`);
};

function ensureSchema() {
  const file = (f, tolerate) => {
    const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db', '--local', '--file', f],
      { encoding: 'utf8', maxBuffer: 8e6 });
    const out = (r.stderr || '') + (r.stdout || '');
    if (r.status !== 0 && !(tolerate && /duplicate column/i.test(out)))
      throw new Error(`applying ${f} failed: ` + out.slice(-500));
  };
  file('schema.sql', false);
  file('migrations/002-sharing.sql', true);
  file('migrations/003-whatsapp.sql', true);
  file('migrations/004-observability.sql', true);
}

console.log('preparing the local database...');
ensureSchema();

console.log(`starting the worker on ${PORT}...`);
const dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT),
  '--var', `ADMIN_EMAIL:${EMAIL}`, '--var', `ADMIN_PASSWORD:${PASSWORD}`,
  '--var', `BLOCK_SECRET:${SECRET}`],
  { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let devLog = '';
dev.stdout.on('data', (b) => { devLog += b; });
dev.stderr.on('data', (b) => { devLog += b; });
dev.on('exit', (code) => { if (code && code !== 143) console.error('\nWORKER EXITED ' + code + ':\n' + devLog.slice(-1500)); });

const stop = () => {
  try { process.kill(-dev.pid, 'SIGTERM'); } catch {}
  try { dev.kill('SIGTERM'); } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

async function waitForWorker() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/admin/login', { redirect: 'manual' });
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the worker never came up on ' + BASE);
}

/** A file-change mid-run makes `wrangler dev` reload and drop the connection;
 *  retry a few times before believing a failure. */
async function req(url, opts) {
  let last;
  for (let i = 0; i < 6; i++) {
    try { return await fetch(url, opts); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 800)); }
  }
  throw last;
}

const send = (handle, message) => req(BASE + '/api/send', {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': IP, 'user-agent': UA },
  body: new URLSearchParams({ name: 'Tester', message, handle }).toString()
});

let mid = '', sh = '';
try {
  await waitForWorker();

  /* 1. a normal handle-only send: stored, fingerprinted, logged. No email, so
        nothing is mailed and the response returns the id directly. */
  const r1 = await send('spectestuser', 'a spec confession for the events test');
  const j1 = await r1.json().catch(() => ({}));
  mid = j1.id || '';
  check('a valid send returns ok with an id', r1.status === 200 && j1.ok === true && /^[a-f0-9]{16}$/.test(mid), true);

  /* Read the row + its event once. The stored sender_hash is what the Worker
     computed from IP+secret; blocking that exact value below proves the loop. */
  const row = (mid && d1(`SELECT sender_ua, sender_hash FROM messages WHERE id='${mid}'`, true)[0]) || {};
  sh = row.sender_hash || '';
  const rcv = mid ? d1(`SELECT channel FROM events WHERE msg_id='${mid}' AND action='received'`, true) : [];
  check("the sender's browser/device is stored on the message", row.sender_ua, UA);
  check('the message carries a non-empty sender hash', sh.length > 0, true);
  check('a received event was logged', rcv.length, 1);
  check('the received event is tagged with the delivery channel', rcv[0] && rcv[0].channel, 'instagram');

  /* 2. the admin dashboard shows this sender's fingerprint and a block button. */
  const login = await req(BASE + '/admin/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString()
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  const admin = await (await req(BASE + '/admin', { headers: { cookie } })).text();
  check("the admin page shows the sender's browser/device", admin.includes('SpecBrowser'), true);
  check('the admin page offers a block-sender button', admin.includes('/admin/block-sender'), true);

  /* 3. clicking block (the real admin route) then a fresh send from the same
        fingerprint is refused before anything is stored, and the refusal logged. */
  const blk = await req(BASE + '/admin/block-sender', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: new URLSearchParams({ hash: sh }).toString()
  });
  check('block-sender accepts the admin action', blk.status, 303);
  const r2 = await send('spectestuser2', 'this one should be refused');
  check('a blocked sender is refused with 403', r2.status, 403);
  const sb = sh ? d1(`SELECT action FROM events WHERE action='sender-blocked' AND sender_hash='${sh}'`, true) : [];
  check('the refusal was logged as sender-blocked', sb.length >= 1, true);
} finally {
  try { if (mid) d1(`DELETE FROM messages WHERE id='${mid}'`); } catch {}
  try { if (mid || sh) d1(`DELETE FROM events WHERE msg_id='${mid}' OR sender_hash='${sh}'`); } catch {}
  try { if (sh) d1(`DELETE FROM sender_blocklist WHERE sender_hash='${sh}'`); } catch {}
  stop();
}

if (errs.length) console.error('\nEVENTS ERRORS:\n  ' + errs.join('\n  ') + '\n');
else console.log('\nobservability foundation: all checks pass');
process.exit(errs.length ? 1 : 0);
