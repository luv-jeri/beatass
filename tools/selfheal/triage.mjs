/**
 * triage.mjs — reads bug reports and decides what each one is.
 *
 *   node tools/selfheal/triage.mjs --selftest   the rules and the state machine, no model, no db
 *   node tools/selfheal/triage.mjs --dry        read real cases, decide, print, write NOTHING
 *   node tools/selfheal/triage.mjs              decide and write the verdict back
 *   node tools/selfheal/triage.mjs --local      against the local database
 *
 * WHAT THIS PROCESS MAY DO
 *   read bug_reports, write a verdict onto a case, append to the event log.
 * WHAT IT MAY NOT DO, EVER
 *   send an email, touch GitHub, change a file in the repo, deploy, or spend money.
 *   It is deliberately the dumbest kind of process: it forms an opinion and writes it down.
 *   Everything that ACTS on that opinion is a separate program a human starts.
 *
 * THE FAILURE THAT ACTUALLY HURTS
 *   is not "the model was unsure". It is a confident `user_error` on a real bug: you tell
 *   somebody "that is not a bug", close it, and they never report anything again. So the two
 *   verdicts that produce a dismissive reply carry the highest bar, and anything the model is
 *   not sure about becomes needs_human — which costs Sanjay thirty seconds and costs the
 *   reporter nothing.
 */
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const DRY = args.includes('--dry');
const LIMIT = 25;

/* ---------- the five verdicts, and what each one is allowed to do ---------- */
export const VERDICTS = {
  real_bug:        { dismissive: false, minConfidence: 60, next: 'triaged',   reply: 'analyzed_bug' },
  user_error:      { dismissive: true,  minConfidence: 85, next: 'dismissed', reply: 'analyzed_not_bug' },
  cache_cookie:    { dismissive: true,  minConfidence: 85, next: 'dismissed', reply: 'analyzed_not_bug' },
  feature_request: { dismissive: false, minConfidence: 70, next: 'dismissed', reply: null },
  duplicate:       { dismissive: false, minConfidence: 75, next: 'dismissed', reply: null },
  abuse:           { dismissive: false, minConfidence: 80, next: 'dismissed', reply: null },
  unactionable:    { dismissive: false, minConfidence: 70, next: 'dismissed', reply: null },
  needs_human:     { dismissive: false, minConfidence: 0,  next: 'triaged',   reply: null }
};

/**
 * Everything a verdict must survive before it is allowed to stand.
 *
 * This is the fail-closed gate. It runs on the model's answer, not instead of it: the model
 * proposes, this decides whether the proposal is even admissible. Anything that does not
 * parse, names a verdict that does not exist, or is not confident enough for the verdict it
 * chose, becomes needs_human. There is no path through this function that produces a guess.
 */
export function settle(raw) {
  const fail = (why) => ({ verdict: 'needs_human', why, confidence: 0, forced: true });

  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return fail('the model did not return usable JSON'); }
  }
  if (!v || typeof v !== 'object') return fail('the model returned nothing usable');

  const name = String(v.verdict || '').trim();
  if (!Object.prototype.hasOwnProperty.call(VERDICTS, name))
    return fail(`the model invented a verdict: ${JSON.stringify(name).slice(0, 60)}`);

  const conf = Number(v.confidence);
  if (!Number.isFinite(conf) || conf < 0 || conf > 100)
    return fail('the model gave no usable confidence');

  const why = String(v.why || '').trim();
  if (why.length < 8) return fail('the model gave no readable reason');

  const rule = VERDICTS[name];
  if (conf < rule.minConfidence)
    return {
      verdict: 'needs_human', confidence: conf, forced: true,
      why: `not confident enough to say ${name} (${conf} < ${rule.minConfidence}): ${why}`
    };

  return { verdict: name, confidence: conf, why: why.slice(0, 400), forced: false,
           duplicateOf: typeof v.duplicate_of === 'string' ? v.duplicate_of : null };
}

/* ---------- what the model is shown ----------
   Note what is NOT here: the reporter's email address, the raw bundle, any screenshot. A
   verdict does not need to know who reported something, and a prompt is one more place data
   can end up in somebody else's logs. */
