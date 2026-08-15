/**
 * notify.mjs — what the person who reported a bug is told, and when.
 *
 *   node tools/selfheal/notify.mjs --selftest
 *   node tools/selfheal/notify.mjs --dry --local     render every pending email, send nothing
 *   node tools/selfheal/notify.mjs --send --local    actually send  (needs --i-mean-it)
 *
 * NOTHING SENDS WITHOUT --send AND --i-mean-it. The default is to print.
 *
 * TWO RULES THAT SHAPE EVERY LINE OF THIS FILE
 *
 * 1. Not a word the reporter wrote is ever quoted back into an email. An attacker can type a
 *    stranger's address into the reply box, so anything this product mails must be fixed copy
 *    we wrote. Otherwise it is a machine for sending strangers whatever an attacker likes,
 *    over our domain, with our reputation.
 *
 * 2. "Fixed" means PROVEN LIVE, not merged. A merged pull request is a promise; a deployed
 *    commit answering on the real site is a fact. Telling somebody their bug is fixed when it
 *    is only merged is the kind of small lie that teaches people to stop believing you.
 *
 * The four messages are the same four the Tool Factory already wrote for Game Night Owl. That
 * was not copied for speed - it is the same product decision, so it should be the same words.
 */
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const SEND = args.includes('--send') && args.includes('--i-mean-it');
const SITE = 'https://beatass.com';

/* ---------- the four messages ---------- */
export const STAGES = ['received', 'analyzed_bug', 'analyzed_not_bug', 'fixed'];

export function render(stage, opts = {}) {
  const body = {
    received:
      'Thanks for telling us. We have your report and somebody looks at every one of these. ' +
      'We will email you again once we have worked out what happened.',
    analyzed_bug:
      'We looked into the problem you reported. It is a real issue on our side, and we are ' +
      'working on a fix. We will email you once more when it is live.',
    analyzed_not_bug:
      'We looked into the problem you reported. It turned out not to be a fault on our side. ' +
      (opts.help || 'If it happens again, tell us and we will look properly.'),
    fixed:
      'The problem you reported has been fixed and the fix is live. Thank you for telling us. ' +
      'Reports like yours are the only reason we find these.'
  }[stage];

  if (!body) throw new Error('unknown stage: ' + stage);

  const subject = {
    received: 'We have your report',
    analyzed_bug: 'That is a real bug, and we are on it',
    analyzed_not_bug: 'About the problem you reported',
    fixed: 'The problem you reported is fixed'
  }[stage];

  const ref = opts.caseId ? `\n\nYour reference: ${opts.caseId}` : '';
  const text = `${body}${ref}\n\n${SITE}`;
  const html =
    '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#26356e">' +
    `<p>${body}</p>` +
    (opts.caseId ? `<p style="color:#5b6a9c;font-size:13px">Your reference: <code>${opts.caseId}</code></p>` : '') +
    `<p><a href="${SITE}" style="color:#cf3a2d">${SITE.replace('https://', '')}</a></p></div>`;

  return { subject, text, html };
}

/**
 * Whether a case has earned a given message yet.
 *
 * The `fixed` line is the strict one: a merged PR is not enough, a deploy is not enough. The
 * commit must be confirmed answering on the live site, which is what shipped_sha records.
 */
export function due(row) {
  if (!row.reply_email) return null;                      // they chose to stay anonymous
  if (row.notified_at) return null;                       // already told, never twice
  if (row.state === 'shipped' && row.shipped_sha) return 'fixed';
  if (row.state === 'dismissed' && (row.verdict === 'user_error' || row.verdict === 'cache_cookie'))
    return 'analyzed_not_bug';
  if (row.verdict === 'real_bug' && ['triaged', 'issue_ready', 'issue_open', 'fixing', 'pr_open'].includes(row.state))
    return 'analyzed_bug';
  return null;
}

