/**
 * auto.mjs — the switch and the dial for the automatic bug loop.
 *
 *   node tools/selfheal/auto.mjs                    what is it doing right now
 *   node tools/selfheal/auto.mjs on                 start running it on a timer
 *   node tools/selfheal/auto.mjs off                stop
 *   node tools/selfheal/auto.mjs every 5            run every 5 minutes
 *   node tools/selfheal/auto.mjs step notify on     turn one stage on or off
 *   node tools/selfheal/auto.mjs quiet 23 7         do not run between 11pm and 7am
 *   node tools/selfheal/auto.mjs quiet off
 *   node tools/selfheal/auto.mjs --selftest
 *
 * WHY THIS EXISTS RATHER THAN "EDIT THE JSON"
 *
 * How often the loop runs is written down in TWO places: `everyMinutes` in
 * config.json, and `StartInterval` in the launchd job that macOS actually obeys.
 * Change the first on its own and nothing happens - the file now disagrees with
 * reality, and the next person reads the wrong number and believes it. So every
 * frequency change here rewrites the plist and reloads the job, and `status`
 * reads the LIVE plist rather than the config, so it can tell you when the two
 * have drifted apart instead of quietly showing you the number you hoped for.
 *
 * The same reasoning as the delivery lanes: a setting you cannot see the real
 * value of is worse than no setting.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { pathToFileURL } from 'url';

const IS_MAIN = import.meta.url === pathToFileURL(process.argv[1] || '').href;
const args = IS_MAIN ? process.argv.slice(2) : [];

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..');
const CONFIG = path.join(HERE, 'config.json');
const RUNNER = path.join(HERE, 'auto-selfheal.sh');
const LABEL = 'com.beatass.selfheal';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', LABEL + '.plist');
const LOG = path.join(os.homedir(), '.config', 'beatass-logs', 'selfheal.log');
const COOLDOWN = path.join(os.homedir(), '.config', 'beatass-logs', '.selfheal-cooldown');

/** Below two minutes the runs would overlap; above a day it is not automation. */
export const MIN_MINUTES = 2;
export const MAX_MINUTES = 1440;

export function validMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.floor(n) !== n) return { ok: false, why: 'that is not a whole number of minutes' };
  if (n < MIN_MINUTES) return { ok: false, why: `${n} is too often - runs would overlap. The floor is ${MIN_MINUTES} minutes.` };
  if (n > MAX_MINUTES) return { ok: false, why: `${n} minutes is more than a day, which is not really automation.` };
  return { ok: true, minutes: n };
}

/** The launchd job, built from the config so the two cannot be written twice. */
export function plistFor(minutes, runner = RUNNER, logPath = LOG) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>${runner}</string></array>
  <key>StartInterval</key><integer>${minutes * 60}</integer>
  <key>ThrottleInterval</key><integer>${minutes * 60}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${logPath}</string>
  <key>StandardErrorPath</key><string>${logPath}</string>
