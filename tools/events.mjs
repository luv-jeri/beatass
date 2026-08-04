/**
 * One structured line per thing that happens in a delivery lane, so a failure
 * can be found by reading a file instead of by a recipient complaining.
 *
 * Written as JSONL (one JSON object per line) to
 * ~/.config/beatass-<lane>/events.jsonl - OUTSIDE the repo, because events name
 * real handles. The hourly log check (tools/log-check.mjs) reads these.
 *
 * Callers mask phone numbers BEFORE logging. Handles are fine - they are
 * public usernames - but a number is somebody's pocket.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export function logEvent(lane, event) {
  try {
    const dir = path.join(os.homedir(), '.config', 'beatass-' + lane);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'events.jsonl'),
      JSON.stringify({ ts: new Date().toISOString(), ...event }) + '\n');
  } catch {
    /* the event log must never be the thing that kills a delivery */
  }
}
