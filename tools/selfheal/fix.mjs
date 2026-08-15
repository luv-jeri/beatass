/**
 * fix.mjs — the caged fixer, and the gate a fix must pass before a PR may exist.
 *
 *   node tools/selfheal/fix.mjs --selftest
 *   node tools/selfheal/fix.mjs <case-id> --start      make an isolated worktree, print the brief
 *   node tools/selfheal/fix.mjs <case-id> --attempt    local Claude Code writes the check + the fix
 *   node tools/selfheal/fix.mjs <case-id> --prove      run the gate: red before, green after
 *   node tools/selfheal/fix.mjs <case-id> --pr         render a DRAFT pr body (does not open it)
 *
 * THE ONE RULE
 *   No pre-fix failure evidence, no PR.
 *
 * An agent that writes patches from bug reports on confidence is a machine for producing
 * plausible-looking wrong code at scale. So this program will not let a change become a pull
 * request until it has watched a check FAIL on the unfixed tree and then PASS on the fixed one.
 * "It looks right" is not evidence. "I could not reproduce it but I fixed it anyway" is worse.
 *
 * Three shapes of evidence count, because insisting on interactive reproduction would rule out
 * real bugs that cannot be clicked back into existence (a device-specific crash, a transient
 * worker exception, a race):
 *   1. a test that fails on the unfixed tree
 *   2. a deterministic fixture built from the captured error signature
 *   3. a demonstrated failing code path
 * All three then require the same check to pass afterwards AND the whole suite to stay green.
 *
 * THE CAGE IS CAPABILITY, NOT PATHS
 *   A path allowlist would be theatre here: src/index.js alone holds sending, inbound mail,
 *   admin auth, private message views and blocking. Allow that file and you have allowed
 *   everything; forbid it and almost no real bug is fixable. So instead this program simply
 *   never merges, never pushes, never deploys, never mails, and never reads a production secret.
 *   The worst a bad run can produce is a bad draft in a throwaway directory.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const args = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const WORKTREES = path.join(ROOT, '..', '.beatass-fixes');

/** Things this program must never do. Asserted by its own selftest. */
export const FORBIDDEN = [
  'git push', 'git merge', 'gh pr merge', 'wrangler deploy',
  'resend', 'api.resend.com', 'gh issue create'
];

const sh = (cmd, cwd, allowFail) => {
  const r = spawnSync('bash', ['-lc', cmd], { encoding: 'utf8', cwd: cwd || ROOT, maxBuffer: 16e6 });
  if (r.status !== 0 && !allowFail)
    throw new Error(`command failed: ${cmd}\n${(r.stderr || r.stdout || '').slice(-500)}`);
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};

/**
 * The gate itself, as a pure function so it can be tested without git, without a model, and
 * without waiting for a real suite to run.
 *
 * `before` and `after` are the exit codes of the SAME check, run on the unfixed and fixed
 * trees. `suite` is the exit code of the full test run afterwards.
 */
export function judge({ before, after, suite }) {
  if (before === 0)
    return { pass: false, why: 'the check passed BEFORE the fix, so it does not describe the bug. No PR.' };
  if (after !== 0)
    return { pass: false, why: 'the check still fails after the fix. No PR.' };
  if (suite !== 0)
    return { pass: false, why: 'the fix works but broke something else in the suite. No PR.' };
  return { pass: true, why: 'red before, green after, and the whole suite is green.' };
}

function worktreeFor(id) { return path.join(WORKTREES, id); }

function start(id) {
  fs.mkdirSync(WORKTREES, { recursive: true });
  const dir = worktreeFor(id);
  if (fs.existsSync(dir)) { console.log('worktree already exists: ' + dir); return dir; }
  const branch = `fix/bug-${id}`;
  sh(`git worktree add -b ${branch} ${JSON.stringify(dir)} HEAD`);
  console.log(`isolated worktree ready:\n  ${dir}\n  branch ${branch}`);
  console.log('\nIt has no production secrets, and this program cannot push, merge or deploy from it.');
  return dir;
}

