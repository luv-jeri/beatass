/**
 * prepare-issue.mjs — turns a triaged real_bug into a DRAFT GitHub issue on disk.
 *
 *   node tools/selfheal/prepare-issue.mjs --selftest
 *   node tools/selfheal/prepare-issue.mjs --local
 *   node tools/selfheal/prepare-issue.mjs <case-id> --local
 *
 * This program CANNOT publish anything. It has no GitHub call in it at all. It writes markdown
 * files into content/bugs/drafts/ and stops. Publishing is approve-issue.mjs, which a human runs.
 *
 * That split is not ceremony. github.com/luv-jeri/beatass is a PUBLIC repository, so an issue is
 * a permanent, world-readable document. On a product whose whole promise is that nobody can read
 * your message, the difference between "an agent may write a draft" and "an agent may publish"
 * is the difference between a tool and an incident.
 *
 * WHAT MAY CROSS INTO A DRAFT
 *   what broke, on which page, which error, which browser, what they pressed.
 * WHAT MAY NEVER
 *   the reporter's address, any screenshot, the raw bundle, a /m link, a token, an IP hash,
 *   or anything that looks like a person's words beyond the sentence they wrote about the bug.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

/* Only behave like a program when run as one. Imported (approve-issue.mjs needs isClean), this
   file must be inert - otherwise its --selftest fires inside somebody else's --selftest and
   exits the process before their checks ever run. That happened; this is the fix. */
const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] || '').href;
const args = IS_MAIN ? process.argv.slice(2) : [];
const LOCAL = args.includes('--local');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const OUT = path.join(ROOT, 'content', 'bugs', 'drafts');

/**
 * The last line of defence before something becomes public and permanent.
 *
 * Everything here has already been scrubbed twice — once in the browser, once at the door. This
 * runs anyway, because those two ran before we knew the text was destined for a public URL.
 * Cheap, and the only one of the three that is looking at the right threat.
 */
export function sanitise(text) {
  return String(text == null ? '' : text)
    .replace(/https?:\/\/[^\s)]*[?&]t=[^\s)&]*/gi, '[link removed]')
    .replace(/\/m\?[^\s)]*/gi, '[private link removed]')
    .replace(/[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/gi, '[email removed]')
    .replace(/\+?91[\s-]?[6-9]\d{9}\b/g, '[number removed]')
    .replace(/\b[6-9]\d{9}\b/g, '[number removed]')
    .replace(/\b[a-f0-9]{32,}\b/gi, '[token removed]')
    .replace(/\b[a-f0-9]{16}\b/gi, '[id removed]')
    .replace(/@[a-z0-9._]{2,30}\b/gi, '[handle removed]');
}

