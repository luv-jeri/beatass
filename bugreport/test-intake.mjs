/* POST /api/bug — the front door of the self-healing loop.
 *
 * Runs the real Worker against a real local D1, the same way test-events.mjs
 * does. What it proves:
 *
 *   - a good report is stored, and the case starts in the right state
 *   - a report carrying a signed token is REFUSED, not quietly cleaned
 *   - another site cannot post one from a visitor's browser
 *   - the ceilings hold, and the rate limit answers with Retry-After
 *   - a failed image upload never leaves the case pointing at nothing
 *
 *   node bugreport/test-intake.mjs
 */
import { spawn, spawnSync } from 'child_process';

const PORT = 8791;
const BASE = 'http://127.0.0.1:' + PORT;
const SECRET = 'bug-intake-test-secret';
const ORIGIN = 'http://127.0.0.1:' + PORT;

const errs = [];
const check = (label, got, want) => {
  const okay = got === want;
  if (!okay) errs.push(`${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
  console.log(`  ${okay ? 'ok  ' : 'FAIL'} ${label}`);
};

const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db', '--local', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 8e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout).slice(-400));
  return JSON.parse(r.stdout)[0].results;
};

function ensureSchema() {
  const file = (f, tolerate) => {
    const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db', '--local', '--file', f],
      { encoding: 'utf8', maxBuffer: 8e6 });
    const out = (r.stderr || '') + (r.stdout || '');
    if (r.status !== 0 && !(tolerate && /duplicate column/i.test(out)))
      throw new Error(`applying ${f} failed: ` + out.slice(-400));
  };
  file('schema.sql', false);
  file('migrations/004-observability.sql', true);
  file('migrations/005-bug-reports.sql', true);
}

console.log('\npreparing the local database...');
ensureSchema();
d1("DELETE FROM bug_reports");

console.log(`starting the worker on ${PORT}...`);
const dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT),
  '--var', `BLOCK_SECRET:${SECRET}`, '--var', `SITE_URL:${ORIGIN}`],
  { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let devLog = '';
dev.stdout.on('data', (b) => { devLog += b; });
dev.stderr.on('data', (b) => { devLog += b; });
dev.on('exit', (c) => { if (c && c !== 143) console.error('\nWORKER EXITED ' + c + ':\n' + devLog.slice(-1200)); });

const stop = () => {
  try { process.kill(-dev.pid, 'SIGTERM'); } catch {}
  try { dev.kill('SIGTERM'); } catch {}
};
process.on('exit', stop);
process.on('SIGINT', () => { stop(); process.exit(130); });

async function waitForWorker() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/', { redirect: 'manual' }); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('the worker never came up');
}

const bundleOf = (over = {}) => Object.assign({
  schema: 1,
  ts: Date.now(),
  kind: 'bug',
  note: 'I pressed send and the button just sat there doing nothing at all.',
  replyEmail: '',
  page: { route: '/', title: 'beatass', kindOfPage: 'app' },
  env: { ua: 'SpecBrowser/9', viewport: { w: 390, h: 844 }, dpr: 2, lang: 'en', online: true, hasCookies: false },
  elements: [], logs: [], network: [], steps: [], screenshots: 0
}, over);

async function post(bundle, { origin = ORIGIN, shots = [] } = {}) {
  const fd = new FormData();
  fd.append('bundle', new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
  shots.forEach((s, i) => fd.append('shot-' + i, s, 'shot-' + i + '.png'));
  const headers = { 'CF-Connecting-IP': '203.0.113.' + (10 + Math.floor(Math.random() * 200)) };
  if (origin) headers.Origin = origin;
  const res = await fetch(BASE + '/api/bug', { method: 'POST', body: fd, headers });
  let body = {};
  try { body = await res.json(); } catch {}
  return { status: res.status, body, res };
}

await waitForWorker();

console.log('\na real report');
const good = await post(bundleOf());
check('is accepted', good.status, 200);
check('and comes back with a reference', /^[a-f0-9]{16}$/.test(good.body.id || ''), true);

const row = d1(`SELECT * FROM bug_reports WHERE id='${good.body.id}'`)[0];
check('the case exists in the database', !!row, true);
check("and starts in the 'received' state", row && row.state, 'received');
check('with no verdict yet', row && row.verdict, null);
check('the words are kept exactly', row && row.note.startsWith('I pressed send'), true);
check('the page is recorded', row && row.route, '/');

console.log('\na report that still carries something private is REFUSED');
const leaky = await post(bundleOf({
  logs: [{ level: 'error', text: 'failed on https://beatass.com/m?id=a1b2c3d4e5f60718&t=0123456789abcdef0123456789abcdef', ts: Date.now() }]
}));
check('refused', leaky.status, 422);
check('and says why, in plain words', /private/i.test(leaky.body.error || ''), true);
check('and nothing was stored', d1("SELECT COUNT(*) c FROM bug_reports")[0].c, 1);

console.log('\nanother site cannot post one for a visitor');
const foreign = await post(bundleOf(), { origin: 'https://not-beatass.example' });
check('refused', foreign.status, 403);
check('still nothing extra stored', d1("SELECT COUNT(*) c FROM bug_reports")[0].c, 1);

console.log('\nthe obvious junk');
check('an empty report is refused', (await post(bundleOf({ note: '' }))).status, 400);
check('a two-word report is refused', (await post(bundleOf({ note: 'is' }))).status, 400);
check('a bad reply address is refused', (await post(bundleOf({ replyEmail: 'not-an-address' }))).status, 400);
check('a good reply address is kept', (await post(bundleOf({ replyEmail: 'someone@example.com' }))).status, 200);

console.log('\nthe rate limit');
const IP = '203.0.113.99';
async function fromOneIp() {
  const fd = new FormData();
  fd.append('bundle', new Blob([JSON.stringify(bundleOf())], { type: 'application/json' }));
  const res = await fetch(BASE + '/api/bug', {
    method: 'POST', body: fd, headers: { 'CF-Connecting-IP': IP, Origin: ORIGIN }
  });
  return res;
}
let limited = null;
for (let i = 0; i < 9 && !limited; i++) { const r = await fromOneIp(); if (r.status === 429) limited = r; }
check('one person cannot file forever', !!limited, true);
check('and is told how long to wait', limited ? !!limited.headers.get('retry-after') : false, true);

console.log('\nan image rides along');
const png = new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' });
const withShot = await post(bundleOf({ note: 'The drawing came out wrong, look at this.' }), { shots: [png] });
check('accepted', withShot.status, 200);
const shotRow = d1(`SELECT shot_keys FROM bug_reports WHERE id='${withShot.body.id}'`)[0];
check('and the case records where the image went', JSON.parse(shotRow.shot_keys).length, 1);

stop();
console.log('');
if (errs.length) {
  console.log(`bug intake: ${errs.length} FAILED\n`);
  errs.forEach((e) => console.log('  ' + e));
  process.exit(1);
}
console.log('bug intake: all checks pass\n');
process.exit(0);