/**
 * --attempt: let the Claude Code on this laptop write the failing check and the fix.
 *
 * TWO THINGS KEEP THIS HONEST, AND NEITHER IS A PROMPT
 *
 * 1. IT IS GIVEN NO WAY TO RUN ANYTHING. The tools handed over are Read, Write, Edit, Glob
 *    and Grep — there is no Bash, so there is no `git push`, no `wrangler deploy`, no shell at
 *    all. It writes files inside a throwaway worktree and stops. Judging whether those files
 *    are any good is done afterwards, by prove(), which is this program and not the model.
 *    An agent that could both write the fix and run the test that blesses it is an agent that
 *    can talk itself into shipping.
 *
 * 2. IT IS BRIEFED FROM THE SANITISED DRAFT, never from the case file. content/bugs/drafts/
 *    is the public-safe version — the reporter's address, their screenshots and the raw
 *    capture bundle are not in it. So the coding agent never sees them either. That falls out
 *    of the design for free, and it is worth keeping on purpose.
 *
 * If a previous gate run failed, its reason is handed back in the brief, so a second attempt
 * is told what went wrong rather than guessing at it again.
 */
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

function attempt(id) {
  const dir = worktreeFor(id);
  if (!fs.existsSync(dir)) throw new Error('no worktree for ' + id + '. Run --start first.');

  const draftFile = path.join(ROOT, 'content', 'bugs', 'drafts', id + '.md');
  if (!fs.existsSync(draftFile))
    throw new Error('no sanitised draft for ' + id + '. Run prepare-issue.mjs first — the fixer\n' +
                    'works from the public-safe description on purpose, not from the raw case.');

  const lastFail = path.join(dir, '.gate-failed.txt');
  const previously = fs.existsSync(lastFail)
    ? `\nA previous attempt was REJECTED by the gate for this reason. Do not repeat it:\n${fs.readFileSync(lastFail, 'utf8')}\n`
    : '';

  const prompt = [
    'You are fixing one defect in this repository. Work only inside this working directory.',
    '',
    'Read README.md and CLAUDE.md first — this codebase has house rules that matter here.',
    'Two of them will catch you out: edit template.html and never beatass.html (which is',
    'generated), and there is no framework or bundler, just plain HTML, CSS and JavaScript.',
    '',
    'Do exactly two things, in this order:',
    '',
    `1. Write a check at bugreport/check-${id}.mjs that FAILS on the code as it stands right now.`,
    '   It must exit non-zero while the bug is present and exit zero once it is fixed. Plain node,',
    '   no test framework. This is the evidence the defect was real; without it there is no fix.',
    '',
    '2. Fix the defect, in the smallest change that actually addresses the cause rather than',
    '   the symptom. If several callers share the broken code, fix the shared place.',
    '',
    'You cannot run anything — you have no shell. Do not try to run the check; it will be run',
    'for you afterwards, and it will be run against the unfixed tree first to confirm it really',
    'does go red. If you cannot see how to reproduce the defect as a check, say so plainly and',
    'write no fix. Guessing at a fix that cannot be proven is worse than leaving the bug open.',
    previously,
    '--- the defect ---',
    fs.readFileSync(draftFile, 'utf8')
  ].join('\n');

  console.log('handing the case to the Claude Code on this laptop...');
  console.log(`  working directory: ${dir}`);
  console.log('  tools: Read, Write, Edit, Glob, Grep — no shell, so it cannot run, push or deploy.\n');

  const r = spawnSync(CLAUDE_BIN, [
    '-p', prompt,
    '--model', 'sonnet',
    '--allowed-tools', 'Read Write Edit Glob Grep',
    '--permission-mode', 'acceptEdits',
    '--strict-mcp-config',
    '--mcp-config', '{"mcpServers":{}}',
    '--settings', '{"hooks":{}}'
  ], { encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], timeout: 900000, maxBuffer: 32e6 });

  if (r.error && r.error.code === 'ENOENT')
    throw new Error(`Claude Code is not installed here (looked for "${CLAUDE_BIN}").`);
  if (r.error) throw new Error('the local Claude Code call failed: ' + r.error.message);
  console.log((r.stdout || '').trim() || '(it said nothing)');
  if (r.status !== 0) console.log(`\n(it exited ${r.status})`);

  const changed = sh('git status --short', dir, true).out.trim();
  console.log('\n' + '-'.repeat(60));
  console.log(changed ? 'what it touched:\n' + changed : 'it changed nothing.');

  const checkFile = path.join(dir, 'bugreport', `check-${id}.mjs`);
  if (!fs.existsSync(checkFile)) {
    console.log(`\nNo check at bugreport/check-${id}.mjs, so there is no evidence and no PR.`);
    console.log('Read what it said above. Either the defect needs a human, or run --attempt again.');
    process.exit(2);
  }
  console.log('\nNothing is proven yet. Run the gate:');
  console.log(`  node tools/selfheal/fix.mjs ${id} --prove`);
}

