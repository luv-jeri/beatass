/**
 * Proves the one thing about the sharing queue that must never break: a
 * confession can only be queued for posting if its sender ticked the share box
 * AND the safety check cleared it.
 *
 *   node test-queue.mjs
 *
 * This runs the REAL Worker against the REAL local database, over real HTTP,
 * because the protection lives in a SQL WHERE clause - `share_ok = 1 AND
 * post_state = ?`. A unit test of the JavaScript around it would pass while
 * that clause was missing, which is exactly the kind of check that lies.
 *
 * It seeds its own rows (ids beginning ffff), never touches production, and
 * uses throwaway admin credentials passed on the command line, so no password
 * is read from or written to any file.
 */
import { spawn, spawnSync } from 'child_process';
import assert from 'assert';

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = 'queue-test@localhost';
const PASSWORD = 'not-a-real-password-' + Math.random().toString(36).slice(2);
/* Fresh every run on purpose. The login has a per-IP attempt ceiling keyed off
   a hash of this secret, and the local KV survives between runs - with a fixed
   secret the tenth run gets a 429 and fails for a reason that has nothing to do
   with the code under test. */
const SECRET = 'queue-test-' + Math.random().toString(36).slice(2);

const d1 = (sql, json) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db', '--local',
    ...(json ? ['--json'] : []), '--command', sql], { encoding: 'utf8', maxBuffer: 8e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout).slice(-500));
  return json ? JSON.parse(r.stdout)[0].results : null;
};

/** Every row's state in one query. Reading the database mid-run makes
 *  `wrangler dev` notice its state files change and hot-reload, which resets
 *  the connection - so states are read once, at the end. */
const allStates = () => {
  const out = {};
  for (const r of d1("SELECT id, post_state FROM messages WHERE id LIKE 'ffff%'", true)) out[r.id] = r.post_state;
  return out;
};

/* Four rows covering every way this can be got wrong. */
const SEED = `
DELETE FROM messages WHERE id LIKE 'ffff%';
INSERT INTO messages (id,to_email,to_name,body,created_at,share_ok,score,score_reason,scored_at,post_state) VALUES
 ('ffffffff00000001','a@b.c','R','a shared confession the check cleared',1785000001,1,84,'gripping',1785000001,'ready'),
 ('ffffffff00000002','a@b.c','B','a shared confession the check refused',1785000002,1,91,'names a real person',1785000002,'blocked'),
 ('ffffffff00000003','a@b.c','P','a private confession nobody may post',1785000003,0,NULL,NULL,NULL,NULL),
 ('ffffffff00000004','a@b.c','Q','already queued',1785000004,1,70,'fine',1785000004,'queued'),
 -- Deliberately impossible: never consented, yet somehow carries a postable
 -- state. Nothing writes a row like this; it exists so the consent guard is
 -- tested ON ITS OWN. Row 3 is also protected by the from-state check, so
 -- without this row a missing share_ok clause would go unnoticed.
 ('ffffffff00000005','a@b.c','H','a never-consented row wearing a ready state',1785000005,0,95,'looks postable',1785000005,'ready');`;