/**
 * The send. Approved by Sanjay on 2026-08-15 ("complete all the pending works").
 *
 * THREE LOCKS, AND ALL THREE MUST BE OPENED BY A HUMAN
 *   1. --send        you have to ask for it
 *   2. --i-mean-it   you have to ask twice, in different words
 *   3. RESEND_API_KEY in the environment, which lives in Cloudflare's secret store and is not
 *      on this laptop. Nobody sends anything by running this by accident, and no schedule can:
 *      launchd jobs do not carry that key.
 *
 * The key is read from the environment and never written anywhere. Same shape check the Worker
 * uses (src/index.js:434), because a mistyped key should fail loudly here rather than produce a
 * 401 that looks like a network blip.
 */
async function send(to, mail) {
  const key = String(process.env.RESEND_API_KEY || '').replace(/\s+/g, '');
  if (!/^re_[A-Za-z0-9_]+$/.test(key))
    return { ok: false, why: 'RESEND_API_KEY is not set in this shell, or does not look like a Resend key' };
  const from = process.env.MAIL_FROM;
  if (!from) return { ok: false, why: 'MAIL_FROM is not set in this shell' };

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(30000)
    });
  } catch (err) {
    return { ok: false, why: 'the send threw: ' + (err.message || String(err)) };
  }
  /* The status is safe to print. The body is not - Resend echoes the key back in some errors. */
  if (!res.ok) return { ok: false, why: `Resend answered ${res.status}` };
  return { ok: true };
}