function prove(id) {
  const dir = worktreeFor(id);
  if (!fs.existsSync(dir)) throw new Error('no worktree for ' + id + '. Run --start first.');

  const checkFile = path.join(dir, 'bugreport', `check-${id}.mjs`);
  if (!fs.existsSync(checkFile)) {
    console.log('No check written yet.');
    console.log(`\nWrite the failing check first, at:\n  bugreport/check-${id}.mjs`);
    console.log('\nIt must FAIL on the tree as it stands. That is the evidence. Without it there is no PR.');
    process.exit(2);
  }

  console.log('1. running the check on the UNFIXED tree (it must fail)...');
  const stash = sh('git stash list | head -1', dir, true);
  const before = sh(`git stash push -u -m selfheal-prove >/dev/null 2>&1; node bugreport/check-${id}.mjs`, dir, true);
  sh('git stash pop >/dev/null 2>&1', dir, true);
  console.log(`   exit ${before.code} ${before.code !== 0 ? '(red — good, it reproduces)' : '(green — this check does not describe the bug)'}`);

  console.log('2. running the same check on the FIXED tree...');
  const after = sh(`node bugreport/check-${id}.mjs`, dir, true);
  console.log(`   exit ${after.code} ${after.code === 0 ? '(green)' : '(still red)'}`);

  console.log('3. running the whole suite...');
  const suite = sh('npm test', dir, true);
  console.log(`   exit ${suite.code}`);

  const verdict = judge({ before: before.code, after: after.code, suite: suite.code });
  console.log(`\n${verdict.pass ? 'GATE PASSED' : 'GATE FAILED'} — ${verdict.why}`);

  const failNote = path.join(dir, '.gate-failed.txt');
  if (!verdict.pass) {
    /* Written down so a second --attempt is TOLD what was wrong instead of guessing again. */
    fs.writeFileSync(failNote, `${verdict.why}\n\nThe last 40 lines of the run:\n` +
      (suite.code !== 0 ? suite.out : after.out).split('\n').slice(-40).join('\n'));
    process.exit(1);
  }
  if (fs.existsSync(failNote)) fs.unlinkSync(failNote);

  fs.writeFileSync(path.join(dir, '.proof.json'), JSON.stringify({
    caseId: id, before: before.code, after: after.code, suite: suite.code, at: new Date().toISOString()
  }, null, 2));
  console.log('\nProof recorded. Render the draft PR with:  node tools/selfheal/fix.mjs ' + id + ' --pr');
  if (stash.out) console.log('(note: you had a stash before this ran; it was left alone)');
}

function pr(id) {
  const dir = worktreeFor(id);
  const proofFile = path.join(dir, '.proof.json');
  if (!fs.existsSync(proofFile)) {
    console.log('No proof on file. Run --prove first. There is no path to a PR without it.');
    process.exit(1);
  }
  const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
  const diff = sh('git diff --stat HEAD', dir, true).out.trim();

  const body = [
    `Fixes the defect in case \`${id}\`.`,
    '',
    '**Proof this actually fixes it**',
    '',
    '| step | result |',
    '|---|---|',
    `| the check on the unfixed tree | exit ${proof.before} — failed, as required |`,
    `| the same check after the fix | exit ${proof.after} — passes |`,
    `| the whole test suite | exit ${proof.suite} — green |`,
    '',
    `The check lives at \`bugreport/check-${id}.mjs\` and is part of this change, so this defect`,
    'cannot come back without a test going red.',
    '',
    '**What changed**',
    '',
    '```',
    diff || '(no diff)',
    '```',
    '',
    '---',
    '',
    'Prepared automatically. Opened by a human. Not merged by anything but a human.'
  ].join('\n');

  const out = path.join(dir, 'PR-DRAFT.md');
  fs.writeFileSync(out, body);
  console.log(body);
  console.log('\n' + '-'.repeat(60));
  console.log('DRAFT ONLY. Written to ' + out);
  console.log('Nothing was pushed and no pull request exists.');
  console.log('\nIf you want it, you open it yourself:');
  console.log(`  cd ${dir} && git push -u origin fix/bug-${id} && gh pr create --draft --body-file PR-DRAFT.md`);
  console.log('\nmain has branch protection ON since 2026-08-15, so this cannot land by accident:');
  console.log('a pull request is required, build-test-deploy must be green, and that applies to');
  console.log('admins too. Merging is still a human pressing the button, and the merge is what');
  console.log('deploys to the live site.');
}

