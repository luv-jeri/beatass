/**
 * Flushes the laptop's delivery events into the one queryable log.
 *
 * The Worker already writes every site-side action (received, viewed, blocked,
 * email delivered/failed, sender-blocked) straight into the D1 `events` table.
 * The laptop notifiers (Instagram, WhatsApp) can't reach D1 on every step
 * without a slow wrangler call per event, so they append to a fast local file -
 * ~/.config/beatass-<lane>/events.jsonl. This script carries those lines into
 * the SAME `events` table, so "what happened to message X?" is one query across
 * both halves of the pipeline.
 *
 *   node tools/events-sync.mjs            sync new lines into the live (remote) DB
 *   node tools/events-sync.mjs --local    sync into the local dev DB (for tests)
 *   node tools/events-sync.mjs --dry       show what WOULD sync, write nothing
 *
 * It is idempotent: a per-lane offset file (.events-synced) records how many
 * lines are already in D1, so a re-run only carries the new tail. A failed
 * wrangler call leaves the offset untouched, so the same lines retry next run -
 * exactly the "retry from a script, no AI" the pipeline is meant to have.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const LANES = ['instagram', 'whatsapp'];
const REMOTE = !process.argv.includes('--local');
const DRY = process.argv.includes('--dry');

const cfgDir = (lane) => path.join(os.homedir(), '.config', 'beatass-' + lane);
const sq = (v) => v == null || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";

/* one laptop event line -> one row for the events table. Field names differ
   (the notifiers speak 'step'/'id'/'lane'; the table speaks action/msg_id/
   channel), and everything the table has no column for is folded into detail. */
function toRow(e, lane) {
  const t = Date.parse(e.ts);
  const ts = Number.isFinite(t) ? Math.floor(t / 1000) : Math.floor(Date.now() / 1000);
  const channel = e.lane === 'ig' ? 'instagram' : e.lane === 'wa' ? 'whatsapp' : (e.lane || lane);
  const bad = ['gave-up', 'undeliverable', 'partial', 'skip', 'outreach-failed', 'skip-blocked'];
  const outcome = e.error ? 'error' : bad.includes(e.step) ? 'skip' : 'ok';
  const { ts: _t, lane: _l, step: _s, id: _i, ...rest } = e;   // detail = the leftover fields
  const detail = Object.keys(rest).length ? JSON.stringify(rest).slice(0, 300) : '';
  return `(${ts}, ${sq(e.id)}, ${sq(channel)}, ${sq(e.step || 'event')}, ${sq(outcome)}, ${sq(detail)}, '')`;
}

function d1File(sqlPath) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    REMOTE ? '--remote' : '--local', '--file', sqlPath],
    { encoding: 'utf8', maxBuffer: 8e6 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || '').slice(-400));
}

let total = 0;
for (const lane of LANES) {
  const file = path.join(cfgDir(lane), 'events.jsonl');
  if (!fs.existsSync(file)) { console.log(`${lane}: no events.jsonl`); continue; }

  const offFile = path.join(cfgDir(lane), REMOTE ? '.events-synced' : '.events-synced-local');
  const offset = fs.existsSync(offFile) ? parseInt(fs.readFileSync(offFile, 'utf8'), 10) || 0 : 0;
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
  const fresh = lines.slice(offset);
  if (!fresh.length) { console.log(`${lane}: up to date (${lines.length} lines)`); continue; }

  const rows = [];
  for (const line of fresh) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    rows.push(toRow(e, lane));
  }
  if (!rows.length) { fs.writeFileSync(offFile, String(lines.length)); continue; }

  if (DRY) { console.log(`${lane}: would sync ${rows.length} event(s) (dry)`); total += rows.length; continue; }

  /* write the batch to a temp .sql and hand wrangler the FILE, never a giant
     --command argv (G21: bulk payload to a file, print a count). */
  const tmp = path.join(os.tmpdir(), `beatass-events-${lane}-${Date.now()}.sql`);
  /* SQLite caps a multi-row VALUES at 500 terms, so emit the batch as several
     INSERTs of at most 200 rows each rather than one giant one. */
  const CHUNK = 200;
  let sql = '';
  for (let i = 0; i < rows.length; i += CHUNK)
    sql += 'INSERT INTO events (ts, msg_id, channel, action, outcome, detail, sender_hash) VALUES\n' +
      rows.slice(i, i + CHUNK).join(',\n') + ';\n';
  fs.writeFileSync(tmp, sql);
  try {
    d1File(tmp);
    fs.writeFileSync(offFile, String(lines.length));   // only advance the offset on success
    console.log(`${lane}: synced ${rows.length} event(s) -> D1 (${REMOTE ? 'remote' : 'local'})`);
    total += rows.length;
  } catch (err) {
    console.error(`${lane}: sync FAILED, will retry next run :: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}
console.log(`events-sync: ${total} event(s) carried into the log`);