const errs = [];
const check = (label, got, want) => {
  if (got !== want) errs.push(`${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
  console.log(`  ${got === want ? 'ok  ' : 'FAIL'} ${label}`);
};

/* On a fresh checkout (CI) there is no local database at all. Build it from
   the real schema, then the real migration - so this test runs against the
   same table definition production has, not a hand-written stand-in.
   The migration's ALTER TABLE lines fail once the columns exist, which is the
   normal case on a developer's machine, and is not an error here. */
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
}

console.log('preparing the local database...');
ensureSchema();
d1(SEED);

console.log(`starting the worker on ${PORT}...`);
const dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT),
  '--var', `ADMIN_EMAIL:${EMAIL}`, '--var', `ADMIN_PASSWORD:${PASSWORD}`,
  '--var', `BLOCK_SECRET:${SECRET}`],
  /* detached so the whole process group can be killed at the end. `npx` is a
     wrapper: signalling it leaves workerd and esbuild running, which keeps
     node's event loop alive forever. On CI that hung the job for fourteen
     minutes after every check had already passed. */
  { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let devLog = '';
dev.stdout.on('data', (b) => { devLog += b; });
dev.stderr.on('data', (b) => { devLog += b; });
// 143 is our own SIGTERM at the end of the run, not a crash
dev.on('exit', (code) => { if (code && code !== 143) console.error('\nWORKER EXITED ' + code + ':\n' + devLog.slice(-1500)); });

const stop = () => {
  try { process.kill(-dev.pid, 'SIGTERM'); } catch {}   // the group: workerd and esbuild too
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

/** A reload mid-run resets the connection; that is the dev server, not the
 *  Worker refusing. Retry a few times before believing a failure. */
async function req(url, opts) {
  let last;
  for (let i = 0; i < 5; i++) {
    try { return await fetch(url, opts); }
    catch (e) { last = e; await new Promise((r) => setTimeout(r, 700)); }
  }
  throw last;
}

/** POST /admin/queue exactly the way the dashboard button does. */
const move = (cookie, id, action) => req(BASE + '/admin/queue', {
  method: 'POST', redirect: 'manual',
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams({ id, action }).toString()
});

try {
  await waitForWorker();

  /* An unauthenticated press must do nothing at all. Run this BEFORE logging
     in, so a leaked session cannot make it pass by accident. */
  const anon = await move('', 'ffffffff00000001', 'queue');

  const login = await req(BASE + '/admin/login', {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD }).toString()
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(cookie.startsWith('ba_admin='), 'could not sign in to the test worker: ' + login.status);

  /* Every press first, then read the database once. Each move names the state
     it may act from, so the final state proves the whole sequence. */
  await move(cookie, 'ffffffff00000002', 'queue');    // refused: must not move
  await move(cookie, 'ffffffff00000003', 'queue');    // private: must not move
  await move(cookie, 'ffffffff00000004', 'skip');     // wrong from-state: must not move
  await move(cookie, 'ffffffff00000004', 'unqueue');  // right from-state: must move
  await move(cookie, 'ffffffff00000001', 'queue');    // cleared: must move
  await move(cookie, 'ffffffff00000001', 'delete');   // invented action: must not move
  await move(cookie, 'not-a-real-id', 'queue');       // malformed id: must not move
  await move(cookie, 'ffffffff00000005', 'queue');    // no consent, right state: must not move

  const full = await (await req(BASE + '/admin', { headers: { cookie } })).text();
  /* Only the queue section. The page below it is the moderation log, which
     shows every confession on purpose - checking the whole page passed by
     accident once and hid the fact that this was never testing the queue. */
  const a = full.indexOf('<!--queue-start-->'), b = full.indexOf('<!--queue-end-->');
  assert.ok(a > -1 && b > a, 'could not find the queue section on the admin page');
  const page = full.slice(a, b);
  const st = allStates();

  console.log('\nwithout signing in:');
  check('a stranger is bounced to the login', anon.status, 302);

  console.log('\nsigned in as admin:');
  check('a cleared confession can be queued', st.ffffffff00000001, 'queued');
  check('a REFUSED confession cannot be queued', st.ffffffff00000002, 'blocked');
  check('a PRIVATE confession cannot be queued', st.ffffffff00000003, null);
  /* 'ready' proves BOTH: skip was refused from the queued state (it would read
     'skipped'), and unqueue was allowed from it. */
  check('skip is refused from queued, unqueue is allowed', st.ffffffff00000004, 'ready');
  /* The consent guard on its own: this row's state would let it through, and
     only `share_ok = 1` stops it. */
  check('consent alone stops a row the state check would pass', st.ffffffff00000005, 'ready');

  console.log('\nwhat the page shows:');
  check('the queue shows the cleared confession', page.includes('a shared confession the check cleared'), true);
  check('the queue never shows the refused one', page.includes('a shared confession the check refused'), false);
  check('the queue never shows the private one', page.includes('a private confession nobody may post'), false);
  check('the queue never shows a never-consented row', page.includes('a never-consented row wearing a ready state'), false);
} finally {
  d1("DELETE FROM messages WHERE id LIKE 'ffff%'");
  stop();
}

if (errs.length) console.error('\nQUEUE ERRORS:\n  ' + errs.join('\n  ') + '\n');
else console.log('\nqueue guard: all checks pass');
/* Explicit, always. Anything the dev server left behind would otherwise hold
   the process open long after the answer is known. */
process.exit(errs.length ? 1 : 0);