/* ---------- --selftest ---------- */
if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n, got) => { bad.push(n); console.log('  FAIL ' + n + (got !== undefined ? '\n        got: ' + JSON.stringify(got) : '')); };
  const eq = (n, g, w) => (g === w ? ok(n) : no(n, g));

  console.log('\nfix — the gate between a change and a pull request\n');

  console.log('the only combination that earns a PR');
  eq('red before, green after, suite green', judge({ before: 1, after: 0, suite: 0 }).pass, true);

  console.log('\nevery other combination is refused');
  eq('the check passed before the fix too', judge({ before: 0, after: 0, suite: 0 }).pass, false);
  eq('and it says why', /does not describe the bug/.test(judge({ before: 0, after: 0, suite: 0 }).why), true);
  eq('the check still fails after', judge({ before: 1, after: 1, suite: 0 }).pass, false);
  eq('the fix broke the rest of the suite', judge({ before: 1, after: 0, suite: 1 }).pass, false);
  eq('and that one is named honestly', /broke something else/.test(judge({ before: 1, after: 0, suite: 1 }).why), true);
  eq('nothing ran at all', judge({ before: 0, after: 0, suite: 1 }).pass, false);

  console.log('\nthe cage: this program holds none of these powers');
  const src = fs.readFileSync(new URL(import.meta.url).pathname, 'utf8');
  /* the FORBIDDEN list and the doc comment mention these words; what matters is that none of
     them is ever handed to a shell. Strip comments and the list itself, then look. */
  const live = src
    .split('\n')
    .filter((l) => !/^\s*\*/.test(l) && !/^\s*\/\*/.test(l) && !/^\s*\/\//.test(l))
    .join('\n')
    .replace(/export const FORBIDDEN = \[[\s\S]*?\];/, '');
  for (const power of FORBIDDEN) {
    live.includes(`sh(\`${power}`) || live.includes(`sh('${power}`) || live.includes(`sh("${power}`)
      ? no('it can run: ' + power)
      : ok('cannot ' + power);
  }

  console.log('\nthe agent that writes the patch runs here, and cannot run anything');
  /* Only the real code, never this test's own words — a check that can match itself passes
     whatever the program does. */
  const code = src.split("if (args.includes('--selftest'))")[0]
    .split('\n').filter((l) => !/^\s*[*\/]/.test(l)).join('\n');
  /--allowed-tools', 'Read Write Edit Glob Grep'/.test(code)
    ? ok('it is given file tools only — no Bash, so it has no shell at all')
    : no('the patch agent was handed a shell');
  !/'Bash'/.test(code) && !/Bash /.test(code.replace(/no Bash/g, ''))
    ? ok('and Bash appears nowhere in what it is allowed') : no('Bash is reachable');
  /cwd: dir/.test(code) ? ok('it runs inside the throwaway worktree, not the repo') : no('it can reach the real checkout');
  /drafts/.test(code) ? ok('it is briefed from the sanitised draft, so it never sees the reporter') : no('the raw case reaches the patch agent');
  /--model', 'sonnet'/.test(code) ? ok('sonnet, not the expensive tier') : no('wrong model tier');
  /\.gate-failed\.txt/.test(code) ? ok('a rejected attempt is told why, next time round') : no('failures are not fed back');
  !/api\.anthropic\.com/.test(code) && !/ANTHROPIC_/.test(code)
    ? ok('no paid API and no key — it is the Claude Code already installed here') : no('a paid API path exists');

  console.log('\nand it tells the truth about what it produced');
  src.includes('DRAFT ONLY') ? ok('the PR step says draft only') : no('no draft warning');
  src.includes('branch protection ON') && src.includes('deploys to the live site')
    ? ok('and says what merging actually does — it ships') : no('no deploy warning');
  src.includes('No proof on file') ? ok('no proof means no PR body at all') : no('PR can be rendered without proof');

  console.log('');
  if (bad.length) { console.log(`fix selftest: ${bad.length} FAILED of ${pass + bad.length}\n`); process.exit(1); }
  console.log(`fix selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

const id = args.find((a) => /^[a-f0-9]{16}$/.test(a));
try {
  if (!id) {
    console.log('usage:\n  node tools/selfheal/fix.mjs <case-id> --start\n' +
                '  node tools/selfheal/fix.mjs <case-id> --attempt\n' +
                '  node tools/selfheal/fix.mjs <case-id> --prove\n' +
                '  node tools/selfheal/fix.mjs <case-id> --pr\n  node tools/selfheal/fix.mjs --selftest');
    process.exit(1);
  }
  if (args.includes('--start')) start(id);
  else if (args.includes('--attempt')) attempt(id);
  else if (args.includes('--prove')) prove(id);
  else if (args.includes('--pr')) pr(id);
  else console.log('pick one of --start, --attempt, --prove, --pr');
} catch (e) { console.error(e.message || e); process.exit(1); }