/** True only if a draft is safe to publish. Used as a gate, not as advice. */
export function isClean(text) {
  const s = String(text || '');
  return !(/[?&]t=[a-f0-9]{6,}/i.test(s)
    || /\b[a-f0-9]{32,}\b/i.test(s)
    || /[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/i.test(s)
    || /\b[6-9]\d{9}\b/.test(s));
}

const TITLES = {
  send: 'Sending fails', doll: 'The doll or the drawing misbehaves',
  look: 'Layout problem', wording: 'Wording problem', bug: 'Something is broken',
  feature: 'Feature request'
};

export function draft(row, bundle) {
  const b = bundle || {};
  const env = b.env || {};
  const errs = (b.logs || []).filter((l) => l.level === 'error').slice(-6);
  const net = (b.network || []).filter((n) => n.status === 0 || n.status >= 400).slice(-6);
  const steps = (b.steps || []).slice(-8);
  const els = b.elements || [];

  const title = `${TITLES[row.kind] || 'Bug'} on ${row.route || '/'}`;

  const body = [
    '> Filed automatically from a bug report. The reporter is not identified here, on purpose.',
    '',
    '**What happened**',
    '',
    sanitise(row.note),
    '',
    '**Where**',
    '',
    `- Page: \`${row.route || '/'}\``,
    `- Kind: \`${row.kind}\``,
    env.viewport ? `- Screen: ${env.viewport.w}x${env.viewport.h}${env.dpr ? ` @${env.dpr}x` : ''}` : '',
    env.ua ? `- Browser: \`${sanitise(env.ua)}\`` : '',
    env.online === false ? '- They were offline at the time.' : '',
    env.memory ? `- Memory: ${env.memory}` : '',
    '',
    errs.length ? '**Errors the page printed**\n\n```\n' + errs.map((l) => sanitise(l.text)).join('\n') + '\n```\n' : '',
    net.length ? '**Requests that did not go well**\n\n```\n'
      + net.map((n) => `${n.method} ${n.route} -> ${n.status} (${n.ms}ms)`).join('\n') + '\n```\n' : '',
    els.length ? '**They pointed at**\n\n' + els.map((e) => `- \`${e.selector}\` — ${sanitise(e.label)}`).join('\n') + '\n' : '',
    steps.length ? '**What they pressed, in order**\n\n' + steps.map((s) => `1. ${sanitise(s.what)}`).join('\n') + '\n' : '',
    '---',
    '',
    `Triage said: **${row.verdict}** (confidence ${row.confidence}) — ${sanitise(row.verdict_why || '')}`,
    '',
    `Case: \`${row.id}\`. The full evidence stays private; it is not in this issue.`
  ].filter((x) => x !== '').join('\n');

  return { title, body, caseId: row.id };
}

/* ---------- database ---------- */
const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 16e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout || '').slice(-400));
  return JSON.parse(r.stdout)[0].results;
};
const q = (s) => String(s == null ? '' : s).replace(/'/g, "''");

function run() {
  const only = args.find((a) => /^[a-f0-9]{16}$/.test(a));
  const where = only
    ? `id='${q(only)}'`
    : `state='triaged' AND verdict='real_bug' AND issue_url IS NULL`;
  const rows = d1(`SELECT * FROM bug_reports WHERE ${where} ORDER BY ts LIMIT 20`);
  if (!rows.length) { console.log('nothing ready for an issue.'); return; }

  fs.mkdirSync(OUT, { recursive: true });
  let written = 0, refused = 0;

  for (const row of rows) {
    let bundle = {};
    try { bundle = JSON.parse(row.bundle_json); } catch { /* words are enough */ }
    const d = draft(row, bundle);
    const file = path.join(OUT, `${row.id}.md`);

    /* The gate. A draft that still carries something private is not written at all — it is
       reported, loudly, because it means a scrubber upstream is broken. */
    if (!isClean(d.title + '\n' + d.body)) {
      console.log(`REFUSED ${row.id} — the draft still carried something private. Not written.`);
      refused++;
      continue;
    }

    fs.writeFileSync(file, `# ${d.title}\n\n${d.body}\n`);
    d1(`UPDATE bug_reports SET state='issue_ready' WHERE id='${q(row.id)}' AND state='triaged'`);
    console.log(`drafted ${row.id} -> ${path.relative(ROOT, file)}`);
    written++;
  }

  console.log(`\n${written} draft(s) written${refused ? `, ${refused} refused` : ''}.`);
  if (written) {
    console.log('\nNothing has been published. Read a draft, then publish it yourself with:');
    console.log('  node tools/selfheal/approve-issue.mjs <case-id>' + (LOCAL ? ' --local' : ''));
  }
}

/* ---------- --selftest ---------- */
if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n, got) => { bad.push(n); console.log('  FAIL ' + n + (got !== undefined ? '\n        got: ' + JSON.stringify(got).slice(0, 200) : '')); };
  const eq = (n, g, w) => (g === w ? ok(n) : no(n, g));

  console.log('\nprepare-issue — what may become public, and what may not\n');

  const CASE = {
    id: 'aaaabbbbccccdddd', kind: 'send', route: '/', verdict: 'real_bug', confidence: 88,
    verdict_why: 'the page threw while encoding',
    note: 'It would not send. Reach me at reporter@example.com or 9876543210, the link was https://beatass.com/m?id=a1b2c3d4e5f60718&t=0123456789abcdef0123456789abcdef'
  };
  const BUNDLE = {
    env: { ua: 'SpecBrowser/9', viewport: { w: 390, h: 844 }, dpr: 3 },
    logs: [{ level: 'error', text: 'encode failed for priya@example.com' }],
    network: [{ method: 'POST', route: '/api/send', status: 500, ms: 900 }],
    steps: [{ what: 'Button · #go' }], elements: [{ selector: '#go', label: 'Button · send' }]
  };
  const d = draft(CASE, BUNDLE);
  const all = d.title + '\n' + d.body;

  console.log('the draft is still useful');
  eq('it has a title naming the page', /on \//.test(d.title), true);
  eq('it says what broke', /would not send/i.test(all), true);
  eq('it carries the error', /encode failed/.test(all), true);
  eq('it carries the failing request', /POST \/api\/send -> 500/.test(all), true);
  eq('it carries the browser', /SpecBrowser/.test(all), true);
  eq('it carries the triage verdict', /real_bug/.test(all), true);

  console.log('\nand nothing private survived into it');
  for (const [label, needle] of [
    ['no reporter email', 'reporter@example.com'],
    ['no third-party email', 'priya@example.com'],
    ['no phone number', '9876543210'],
    ['no view token', '0123456789abcdef0123456789abcdef'],
    ['no message id', 'a1b2c3d4e5f60718'],
    ['no /m link', '/m?id=']
  ]) all.includes(needle) ? no(label + ' — LEAKED', needle) : ok(label);

  console.log('\nthe publish gate refuses anything still dirty');
  eq('a clean body passes', isClean('POST /api/send returned 500 on /'), true);
  eq('an email is caught', isClean('mail me at a@b.com'), false);
  eq('a token is caught', isClean('t=0123456789abcdef0123456789abcdef'), false);
  eq('a phone number is caught', isClean('call 9876543210'), false);
  eq('a tokened link is caught', isClean('https://beatass.com/m?id=x&t=abcdef123456'), false);
  eq('the real draft passes its own gate', isClean(all), true);

  console.log('\nsanitise is idempotent');
  eq('running it twice changes nothing more', sanitise(sanitise(CASE.note)), sanitise(CASE.note));

  console.log('');
  if (bad.length) { console.log(`prepare-issue selftest: ${bad.length} FAILED of ${pass + bad.length}\n`); process.exit(1); }
  console.log(`prepare-issue selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

/* only when run as a program, never on import */
if (IS_MAIN) {
  try { run(); } catch (e) { console.error(e.message || e); process.exit(1); }
}