export function brief(row, bundle) {
  const b = bundle || {};
  const env = b.env || {};
  const logs = (b.logs || []).slice(-8).map((l) => `  [${l.level}] ${l.text}`).join('\n');
  const net = (b.network || []).slice(-8).map((n) => `  ${n.method} ${n.route} -> ${n.status} (${n.ms}ms)`).join('\n');
  const steps = (b.steps || []).slice(-10).map((s) => `  ${s.what}`).join('\n');
  const els = (b.elements || []).map((e) => `  ${e.selector} — ${e.label}`).join('\n');

  return [
    `Sort of problem the reporter chose: ${row.kind}`,
    `Page: ${row.route}`,
    `They wrote: ${row.note}`,
    env.ua ? `Browser: ${env.ua}` : '',
    env.viewport ? `Screen: ${env.viewport.w}x${env.viewport.h}` : '',
    env.online === false ? 'They were OFFLINE at the time.' : '',
    env.hasStorage ? 'They have stored site data (a reset would change something).' : '',
    els ? `They pointed at:\n${els}` : '',
    logs ? `Errors the page printed:\n${logs}` : 'The page printed no errors.',
    net ? `Requests:\n${net}` : '',
    steps ? `What they pressed:\n${steps}` : ''
  ].filter(Boolean).join('\n');
}

const SYSTEM = `You are triaging bug reports for a small anonymous-message website.

Answer with JSON only, exactly this shape:
{"verdict":"<one of the list>","confidence":<0-100>,"why":"<one plain sentence>"}

The verdicts:
- real_bug        the product genuinely misbehaved. Evidence: an error, a bad status code, or
                  described behaviour that contradicts how the product is supposed to work.
- user_error      the product did what it is supposed to do; the person expected something else.
- cache_cookie    it works normally but their browser is holding something stale.
- feature_request they are asking for behaviour that does not exist yet.
- duplicate       the same defect as an earlier report.
- abuse           spam, nonsense, or hostile content.
- unactionable    too vague to act on and there is no evidence to work from.
- needs_human     you are not sure. USE THIS FREELY. It is the correct answer whenever the
                  evidence does not clearly support one of the others.

Be strict about user_error and cache_cookie. Those two cause the person to be told "this is not
a bug", and being wrong there means a real defect gets closed and that person never reports
anything again. If there is an error in the log, it is not user_error.

Never repeat anything the person typed back into "why" beyond what is needed to explain it.`;

/**
 * The model call — the Claude Code already installed on this laptop, not a paid API.
 *
 * Sanjay's instruction, 2026-08-15: no external AI API keys in this product. So triage shells
 * out to the `claude` binary and reads its answer off stdout. No key lives anywhere, nothing is
 * billed per call, and the whole thing keeps working on a laptop with no secrets configured.
 *
 * FOUR FLAGS THAT ARE NOT DECORATION
 *   --allowed-tools ""     triage gets NO tools. It cannot read a file, run a command, or reach
 *                          the network. It reads the words we hand it and answers. That is the
 *                          capability cage from the design, enforced at the process boundary
 *                          rather than promised in a prompt.
 *   --strict-mcp-config    every MCP server is stripped. Their tool schemas alone would fill the
 *                          context before the report was even read.
 *   --settings '{"hooks":{}}'  hooks off. This laptop's hooks inject session text into prompts;
 *                          harmless in a chat, but here it is noise in a classifier's input.
 *   --model sonnet         a fail-closed classifier does not need the expensive tier.
 *
 * If the answer comes back as anything but usable JSON — hook noise, a refusal, an empty run —
 * settle() turns it into needs_human. There is no path from a confused CLI to a confident verdict.
 */
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

async function askModel(text) {
  const r = spawnSync(CLAUDE_BIN, [
    '-p', `${SYSTEM}\n\n--- the report ---\n${text}`,
    '--model', 'sonnet',
    '--allowed-tools', '',
    '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}',
    '--settings', '{"hooks":{}}'
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000, maxBuffer: 8e6 });

  if (r.error && r.error.code === 'ENOENT')
    return { skipped: `Claude Code is not installed here (looked for "${CLAUDE_BIN}")` };
  if (r.error) return { skipped: `the local Claude Code call failed: ${r.error.message}` };
  if (r.status !== 0) return { skipped: `the local Claude Code call exited ${r.status}` };

  const out = (r.stdout || '').trim();
  if (!out) return { skipped: 'the local Claude Code call returned nothing' };
  const m = out.match(/\{[\s\S]*\}/);
  return { raw: m ? m[0] : out };
}