</dict>
</plist>
`;
}

/** The number macOS is really using, read back from the file it obeys. */
export function minutesInPlist(text) {
  const m = String(text || '').match(/<key>StartInterval<\/key>\s*<integer>(\d+)<\/integer>/);
  return m ? Number(m[1]) / 60 : null;
}

const readConfig = () => JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
const writeConfig = (c) => fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2) + '\n');
const sh = (cmd) => spawnSync('bash', ['-lc', cmd], { encoding: 'utf8' });
const uid = () => String(process.getuid());
const loaded = () => sh(`launchctl list | grep -c ${LABEL}`).stdout.trim() !== '0';

/** Write the job file and make launchd pick it up. Reload, not just write. */
function install(minutes) {
  fs.mkdirSync(path.dirname(PLIST), { recursive: true });
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(PLIST, plistFor(minutes));
  fs.chmodSync(RUNNER, 0o755);

  /* A job can be *disabled* in launchd's override database as well as unloaded,
     and bootstrap fails with a bare "Input/output error" when it is - which is
     exactly what happened to the six delivery jobs on 2026-08-15 and cost real
     time to work out. Enable first, always; it is a no-op when it is not needed. */
  sh(`launchctl enable gui/${uid()}/${LABEL}`);
  sh(`launchctl bootout gui/${uid()}/${LABEL} 2>/dev/null`);
  const r = sh(`launchctl bootstrap gui/${uid()} ${JSON.stringify(PLIST)}`);
  return r.status === 0
    ? { ok: true }
    : { ok: false, why: (r.stderr || r.stdout || '').trim() };
}

function uninstall() {
  sh(`launchctl bootout gui/${uid()}/${LABEL} 2>/dev/null`);
  return { ok: !loaded() };
}

/* ---------- what it is doing right now ---------- */
function status() {
  const c = readConfig();
  const live = fs.existsSync(PLIST) ? minutesInPlist(fs.readFileSync(PLIST, 'utf8')) : null;
  const running = loaded();
  const fails = fs.existsSync(COOLDOWN) ? Number(fs.readFileSync(COOLDOWN, 'utf8').trim()) || 0 : 0;

  const row = (k, v) => console.log('  ' + String(k).padEnd(22) + v);
  console.log('\nthe automatic bug loop\n');
  row('running on a timer', running ? 'yes' : 'NO - nothing is scheduled');
  row('master switch', c.enabled ? 'on' : 'OFF (the timer fires and does nothing)');
  row('how often', live ? `every ${live} minute(s)` : 'no job installed');

  if (live !== null && live !== c.everyMinutes)
    console.log(`\n  MISMATCH: config.json says every ${c.everyMinutes} minute(s), macOS is using ${live}.\n` +
                `  macOS wins. Run:  node tools/selfheal/auto.mjs every ${c.everyMinutes}`);

  console.log('\n  stages:');
  for (const [k, v] of Object.entries(c.steps || {}))
    if (!k.startsWith('_')) row('    ' + k, v ? 'on' : 'off');
  if (c.steps && !c.steps.notify)
    console.log('    (notify off: nobody is emailed. Turning it on gives you a DRY RUN in the log,\n' +
                '     because the runner never passes --send. Real sending stays a human at a keyboard.)');

  row('\n  quiet hours', Array.isArray(c.quietHours) ? `${c.quietHours[0]}:00 - ${c.quietHours[1]}:00` : 'none');
  if (fails) row('  backing off', `${fails} failure(s) in a row - see the log`);

  console.log('\n  log   ' + LOG);
  if (fs.existsSync(LOG)) {
    const lines = fs.readFileSync(LOG, 'utf8').trim().split('\n').slice(-6);
    console.log(lines.map((l) => '        ' + l).join('\n'));
  } else {
    console.log('        (nothing yet)');
  }
  console.log('');
}

/* ---------- the commands ---------- */
function run() {
  const [cmd, a, b] = args;
  const c = readConfig();

  if (!cmd || cmd === 'status') return status();

  if (cmd === 'on') {
    c.enabled = true; writeConfig(c);
    const r = install(c.everyMinutes);
    if (!r.ok) { console.error('could not install the job:\n  ' + r.why); process.exit(1); }
    console.log(`on - running every ${c.everyMinutes} minute(s).`);
    return status();
  }

  if (cmd === 'off') {
    c.enabled = false; writeConfig(c);
    uninstall();
    console.log('off - the job is unloaded AND the master switch is false, so nothing runs either way.');
    return;
  }

  if (cmd === 'every') {
    const v = validMinutes(a);
    if (!v.ok) { console.error(v.why); process.exit(1); }
    c.everyMinutes = v.minutes; writeConfig(c);
    if (c.enabled) {
      const r = install(v.minutes);
      if (!r.ok) { console.error('could not reload the job:\n  ' + r.why); process.exit(1); }
      console.log(`now running every ${v.minutes} minute(s), and macOS has been told.`);
    } else {
      console.log(`set to every ${v.minutes} minute(s). The loop is off, so it takes effect when you turn it on.`);
    }
    return;
  }

  if (cmd === 'step') {
    if (!c.steps || !(a in c.steps)) {
      console.error(`no stage called "${a}". They are: ` +
        Object.keys(c.steps || {}).filter((k) => !k.startsWith('_')).join(', '));
      process.exit(1);
    }
    if (b !== 'on' && b !== 'off') { console.error('say on or off'); process.exit(1); }
    c.steps[a] = b === 'on'; writeConfig(c);
    console.log(`${a} is now ${b}.`);
    if (a === 'notify' && b === 'on')
      console.log('\nNote: this only makes the loop PRINT who would be emailed, into the log.\n' +
                  'The runner never passes --send, and the key it would need is not on this laptop.\n' +
                  'Read the log for a while before anything is sent for real.');
    return;
  }

  if (cmd === 'quiet') {
    if (a === 'off') { c.quietHours = null; writeConfig(c); console.log('quiet hours removed.'); return; }
    const from = Number(a), to = Number(b);
    if (![from, to].every((h) => Number.isInteger(h) && h >= 0 && h <= 23)) {
      console.error('give two hours, 0-23. Example: quiet 23 7');
      process.exit(1);
    }
    c.quietHours = [from, to]; writeConfig(c);
    console.log(`quiet between ${from}:00 and ${to}:00.`);
    return;
  }

  console.log('usage:\n' +
    '  node tools/selfheal/auto.mjs                 what is it doing\n' +
    '  node tools/selfheal/auto.mjs on | off\n' +
    '  node tools/selfheal/auto.mjs every <minutes>\n' +
    '  node tools/selfheal/auto.mjs step <name> on|off\n' +
    '  node tools/selfheal/auto.mjs quiet <from> <to> | quiet off');
  process.exit(1);
}

/* ---------- --selftest ---------- */
if (args.includes('--selftest')) {
  let pass = 0; const bad = [];
  const ok = (n) => { pass++; console.log('  ok   ' + n); };
  const no = (n, got) => { bad.push(n); console.log('  FAIL ' + n + (got !== undefined ? '\n        got: ' + JSON.stringify(got) : '')); };
  const eq = (n, g, w) => (g === w ? ok(n) : no(n, g));

  console.log('\nauto — the switch and the dial\n');

  console.log('the frequency cannot be set to something silly');
  eq('10 minutes is fine', validMinutes(10).ok, true);
  eq('the floor is enforced', validMinutes(1).ok, false);
  eq('and it says why', /overlap/.test(validMinutes(1).why), true);
  eq('more than a day is refused', validMinutes(2000).ok, false);
  eq('half a minute is refused', validMinutes(0.5).ok, false);
  eq('nonsense is refused', validMinutes('soon').ok, false);
  eq('the exact floor is allowed', validMinutes(MIN_MINUTES).ok, true);

  console.log('\nthe number in the job file is the number you asked for');
  for (const m of [2, 5, 10, 60, 1440])
    eq(`${m} minute(s) -> ${m * 60} seconds`, minutesInPlist(plistFor(m)), m);
  eq('the job file is valid enough to parse back', /<\/plist>/.test(plistFor(10)), true);
  eq('it throttles as well as schedules, so runs cannot stack',
    /<key>ThrottleInterval<\/key>\s*<integer>600<\/integer>/.test(plistFor(10)), true);

  console.log('\nthe runner holds no outward power');
  const runner = fs.readFileSync(RUNNER, 'utf8');
  const live = runner.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  !/--send/.test(live) ? ok('it can never send an email - --send appears nowhere in what runs') : no('the runner can send');
  !/approve-issue/.test(live) ? ok('it cannot publish an issue') : no('the runner can publish');
  !/\bfix\.mjs/.test(live) ? ok('it cannot touch the fixer, so no PR can come from a timer') : no('the runner can open a PR');
  !/wrangler deploy/.test(live) ? ok('it cannot deploy') : no('the runner can deploy');
  /backoff_skip/.test(live) ? ok('a broken run goes quiet instead of retrying every few minutes') : no('no backoff');
  /pgrep -f/.test(live) ? ok('two runs cannot overlap') : no('no single-instance guard');
  /ENABLED.*=.*1/.test(live) ? ok('the master switch is checked by the runner itself') : no('the switch is not honoured');

  console.log('\nthe shipped defaults are the safe ones');
  const c = readConfig();
  eq('notify starts off', c.steps.notify, false);
  eq('triage starts on', c.steps.triage, true);
  eq('the shipped frequency is allowed', validMinutes(c.everyMinutes).ok, true);

  console.log('');
  if (bad.length) { console.log(`auto selftest: ${bad.length} FAILED of ${pass + bad.length}\n`); process.exit(1); }
  console.log(`auto selftest: all ${pass} checks pass\n`);
  process.exit(0);
}

if (IS_MAIN) {
  try { run(); } catch (e) { console.error(e.message || e); process.exit(1); }
}
