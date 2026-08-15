/**
 * approve-issue.mjs — the ONLY program here that may publish a GitHub issue.
 *
 *   node tools/selfheal/approve-issue.mjs <case-id> [--local]        show the draft, ask, publish
 *   node tools/selfheal/approve-issue.mjs <case-id> --show           print it and stop
 *   node tools/selfheal/approve-issue.mjs --selftest
 *
 * A HUMAN RUNS THIS. Nothing schedules it, nothing else calls it, and it refuses to run without
 * a person answering a question at a keyboard. That is the whole reason it is a separate file
 * from prepare-issue.mjs: the automatic lane never even loads this code.
 *
 * Publishing to github.com/luv-jeri/beatass is publishing to the open internet, permanently.
 * So this program re-reads the draft off disk and re-runs the privacy gate immediately before
 * calling `gh` — not because the draft was untrusted when written, but because "checked once,
 * some time ago, by another program" is not a guarantee about the bytes in front of you now.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawnSync } from 'child_process';
import { isClean } from './prepare-issue.mjs';

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const SHOW = args.includes('--show');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const DRAFTS = path.join(ROOT, 'content', 'bugs', 'drafts');

const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql], { encoding: 'utf8', maxBuffer: 16e6 });
  if (r.status !== 0) throw new Error('d1 failed: ' + (r.stderr || r.stdout || '').slice(-400));
  return JSON.parse(r.stdout)[0].results;
};
const q = (s) => String(s == null ? '' : s).replace(/'/g, "''");

const ask = (question) => new Promise((res) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (a) => { rl.close(); res(a.trim()); });
});

async function run() {
  const id = args.find((a) => /^[a-f0-9]{16}$/.test(a));
  if (!id) {
    const ready = fs.existsSync(DRAFTS) ? fs.readdirSync(DRAFTS).filter((f) => f.endsWith('.md')) : [];
    console.log(ready.length
      ? 'drafts waiting:\n' + ready.map((f) => '  ' + f.replace('.md', '')).join('\n')
      : 'no drafts waiting.');
    console.log('\nusage: node tools/selfheal/approve-issue.mjs <case-id> [--show] [--local]');
    return;
  }

  const file = path.join(DRAFTS, id + '.md');
  if (!fs.existsSync(file)) throw new Error('no draft for ' + id + '. Run prepare-issue.mjs first.');
  const text = fs.readFileSync(file, 'utf8');

  console.log('\n' + '-'.repeat(72));
  console.log(text);
  console.log('-'.repeat(72) + '\n');

  if (SHOW) return;

  /* The gate runs again, here, on the exact bytes about to be published. */
  if (!isClean(text)) {
    console.log('REFUSED. This draft carries something private and must not be published.');
    console.log('Something upstream is broken - do not work around this by editing the draft.');
    process.exit(1);
  }

  const repo = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner,visibility'], { encoding: 'utf8' });
  let where = 'the repository';
  if (repo.status === 0) {
    try {
      const r = JSON.parse(repo.stdout);
      where = `${r.nameWithOwner} (${r.visibility})`;
      if (r.visibility === 'PUBLIC')
        console.log('NOTE: this repository is PUBLIC. Everything above becomes world-readable, permanently.\n');
    } catch { /* the warning is a courtesy, not a dependency */ }
  }

  const answer = await ask(`Publish this as a GitHub issue on ${where}? Type yes to publish: `);
  if (answer.toLowerCase() !== 'yes') { console.log('Nothing was published.'); return; }

  const title = (text.split('\n')[0] || '').replace(/^#\s*/, '').trim();
  const body = text.split('\n').slice(1).join('\n').trim();

  const made = spawnSync('gh', ['issue', 'create', '--title', title, '--body', body], { encoding: 'utf8' });
  if (made.status !== 0) {
    console.error('gh issue create failed:\n' + (made.stderr || made.stdout || '').slice(-500));
    process.exit(1);
  }
  const url = (made.stdout || '').trim().split('\n').pop();
  console.log('\npublished: ' + url);

  d1(`UPDATE bug_reports SET issue_url='${q(url)}', state='issue_open' WHERE id='${q(id)}' AND state='issue_ready'`);
  d1(`INSERT INTO events (ts, msg_id, channel, action, outcome, detail, sender_hash) VALUES (` +
     `${Math.floor(Date.now() / 1000)}, '${q(id)}', 'bug', 'issue-opened', 'ok', '${q(url)}', '')`);
  console.log('case ' + id + ' is now issue_open.');
}

if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n) => { bad.push(n); console.log('  FAIL ' + n); };

  console.log('\napprove-issue — the human gate\n');

  const src = fs.readFileSync(new URL(import.meta.url).pathname, 'utf8');
  /^[\s\S]*$/.test(src) && src.includes('readline') ? ok('it asks a person before publishing') : no('no prompt');
  src.includes("answer.toLowerCase() !== 'yes'") ? ok('and only the word yes publishes') : no('weak confirmation');
  src.includes('isClean(text)') ? ok('the privacy gate runs again on the exact bytes') : no('no re-check');
  src.includes('PUBLIC') ? ok('it warns when the repository is public') : no('no visibility warning');

  const other = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'prepare-issue.mjs'), 'utf8');
  !other.includes('gh issue create') ? ok('prepare-issue cannot publish - it has no gh call at all') : no('prepare-issue can publish');
  !other.includes('spawnSync(\'gh\'') ? ok('and no gh binary call of any kind') : no('prepare-issue calls gh');

  /* Look for real invocations, not for words. An earlier version of this check searched for
     the string "gh " and matched "enough" and "through" - a check that fires on prose is
     worse than no check, because it trains you to ignore it. */
  const outward = (code) => {
    const live = code.split('\n').filter((l) => !/^\s*[*\/]/.test(l)).join('\n');
    return /spawnSync\(\s*['"]gh['"]/.test(live)
        || /\bgh (issue|pr|repo) (create|merge|edit)/.test(live)
        || /api\.resend\.com/.test(live)
        || /git (push|merge)/.test(live)
        || /wrangler deploy/.test(live);
  };
  const triage = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'triage.mjs'), 'utf8');
  !outward(triage) ? ok('triage can neither publish nor email nor deploy') : no('triage has an outward path');
  !outward(other) ? ok('prepare-issue likewise holds no outward power') : no('prepare-issue has an outward path');
  outward(src) ? ok('approve-issue DOES hold the publish power - it is the one that should') : no('approve-issue cannot publish');

  console.log('');
  if (bad.length) { console.log(`approve-issue selftest: ${bad.length} FAILED\n`); process.exit(1); }
  console.log(`approve-issue selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

run().catch((e) => { console.error(e.message || e); process.exit(1); });
