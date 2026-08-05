/**
 * The human-with-a-script way to see what happened to a message and to un-stick
 * one - no AI in the loop.
 *
 *   node tools/status.mjs status <id>    the full life of one message: who, when,
 *                                        the sender fingerprint, and every logged
 *                                        step across email/Instagram/WhatsApp
 *   node tools/status.mjs stuck          every laptop-lane message that was
 *                                        received but never delivered (gave up,
 *                                        half-sent, or never attempted)
 *   node tools/status.mjs retry <id>     clear a message's delivery state so the
 *                                        next timer run re-attempts it
 *
 * Add --local to read the local dev database instead of the live one.
 *
 * Reads the D1 `events` log (site steps written by the Worker + delivery steps
 * flushed by events-sync) and the two notifier state files. `retry` edits only a
 * state file - it never sends; the armed timer does the actual re-send.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const LOCAL = process.argv.includes('--local');
const MAX_TRIES = 3;

const IG_CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'instagram', 'config.json'), 'utf8'));
const IG_STATE = path.join(REPO, IG_CONFIG.contentDir, '.notified.json');
const WA_STATE = path.join(os.homedir(), '.config', 'beatass-whatsapp', '.wa-notified.json');

const d1 = (sql) => {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql],
    { encoding: 'utf8', maxBuffer: 8e6, cwd: REPO });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').slice(-400));
  return JSON.parse(r.stdout)[0].results;
};
const readState = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } };

/* one state-file entry -> a plain-English delivery status. Same three shapes both
   lanes use: absent = waiting, a date = delivered, an object = tried/half/gave-up. */
function decode(entry) {
  if (entry === undefined || entry === null) return 'waiting - not attempted yet';
  if (typeof entry === 'string') return 'DELIVERED ' + entry.slice(0, 16).replace('T', ' ');
  const a = entry.attempts || 0;
  if (a >= MAX_TRIES) return `GAVE UP after ${a} tries (${entry.reason || 'no reason logged'})`;
  if (entry.partial) return `HALF-SENT: ${entry.partial} bubble(s), ${a} try(s) (${entry.reason || '?'})`;
  return `waiting - ${a} failed try(s) so far (${entry.reason || '?'})`;
}
const isUnfinished = (entry) => entry !== undefined && entry !== null && typeof entry === 'object';

const time = (ts) => new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
const [cmd, id] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function statusOf(mid) {
  const rows = d1(`SELECT id, to_email, to_handle, to_whatsapp, created_at, reports, sender_ua, sender_geo, substr(sender_hash,1,12) sh FROM messages WHERE id='${mid.replace(/'/g, "")}'`);
  if (!rows.length) { console.log(`no message with id ${mid}`); return; }
  const m = rows[0];
  const chans = [m.to_email && 'email', m.to_handle && '@' + m.to_handle, m.to_whatsapp && 'wa ' + m.to_whatsapp].filter(Boolean);
  console.log(`\nmessage ${m.id}`);
  console.log(`  to:        ${chans.join('  +  ') || '(none)'}`);
  console.log(`  received:  ${time(m.created_at)}   reports: ${m.reports}`);
  console.log(`  sender:    ${m.sender_geo || '(no geo)'}  |  ${m.sender_ua ? m.sender_ua.slice(0, 60) : '(no ua)'}  |  #${m.sh || '?'}`);

  console.log('\n  delivery:');
  if (m.to_email) console.log('    email:     sent inline by the site when received (see the log below for delivered/failed)');
  if (m.to_handle) console.log('    instagram: ' + decode(readState(IG_STATE)[m.id]));
  if (m.to_whatsapp) console.log('    whatsapp:  ' + decode(readState(WA_STATE)[m.id]));

  const evs = d1(`SELECT ts, channel, action, outcome, substr(detail,1,90) d FROM events WHERE msg_id='${m.id}' ORDER BY ts`);
  console.log(`\n  log (${evs.length} event${evs.length === 1 ? '' : 's'}):`);
  if (!evs.length) console.log('    (nothing logged - if this is fresh, the delivery events may not be synced yet)');
  const shown = evs.length > 50 ? evs.slice(-50) : evs;
  if (evs.length > 50) console.log(`    ... showing the last 50 of ${evs.length}`);
  for (const e of shown)
    console.log(`    ${time(e.ts)}  ${(e.channel || '-').padEnd(9)} ${e.action.padEnd(14)} ${e.outcome.padEnd(6)} ${e.d || ''}`);
  console.log('');
}

function stuck() {
  const ig = readState(IG_STATE), wa = readState(WA_STATE);
  const now = Date.now() / 1000;
  const msgs = d1('SELECT id, to_handle, to_whatsapp, created_at FROM messages WHERE to_handle IS NOT NULL OR to_whatsapp IS NOT NULL ORDER BY created_at DESC LIMIT 300');
  const out = [];
  for (const m of msgs) {
    for (const [has, state, lane] of [[m.to_handle, ig, 'instagram'], [m.to_whatsapp, wa, 'whatsapp']]) {
      if (!has) continue;
      const entry = state[m.id];
      if (isUnfinished(entry)) out.push([m.id, lane, decode(entry)]);
      else if (entry === undefined && (now - m.created_at) > 600) out.push([m.id, lane, `never attempted (waiting ${Math.round((now - m.created_at) / 60)} min)`]);
    }
  }
  if (!out.length) { console.log('\nnothing stuck - every laptop-lane message is delivered or still fresh.\n'); return; }
  console.log(`\n${out.length} stuck message(s):`);
  for (const [mid, lane, why] of out) console.log(`  ${mid}  ${lane.padEnd(10)} ${why}`);
  console.log('\nre-attempt one with:  node tools/status.mjs retry <id>\n');
}

function retry(mid) {
  const rows = d1(`SELECT to_handle, to_whatsapp FROM messages WHERE id='${mid.replace(/'/g, "")}'`);
  if (!rows.length) { console.log(`no message with id ${mid}`); return; }
  const m = rows[0];
  const cleared = [];
  for (const [has, file, lane] of [[m.to_handle, IG_STATE, 'instagram'], [m.to_whatsapp, WA_STATE, 'whatsapp']]) {
    if (!has) continue;
    const state = readState(file);
    if (state[mid] === undefined) { cleared.push(lane + ' (was already waiting)'); continue; }
    delete state[mid];                                   // absent = waiting = the timer re-attempts
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
    cleared.push(lane);
    try { d1(`INSERT INTO events (ts, msg_id, channel, action, outcome, detail, sender_hash) VALUES (${Math.floor(Date.now() / 1000)}, '${mid}', '${lane}', 'retry', 'ok', 'manual retry via status.mjs', '')`); } catch {}
  }
  if (!cleared.length) console.log(`nothing to retry for ${mid} - it has no Instagram or WhatsApp recipient (email is sent by the site, not the laptop).`);
  else console.log(`reset ${cleared.join(' + ')} for ${mid}. The armed timer re-attempts within ~2 min. Watch:  node tools/status.mjs status ${mid}`);
}

if (cmd === 'status' && id) statusOf(id);
else if (cmd === 'stuck') stuck();
else if (cmd === 'retry' && id) retry(id);
else {
  console.log('usage:\n  node tools/status.mjs status <id>\n  node tools/status.mjs stuck\n  node tools/status.mjs retry <id>\n  (add --local to read the dev database)');
  process.exit(1);
}