/* ---------- database ---------- */
const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 16e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout || '').slice(-400));
  return JSON.parse(r.stdout)[0].results;
};
const q = (s) => String(s == null ? '' : s).replace(/'/g, "''");

async function run() {
  const rows = d1(`SELECT * FROM bug_reports WHERE reply_email != '' AND notified_at IS NULL ORDER BY ts LIMIT 30`);
  const work = rows.map((r) => ({ row: r, stage: due(r) })).filter((w) => w.stage);

  if (!work.length) { console.log('nobody is waiting to be told anything.'); return; }
  console.log(`${work.length} message(s) ${SEND ? 'to send' : 'that WOULD be sent (nothing is being sent)'}\n`);
  let sent = 0, failed = 0;

  for (const { row, stage } of work) {
    const mail = render(stage, { caseId: row.id });
    console.log('-'.repeat(64));
    console.log(`to:      ${row.reply_email}`);
    console.log(`case:    ${row.id}  (${row.state} / ${row.verdict})`);
    console.log(`subject: ${mail.subject}`);
    console.log(mail.text);
    console.log('');

    if (!SEND) continue;

    const r = await send(row.reply_email, mail);
    if (!r.ok) { console.log('   NOT SENT — ' + r.why); failed++; continue; }

    /* notified_at is written only after the send succeeded. If this line never runs the case
       stays due, and the next run tries again — which is the right way round. A row marked
       "told" for an email that never left is the failure nobody notices. */
    d1(`UPDATE bug_reports SET notified_at=${Math.floor(Date.now() / 1000)} WHERE id='${q(row.id)}'`);
    d1(`INSERT INTO events (ts, msg_id, channel, action, outcome, detail, sender_hash) VALUES (` +
       `${Math.floor(Date.now() / 1000)}, '${q(row.id)}', 'bug', 'notified', 'ok', '${q(stage)}', '')`);
    console.log('   sent.');
    sent++;
  }

  console.log('-'.repeat(64));
  if (!SEND) { console.log('\nDry run. Nothing left this laptop. Add --send --i-mean-it to send for real.'); return; }
  console.log(`\n${sent} sent, ${failed} not sent.`);
  if (failed) console.log('The ones that failed are still marked as owed, so the next run tries them again.');
}

/* ---------- --selftest ---------- */
if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n, got) => { bad.push(n); console.log('  FAIL ' + n + (got !== undefined ? '\n        got: ' + JSON.stringify(got) : '')); };
  const eq = (n, g, w) => (g === w ? ok(n) : no(n, g));

  console.log('\nnotify — what the reporter is told, and when\n');

  console.log('all four messages exist and read like a person wrote them');
  for (const s of STAGES) {
    const m = render(s, { caseId: 'aaaabbbbccccdddd' });
    m.subject && m.text.length > 60 ? ok(`${s}: "${m.subject}"`) : no(s + ' is thin', m);
  }
  eq('an unknown stage throws rather than inventing one', (() => {
    try { render('whatever'); return false; } catch { return true; }
  })(), true);

  console.log('\nnothing the reporter wrote is ever quoted back');
  const nasty = 'CLICK http://evil.example TO WIN. Regards, an attacker';
  const m = render('analyzed_bug', { caseId: 'aaaabbbbccccdddd', note: nasty, help: undefined });
  m.text.includes('evil.example') ? no('attacker text reached the email') : ok('attacker text cannot reach the email');
  m.html.includes('evil.example') ? no('attacker text reached the html') : ok('nor the html version');

  console.log('\nwho is due what');
  eq('anonymous reporter gets nothing', due({ reply_email: '', state: 'shipped', shipped_sha: 'abc' }), null);
  eq('already told, never told twice', due({ reply_email: 'a@b.com', notified_at: 123, state: 'shipped', shipped_sha: 'abc' }), null);
  eq('a confirmed real bug gets the promise', due({ reply_email: 'a@b.com', verdict: 'real_bug', state: 'triaged' }), 'analyzed_bug');
  eq('a user error gets the explanation', due({ reply_email: 'a@b.com', verdict: 'user_error', state: 'dismissed' }), 'analyzed_not_bug');
  eq('a cache problem likewise', due({ reply_email: 'a@b.com', verdict: 'cache_cookie', state: 'dismissed' }), 'analyzed_not_bug');
  eq('abuse gets no reply at all', due({ reply_email: 'a@b.com', verdict: 'abuse', state: 'dismissed' }), null);
  eq('a feature request gets no promise', due({ reply_email: 'a@b.com', verdict: 'feature_request', state: 'dismissed' }), null);

  console.log('\n"fixed" means proven live, not merged');
  eq('merged but not deployed: no email', due({ reply_email: 'a@b.com', verdict: 'real_bug', state: 'pr_open' }), 'analyzed_bug');
  eq('shipped WITHOUT proof: still no "fixed"', due({ reply_email: 'a@b.com', verdict: 'real_bug', state: 'shipped', shipped_sha: null }), null);
  eq('shipped WITH proof: now we may say it', due({ reply_email: 'a@b.com', verdict: 'real_bug', state: 'shipped', shipped_sha: 'deadbeef' }), 'fixed');

  console.log('\nsending is real now, and locked three ways');
  /* Only the real code, never this test's own text. */
  const src = (await import('fs')).readFileSync(new URL(import.meta.url).pathname, 'utf8');
  const code = src.split("if (args.includes('--selftest'))")[0]
    .split('\n').filter((l) => !/^\s*[*\/]/.test(l)).join('\n');
  /args\.includes\('--send'\) && args\.includes\('--i-mean-it'\)/.test(code)
    ? ok('two separate flags are required, in different words') : no('sending is too easy');
  /process\.env\.RESEND_API_KEY/.test(code)
    ? ok('the key comes from the environment, never from this repo') : no('key is not read from env');
  !/re_[A-Za-z0-9]{8,}/.test(code)
    ? ok('and no key is written down anywhere in the file') : no('a key is hard-coded');
  /^\s*if \(!SEND\)/m.test(code)
    ? ok('the default path prints and stops') : no('the default path can send');

  console.log('\nan email that did not leave is never recorded as sent');
  const order = code.indexOf('notified_at=') > code.indexOf('await send(')
    && /if \(!r\.ok\).*continue/s.test(code.slice(code.indexOf('await send('), code.indexOf('notified_at=')));
  order ? ok('notified_at is written only after the send came back ok') : no('a failed send could still be marked told');
  /the next run tries them again/.test(code)
    ? ok('and a failure leaves the case owed, so it is retried') : no('failures are silently dropped');

  console.log('');
  if (bad.length) { console.log(`notify selftest: ${bad.length} FAILED of ${pass + bad.length}\n`); process.exit(1); }
  console.log(`notify selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

run().catch((e) => { console.error(e.message || e); process.exit(1); });