/* ---------- the database ---------- */
const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 16e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout || '').slice(-400));
  return JSON.parse(r.stdout)[0].results;
};
const q = (s) => String(s == null ? '' : s).replace(/'/g, "''");

/**
 * Claim a case before working on it.
 *
 * The WHERE names the state it is moving FROM, so if two runs start at once only one of them
 * changes a row — the other updates nothing and moves on. This is the same trick the confession
 * queue already uses, and it is the reason this loop needs no lock file and no queue service.
 */
function claim(id) {
  d1(`UPDATE bug_reports SET state='triaging' WHERE id='${q(id)}' AND state='received'`);
  return d1(`SELECT state FROM bug_reports WHERE id='${q(id)}'`)[0]?.state === 'triaging';
}

function record(id, decided) {
  const rule = VERDICTS[decided.verdict];
  d1(
    `UPDATE bug_reports SET verdict='${q(decided.verdict)}', verdict_why='${q(decided.why)}', ` +
    `confidence=${Math.round(decided.confidence)}, triaged_at=${Math.floor(Date.now() / 1000)}, ` +
    (decided.duplicateOf ? `duplicate_of='${q(decided.duplicateOf)}', ` : '') +
    `state='${q(rule.next)}' WHERE id='${q(id)}' AND state='triaging'`
  );
  d1(
    `INSERT INTO events (ts, msg_id, channel, action, outcome, detail, sender_hash) VALUES (` +
    `${Math.floor(Date.now() / 1000)}, '${q(id)}', 'bug', 'triaged', ` +
    `'${decided.forced ? 'skip' : 'ok'}', '${q(decided.verdict + ': ' + decided.why).slice(0, 280)}', '')`
  );
}

async function run() {
  const rows = d1(
    `SELECT id, kind, note, route, bundle_json FROM bug_reports WHERE state='received' ORDER BY ts LIMIT ${LIMIT}`
  );
  if (!rows.length) { console.log('nothing waiting.'); return; }
  console.log(`${rows.length} case(s) waiting${DRY ? ' (dry run — nothing will be written)' : ''}\n`);

  for (const row of rows) {
    let bundle = {};
    try { bundle = JSON.parse(row.bundle_json); } catch { /* a broken bundle is not a reason to skip the words */ }

    const answer = await askModel(brief(row, bundle));
    const decided = answer.skipped
      ? { verdict: 'needs_human', why: answer.skipped, confidence: 0, forced: true }
      : settle(answer.raw);

    const flag = decided.forced ? ' (forced)' : '';
    console.log(`${row.id}  ${decided.verdict}${flag}  ${decided.confidence}`);
    console.log(`   ${decided.why}`);
    if (VERDICTS[decided.verdict].dismissive)
      console.log('   ^ DISMISSIVE — this one tells the reporter it is not a bug. Read it yourself.');

    if (DRY) continue;
    if (!claim(row.id)) { console.log('   (another run got there first)'); continue; }
    record(row.id, decided);
  }
  console.log('\ndone. Nothing was emailed and nothing was published.');
}

/* ---------- --selftest: the gate and the state machine, no model, no database ---------- */
if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n, got) => { bad.push(n); console.log('  FAIL ' + n + (got !== undefined ? '\n        got: ' + JSON.stringify(got) : '')); };
  const eq = (n, got, want) => (got === want ? ok(n) : no(n, got));

  console.log('\ntriage — the gate that decides whether a verdict may stand\n');

  console.log('a good answer survives');
  const good = settle('{"verdict":"real_bug","confidence":88,"why":"the page threw while encoding the gif"}');
  eq('the verdict stands', good.verdict, 'real_bug');
  eq('it is not forced', good.forced, false);
  eq('the reason is kept', good.why.startsWith('the page threw'), true);

  console.log('\nanything malformed becomes needs_human, never a guess');
  for (const [label, input] of [
    ['not JSON at all', 'I think this is probably a real bug'],
    ['empty', ''],
    ['null', null],
    ['a JSON array', '[]'],
    ['half a sentence of JSON', '{"verdict":"real_bug",']
  ]) eq(label, settle(input).verdict, 'needs_human');

  console.log('\nthe model cannot invent a verdict');
  eq('an unknown verdict is refused', settle('{"verdict":"probably_fine","confidence":99,"why":"looks ok to me"}').verdict, 'needs_human');
  eq('and the reason says so', /invented/.test(settle('{"verdict":"probably_fine","confidence":99,"why":"looks ok to me"}').why), true);

  console.log('\nconfidence has to be real, and high enough for what it claims');
  eq('missing confidence', settle('{"verdict":"real_bug","why":"something broke here"}').verdict, 'needs_human');
  eq('confidence out of range', settle('{"verdict":"real_bug","confidence":700,"why":"something broke"}').verdict, 'needs_human');
  eq('no readable reason', settle('{"verdict":"real_bug","confidence":90,"why":"x"}').verdict, 'needs_human');

  console.log('\nthe dismissive verdicts carry a higher bar than the rest');
  eq('real_bug at 70 stands', settle('{"verdict":"real_bug","confidence":70,"why":"an error was thrown on send"}').verdict, 'real_bug');
  eq('user_error at 70 does NOT', settle('{"verdict":"user_error","confidence":70,"why":"they expected a different thing"}').verdict, 'needs_human');
  eq('cache_cookie at 70 does NOT', settle('{"verdict":"cache_cookie","confidence":70,"why":"their browser is holding old files"}').verdict, 'needs_human');
  eq('user_error at 90 does stand', settle('{"verdict":"user_error","confidence":90,"why":"the product behaved exactly as designed"}').verdict, 'user_error');
  const low = settle('{"verdict":"user_error","confidence":70,"why":"they expected a different thing"}');
  eq('and a downgrade explains itself', /not confident enough/.test(low.why), true);

  console.log('\nwhere each verdict sends the case');
  eq('real_bug stays open for work', VERDICTS.real_bug.next, 'triaged');
  eq('user_error closes it', VERDICTS.user_error.next, 'dismissed');
  eq('feature_request closes it (never auto-built)', VERDICTS.feature_request.next, 'dismissed');
  eq('needs_human parks it, not closes it', VERDICTS.needs_human.next, 'triaged');
  eq('abuse gets no reply', VERDICTS.abuse.reply, null);
  eq('feature_request gets no promise', VERDICTS.feature_request.reply, null);
  eq('only real_bug promises a fix', VERDICTS.real_bug.reply, 'analyzed_bug');

  console.log('\nthe brief never carries the reporter back to the model');
  const text = brief(
    { kind: 'send', note: 'It would not send', route: '/' },
    { env: { ua: 'X' }, logs: [{ level: 'error', text: 'boom' }], network: [], steps: [], elements: [] }
  );
  eq('the words are in it', /would not send/.test(text), true);
  eq('the error is in it', /boom/.test(text), true);
  eq('no reply address is in it', /@/.test(text), false);

  console.log('\nthe thinking runs on this laptop, and it holds no powers');
  /* Only the REAL code, never this test's own text. A check that can match the words inside
     itself passes whatever the program does — it is decoration, not a check. So: cut the file
     at the selftest marker, drop comments, and search only what actually runs. */
  const me = (await import('fs')).readFileSync(new URL(import.meta.url).pathname, 'utf8');
  const live = me.split("if (args.includes('--selftest'))")[0]
    .split('\n').filter((l) => !/^\s*[*\/]/.test(l)).join('\n');
  eq('no paid API is called', /api\.anthropic\.com/.test(live), false);
  eq('and no API key is read from the environment', /ANTHROPIC_API_KEY/.test(live), false);
  eq('it shells out to the installed Claude Code', /spawnSync\(CLAUDE_BIN/.test(live), true);
  eq('the model it asks for is sonnet, not the expensive tier', /'--model', 'sonnet'/.test(live), true);
  eq('it is given NO tools, so it cannot read, run or fetch anything',
    /'--allowed-tools', ''/.test(live), true);
  eq('every MCP server is stripped', /--strict-mcp-config/.test(live), true);
  eq('and this laptop\'s hooks cannot inject text into the classifier',
    /'--settings', '\{"hooks":\{\}\}'/.test(live), true);
  eq('a missing binary becomes a skip, never a guess', /ENOENT/.test(live), true);

  console.log('');
  if (bad.length) { console.log(`triage selftest: ${bad.length} FAILED of ${pass + bad.length}\n`); process.exit(1); }
  console.log(`triage selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

if (args.includes('--help') || (!args.length && process.stdin.isTTY === undefined)) {
  console.log('usage: node tools/selfheal/triage.mjs [--selftest|--dry] [--local]');
  process.exit(1);
}

run().catch((e) => { console.error(e.message || e); process.exit(1); });
