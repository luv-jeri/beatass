/**
 * Reads the last hour of both delivery lanes' logs, finds trouble, and says so.
 *
 *   node tools/log-check.mjs           check the last hour
 *   node tools/log-check.mjs --hours 6 look further back
 *
 * Run hourly by com.beatass.logcheck. When it finds problems it:
 *   - writes the full detail to ~/.config/beatass-logs/report.txt
 *   - appends one summary line to ~/.config/beatass-logs/history.log
 *   - pops a macOS notification, so a broken pipeline is known within the
 *     hour instead of when a recipient complains
 *
 * What it looks at:
 *   - ~/.config/beatass-instagram/events.jsonl   every step, structured
 *   - ~/.config/beatass-whatsapp/events.jsonl
 *   - both lanes' auto.log                        the human-readable trail
 *   - launchctl                                   are the timers even loaded?
 *
 * What it counts as trouble: partial sends, gave-ups, undeliverables, skips,
 * outreach failures, hard errors (✗), and a sender timer that is not loaded.
 *
 * It detects and reports. It does not change anything - fixing is a decision,
 * and decisions stay with people.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

const args = process.argv.slice(2);
const hoursIx = args.indexOf('--hours');
const HOURS = hoursIx >= 0 ? parseFloat(args[hoursIx + 1]) : 1.1;   // a hair over 1h so hourly runs overlap
const SINCE = Date.now() - HOURS * 3600 * 1000;

const OUT_DIR = path.join(os.homedir(), '.config', 'beatass-logs');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BAD_STEPS = new Set(['partial', 'gave-up', 'undeliverable', 'skip', 'outreach-failed', 'skip-blocked']);
const issues = [];
const notes = [];

/* ---------- the structured events ---------- */
for (const lane of ['instagram', 'whatsapp']) {
  const f = path.join(os.homedir(), '.config', 'beatass-' + lane, 'events.jsonl');
  if (!fs.existsSync(f)) { notes.push(`${lane}: no events.jsonl yet`); continue; }
  let recent = 0;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (Date.parse(e.ts) < SINCE) continue;
    recent++;
    if (BAD_STEPS.has(e.step))
      issues.push(`[${lane}] ${e.ts.slice(11, 19)} ${e.step}` +
        (e.id ? ` msg=${e.id}` : '') + (e.handle ? ` @${e.handle}` : '') + (e.to ? ` ${e.to}` : '') +
        (e.attempts ? ` try=${e.attempts}` : '') + (e.error ? ` :: ${e.error}` : ''));
  }
  notes.push(`${lane}: ${recent} event(s) in the window`);
}

/* ---------- hard errors in the human logs (✗ lines under a recent header) ---------- */
for (const lane of ['instagram', 'whatsapp']) {
  const f = path.join(os.homedir(), '.config', 'beatass-' + lane, 'auto.log');
  if (!fs.existsSync(f)) continue;
  let sectionTs = 0;
  for (const line of fs.readFileSync(f, 'utf8').split('\n').slice(-500)) {
    const m = line.match(/^=== (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
    if (m) { sectionTs = Date.parse(m[1].replace(' ', 'T')); continue; }   // local time
    if (sectionTs >= SINCE && line.includes('✗'))
      issues.push(`[${lane}] auto.log: ${line.trim().slice(0, 160)}`);
  }
}

/* ---------- are the timers alive at all? ---------- */
let loaded = '';
try { loaded = execFileSync('launchctl', ['list'], { encoding: 'utf8' }); } catch {}
for (const job of ['com.beatass.notify', 'com.beatass.whatsapp']) {
  if (!loaded.includes(job)) issues.push(`[timers] ${job} is NOT loaded - that lane is not sending`);
}

/* ---------- report ---------- */
const stamp = new Date().toISOString();
const summary = issues.length
  ? `${issues.length} issue(s) in the last ${HOURS.toFixed(1)}h`
  : `all quiet (${notes.join(', ')})`;

fs.writeFileSync(path.join(OUT_DIR, 'report.txt'),
  `beatass delivery check - ${stamp}\nwindow: last ${HOURS.toFixed(1)} hours\n\n` +
  (issues.length ? 'ISSUES:\n' + issues.map((i) => '  ' + i).join('\n') : 'No issues found.') +
  '\n\nactivity: ' + notes.join(' | ') + '\n');
fs.appendFileSync(path.join(OUT_DIR, 'history.log'), `${stamp}  ${summary}\n`);

console.log(summary);
if (issues.length) {
  issues.forEach((i) => console.log('  ' + i));
  /* the notification is the whole point: trouble becomes visible in an hour,
     not whenever somebody thinks to look */
  try {
    execFileSync('osascript', ['-e',
      `display notification ${JSON.stringify(issues.length + ' delivery issue(s) - see ~/.config/beatass-logs/report.txt')} with title "beatass" sound name "Basso"`]);
  } catch {}
}
