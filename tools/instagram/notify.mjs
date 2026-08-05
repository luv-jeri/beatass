/**
 * Tells a confession's recipient on Instagram that a message is waiting for
 * them, by DM from our own account. It arrives as three separate messages -
 * a one-line intro, then their confession alone in its own bubble, then the
 * link plus the automated/opt-out notice. The link goes to the /m page: the
 * full message, the doll clip, block, report, and the only reply box.
 *
 *   node tools/instagram/notify.mjs                     list what is waiting
 *   node tools/instagram/notify.mjs --text <id>         print all three messages, no browser
 *   node tools/instagram/notify.mjs --selftest          check the preview logic, no database
 *   node tools/instagram/notify.mjs --dry-run <id>      walk one message, screenshot, send NOTHING
 *   node tools/instagram/notify.mjs --send <id>         send one DM
 *   node tools/instagram/notify.mjs --auto              send every waiting DM, unattended
 *   node tools/instagram/notify.mjs --auto --dry        walk every waiting DM, send NOTHING
 *   node tools/instagram/notify.mjs --block <handle>    honour a STOP: never DM them again
 *
 * --auto is the hands-off mode: it works through the whole queue on its own,
 * which is what the launchd job (com.beatass.notify) runs on a timer. Its
 * safety rails, because nobody is watching:
 *   - only messages that have a handle AND a stored view link,
 *   - the ig:<handle> block list is re-checked immediately before each send,
 *   - the handle must match an Instagram account EXACTLY or that one is skipped,
 *   - a message is never sent twice (.notified.json),
 *   - at most DAILY_CAP sends per calendar day,
 *   - a random pause between sends so it never bursts,
 *   - one bad message is skipped (screenshot saved), the rest still go.
 *
 * Every delivered DM is followed by the outreach step (outreach.mjs): we follow
 * the recipient and comment on their latest post, both pointing at the message
 * requests folder where Instagram files a DM from a stranger. It runs AFTER the
 * DM, never before, because both of those say "you have a message waiting" and
 * that has to be true when they read it. A dry run stays dry through all of it.
 *
 * A --local flag reads the local dev D1 instead of production, for testing.
 *
 * Selector honesty (G27): every Instagram selector here was captured from the
 * live DOM on 2026-08-03, not guessed. When Instagram redesigns and a step
 * stops matching, the run stops and writes tools/instagram/last-failure.png.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { logEvent } from '../events.mjs';
import { runOutreach } from './outreach.mjs';
import { dismissPopups, openThread, typeDm, clearBox, ensureAccount } from './ig-dm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));

// a saved browser session is a credential: it lives outside the repo
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');

// which messages have already been notified, so a re-run cannot double-DM
const SENT_LOG = path.join(ROOT, CONFIG.contentDir, '.notified.json');

const SITE = 'https://beatass.com';
const DAILY_CAP = 30;            // most auto-sends in one calendar day
/* How many delivery attempts one message gets before we stop. Same lesson as
   the WhatsApp lane (2026-08-05): an unbounded retry is a browser window every
   two minutes forever; zero retries is Harsh getting bubble 1 of 3 - the intro
   with no confession and no link - and nobody ever finishing the job. */
const MAX_TRIES = 3;
const evt = (step, extra) => logEvent('instagram', { lane: 'ig', step, ...extra });

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const AUTO = args.includes('--auto');
const DRY = args.includes('--dry');            // pairs with --auto: walk, never send
const flagVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY_ID = flagVal('--dry-run');
const SEND_ID = flagVal('--send');
const TEXT_ID = flagVal('--text');             // print the DM, touch no browser
const BLOCK_HANDLE = flagVal('--block');

const say = (m) => console.log(m);
const die = (m) => { console.error('\n✗ ' + m + '\n'); process.exit(1); };

/* ---------- the database, through wrangler (no secrets touched) ---------- */

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) die('database query failed:\n' + (r.stderr || r.stdout || '').slice(-800));
  try { return JSON.parse(r.stdout)[0].results; }
  catch (e) { die('could not read the database answer:\n' + (r.stdout || '').slice(-400)); }
}

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";  // SQL string literal

function loadSent() {
  return fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')) : {};
}
/**
 * What does the log say about this message?
 *   nothing                      never attempted   -> waiting (start at bubble 0)
 *   a date string                fully delivered   -> done, never again
 *   {partial, attempts}          half-delivered    -> resume at the next bubble,
 *                                                     until MAX_TRIES is spent
 * Pure, so the selftest can prove the resume rule without a browser.
 */
export function entryState(entry, maxTries = MAX_TRIES) {
  if (!entry) return { kind: 'waiting', startAt: 0 };
  if (typeof entry === 'string') return { kind: 'done', startAt: 0 };
  if ((entry.attempts || 0) >= maxTries) return { kind: 'gaveup', startAt: entry.partial || 0 };
  return { kind: 'resume', startAt: entry.partial || 0 };
}

/** A failed or half-finished attempt. Never marks the message delivered. */
function recordPartial(sent, id, bubbles, reason) {
  const prev = (sent[id] && typeof sent[id] === 'object') ? sent[id] : { attempts: 0, partial: 0 };
  const entry = {
    partial: Math.max(bubbles || 0, prev.partial || 0),   // bubbles never un-send; 0/undefined = failed before any went
    attempts: (prev.attempts || 0) + 1,
    reason: String(reason).slice(0, 160),
    last: new Date().toISOString()
  };
  sent[id] = entry;
  fs.mkdirSync(path.dirname(SENT_LOG), { recursive: true });
  fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2));
  return entry;
}

function recordSent(sent, id) {
  sent[id] = new Date().toISOString();
  fs.mkdirSync(path.dirname(SENT_LOG), { recursive: true });
  fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2));
}
function sentToday(sent) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(sent).filter((v) => typeof v === 'string' && v.slice(0, 10) === today).length;
}
function isBlocked(handle) {
  return d1(`SELECT 1 AS x FROM blocklist WHERE email = ${sq('ig:' + handle)}`).length > 0;
}

/** Waiting = has a handle, has a minted link, recipient hasn't blocked us,
 *  and we have not already sent it. */
function pending() {
  const sent = loadSent();
  const rows = d1(
    "SELECT m.id, m.to_name, m.to_handle, m.view_token, m.body, m.created_at FROM messages m " +
    "WHERE m.to_handle IS NOT NULL AND m.view_token IS NOT NULL " +
    "AND NOT EXISTS (SELECT 1 FROM blocklist b WHERE b.email = 'ig:' || m.to_handle) " +
    "ORDER BY m.created_at"
  );
  return { rows: rows.filter((r) => ['waiting', 'resume'].includes(entryState(sent[r.id]).kind)), sent };
}

function loadOne(id) {
  if (!/^[a-f0-9]{16}$/.test(id || '')) die('that does not look like a message id (16 hex chars).');
  const rows = d1(`SELECT id, to_name, to_handle, view_token, body FROM messages WHERE id = ${sq(id)}`);
  if (!rows.length) die(`no message ${id} in the ${LOCAL ? 'local' : 'live'} database.`);
  const m = rows[0];
  if (!m.to_handle) die(`message ${id} has no Instagram handle - it was an email-only send.`);
  if (!m.view_token) die(`message ${id} has no view link stored (sent before the notifier existed).`);
  if (isBlocked(m.to_handle)) die(`@${m.to_handle} has blocked beatass. We honour that. Not sending.`);
  return m;
}

/* ---------- what the DM says ---------- */

const linkFor = (m) => `${SITE}/m?id=${m.id}&t=${m.view_token}`;

/* The confession itself now rides in the DM (Sanjay, 2026-08-03) - a bare link
   from an account you don't follow reads like spam, the words are what make it
   real. Long ones get clipped, which is also the hook: the rest of it, the doll
   clip, and the only reply box all live on the page. */
const DM_PREVIEW = 280;

export function dmPreview(body) {
  const clean = String(body || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= DM_PREVIEW) return { text: clean, clipped: false };
  const cut = clean.slice(0, DM_PREVIEW);
  const space = cut.lastIndexOf(' ');
  /* break on a word if there is one near the end, else mid-word rather than
     throwing away half the preview to a very long unbroken string */
  return { text: (space > DM_PREVIEW - 60 ? cut.slice(0, space) : cut).trimEnd() + '...', clipped: true };
}

/* Three bubbles, not one (Sanjay, 2026-08-03): "its very hard to know what is
   the actual message as its buttered with the admin message". A single blob
   buries the confession between a greeting and a legal footer. Sent as
   separate messages, the middle bubble is nothing but their words - which is
   the only part a stranger actually cares about. */
export const dmParts = (m, link) => {
  const p = dmPreview(m.body);
  const parts = [];
  if (p.text) {
    parts.push('hey - someone left you an anonymous message on beatass.com. this is what they said:');
    parts.push('"' + p.text + '"');
  } else {
    parts.push('hey - someone left you an anonymous message on beatass.com.');
  }
  parts.push(
    (p.clipped ? 'read the rest' : 'see what they did to the doll') +
    ' (and reply to them) here: ' + link + '\n\n' +
    'this is an automated message from beatass.com. open the link to read it, ' +
    'share it, report it, or block us so we never message you again.');
  return parts;
};

/** The whole DM as one block of text, for printing and reading. Never typed. */
export const dmText = (m, link) => dmParts(m, link).join('\n\n');

/** Print the DM the way it will land: one framed block per bubble. */
function showParts(parts) {
  parts.forEach((p, i) => {
    say(`  message ${i + 1} of ${parts.length}:`);
    say(p.split('\n').map((l) => '    | ' + l).join('\n') + '\n');
  });
}

/* --selftest proves the preview logic before any DM is composed: no database,
   no browser, nothing outward. Runs in CI. */
if (args.includes('--selftest')) {
  let checks = 0;
  const eq = (label, got, want) => {
    checks++;
    if (got !== want) { console.error(`✗ ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); process.exitCode = 1; }
  };

  /* the resume rule - born from Harsh's half-delivered DM, 2026-08-05 */
  eq('a fresh message is waiting', entryState(undefined).kind, 'waiting');
  eq('a fresh message starts at bubble 1', entryState(undefined).startAt, 0);
  eq('a delivered message is done forever', entryState('2026-08-04T19:55:11.955Z').kind, 'done');
  eq('a partial resumes', entryState({ partial: 1, attempts: 1 }).kind, 'resume');
  eq('a resume starts after the bubbles that landed', entryState({ partial: 1, attempts: 1 }).startAt, 1);
  eq('three failed tries give up', entryState({ partial: 1, attempts: 3 }).kind, 'gaveup');
  eq('a malformed entry cannot loop forever', entryState({ attempts: 99 }).kind, 'gaveup');
  /* the bug found live: a failure before any bubble (bad handle) must still count
     and give up, or it relaunches a browser every couple of minutes for good. */
  eq('one pre-send failure still retries', entryState({ partial: 0, attempts: 1 }).kind, 'resume');
  eq('a failure before any bubble gives up after MAX_TRIES', entryState({ partial: 0, attempts: 3 }).kind, 'gaveup');
  const long = 'x'.repeat(400);
  eq('short body is quoted whole', dmPreview('you never called back').text, 'you never called back');
  eq('short body is not clipped', dmPreview('hi').clipped, false);
  eq('long body is clipped', dmPreview(long).clipped, true);
  eq('clip stays within budget', dmPreview(long).text.length <= DM_PREVIEW + 3, true);
  eq('clip ends with the marker', dmPreview(long).text.endsWith('...'), true);
  eq('clip breaks on a word', dmPreview(('word '.repeat(80)).trim()).text.endsWith('word...'), true);
  eq('empty body survives', dmPreview('').text, '');
  eq('null body survives', dmPreview(null).text, '');
  eq('carriage returns normalise', dmPreview('a\r\nb').text, 'a\nb');
  eq('runs of blank lines collapse', dmPreview('a\n\n\n\n\nb').text, 'a\n\nb');
  const m = { body: 'i still think about it', id: 'a'.repeat(16), view_token: 'b'.repeat(32) };
  const LINK = 'https://beatass.com/m?id=x&t=y';
  const t = dmText(m, LINK);
  eq('the words are in the DM', t.includes('"i still think about it"'), true);
  eq('the link is in the DM', t.includes(LINK), true);
  eq('the reply route is the page', t.includes('reply to them'), true);
  eq('the opt-out line survives', t.includes('block us so we never message you again'), true);
  eq('a clipped DM says so', dmText({ body: long }, 'L').includes('read the rest'), true);
  eq('an empty body still sends a link', dmText({ body: '' }, 'L').includes('L'), true);

  /* The split is the whole point (Sanjay: the confession was "buttered with
     the admin message"). Bubble 2 must be their words and NOTHING else - if a
     greeting, a link, or the opt-out line ever creeps back into it, these go
     red. */
  const p = dmParts(m, LINK);
  eq('a normal DM is three messages', p.length, 3);
  eq('bubble 2 is only their words', p[1], '"i still think about it"');
  eq('bubble 2 has no link', p[1].includes('beatass.com'), false);
  eq('bubble 2 has no greeting', /hey /.test(p[1]), false);
  eq('bubble 2 has no legal footer', p[1].includes('automated'), false);
  eq('bubble 1 introduces it', p[0].includes('anonymous message'), true);
  eq('bubble 1 carries no link', p[0].includes(LINK), false);
  eq('bubble 3 carries the link', p[2].includes(LINK), true);
  eq('bubble 3 carries the opt-out', p[2].includes('block us so we never message you again'), true);
  eq('an empty body drops the quote bubble', dmParts({ body: '' }, 'L').length, 2);
  eq('a clipped body still splits in three', dmParts({ body: long }, 'L').length, 3);
  eq('every bubble fits an Instagram DM', p.every((x) => x.length <= 900), true);
  eq('no bubble is empty', p.every((x) => x.trim().length > 0), true);

  console.log(process.exitCode ? '\ndm selftest FAILED' : `dm selftest: ${checks}/${checks} pass`);
  process.exit(process.exitCode || 0);
}

/* ---------- --text <id>: exactly what the DM will say. No browser. ---------- */
if (TEXT_ID) {
  const m = loadOne(TEXT_ID);
  const parts = dmParts(m, linkFor(m));
  say(`\nmessage ${m.id} -> @${m.to_handle} (for "${m.to_name}")`);
  say(`it arrives as ${parts.length} separate Instagram messages:\n`);
  showParts(parts);
  process.exit(0);
}

/* ---------- the browser walk (selectors captured live, G27) ---------- */

function launch(headless) {
  return chromium.launchPersistentContext(SESSION, {
    headless, viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
}


export async function ensureRightAccount(page) {
  /* One implementation, in ig-dm.mjs, shared with the outreach tool and the
     health check. It now REFUSES when it cannot tell who we are, where this
     used to carry on regardless. */
  try { return await ensureAccount(page, CONFIG.handle); }
  catch (e) { die(e.message); }
}



/**
 * Open the thread and deliver the DM as separate bubbles.
 *
 * The one thing that keeps a dry run dry: the ONLY thing in here that sends is
 * the Send button, it is behind `if (dry) ... continue`, and nothing ever
 * presses a bare Enter (typeDm uses Shift+Enter). A dry run types each bubble,
 * photographs it, wipes the box, and moves on - so it can rehearse a
 * three-message send without one of them leaving.
 *
 * Returns how many bubbles actually went out.
 */
/**
 * Press Send until the bubble PROVABLY leaves, or give up loudly.
 *
 * The proof is the box emptying: Instagram clears the composer when a message
 * goes. That also catches the sneaky case where click() times out but the click
 * actually registered - checking the box instead of trusting the click is what
 * makes the count honest. Born from Harsh's DM (2026-08-05): one Send click
 * timed out, bubble 1 of 3 was all he ever got, and the confession and link
 * never arrived.
 *
 * Three clicks, then one plain Enter (which sends in Instagram's composer -
 * typeDm avoids it with Shift+Enter for exactly that reason), then failure.
 */
async function sendBubble(page) {
  const box = page.locator('div[role="textbox"][contenteditable="true"]').first();
  const send = page.locator('div[role="button"][aria-label="Send"]').first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await send.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!(await box.innerText().catch(() => 'x')).trim()) return;
    if (attempt < 3) await page.waitForTimeout(2500);
  }
  await box.click();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  if (!(await box.innerText().catch(() => 'x')).trim()) return;
  throw new Error('the bubble would not send: 3 Send clicks + Enter and the box still holds the text');
}

async function deliver(page, m, dry, startAt = 0) {
  await openThread(page, m.to_handle);
  const parts = dmParts(m, linkFor(m));
  let out = startAt;                       // absolute count: bubbles 0..startAt-1 went in an earlier run
  for (let i = startAt; i < parts.length; i++) {
    await typeDm(page, parts[i]);
    if (dry) {
      await page.screenshot({ path: path.join(HERE, `dm-dry-run-${i + 1}.png`) });
      await clearBox(page);
      continue;
    }
    try {
      await sendBubble(page);
    } catch (e) {
      /* Half-delivered. Whoever catches this must record the partial count, so
         a resume starts at the right bubble instead of repeating what landed. */
      e.partsSent = out;
      throw e;
    }
    out++;
    evt('bubble-sent', { id: m.id, handle: m.to_handle, bubble: i + 1, of: parts.length });
    /* Bubbles land a beat apart, the way a person types them - three in the
       same second is a spam signature. */
    if (i < parts.length - 1) await page.waitForTimeout(1800 + Math.floor(Math.random() * 1600));
  }
  if (!dry) {
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(HERE, 'dm-sent.png') });
  }
  return out;
}

/* ---------- --block: honour a STOP forever ---------- */

if (BLOCK_HANDLE) {
  const h = BLOCK_HANDLE.toLowerCase().replace(/^@+/, '');
  if (!/^[a-z0-9._]{1,30}$/.test(h)) die('that does not look like an Instagram handle.');
  d1(`INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (${sq('ig:' + h)}, ${Math.floor(Date.now() / 1000)})`);
  say(`@${h} is blocked forever. They will never hear from beatass again.`);
  process.exit(0);
}

/* ---------- --auto: work the whole queue, unattended ---------- */

if (AUTO) {
  const { rows, sent } = pending();
  if (!rows.length) { say(`auto: nothing waiting${LOCAL ? ' (local db)' : ''}.`); process.exit(0); }
  let done = sentToday(sent);
  say(`auto${DRY ? ' (dry)' : ''}: ${rows.length} waiting, ${done}/${DAILY_CAP} sent today.`);

  const browser = await launch(!DRY);           // headless for real runs; visible for a dry check
  const page = browser.pages()[0] || await browser.newPage();
  try {
    await ensureRightAccount(page);
    for (const r of rows) {
      if (!DRY && done >= DAILY_CAP) { say(`auto: daily cap of ${DAILY_CAP} reached. Stopping.`); break; }
      if (isBlocked(r.to_handle)) { say(`  skip @${r.to_handle}: blocked.`); evt('skip-blocked', { id: r.id, handle: r.to_handle }); continue; }
      const st = entryState(sent[r.id]);
      say(`  ${DRY ? 'walk' : st.kind === 'resume' ? `resume at bubble ${st.startAt + 1}` : 'send'} -> @${r.to_handle} for "${r.to_name}" [${r.id}]`);
      evt('attempt', { id: r.id, handle: r.to_handle, startAt: st.startAt, dry: DRY });
      let landed = st.startAt;               // bubbles that are out, from this run or an earlier one
      try {
        landed = await deliver(page, r, DRY, st.startAt);
        if (!DRY) { recordSent(sent, r.id); done++; }
        evt('delivered', { id: r.id, handle: r.to_handle, bubbles: 3, dry: DRY });
      } catch (e) {
        const line = e.message.split('\n')[0];
        if (!DRY) {
          /* Any real-run failure is recorded as an ATTEMPT, never as sent, so
             entryState resumes the bubbles that landed and - crucially - GIVES UP
             after MAX_TRIES instead of retrying forever. Two shapes land here:
               - half-delivered (some bubbles out): partsSent > 0, resume the rest;
               - failed before a single bubble (bad handle, thread won't open):
                 partsSent is undefined -> treat as 0.
             The wrong-handle case used to fall through recording NOTHING, so a
             non-existent @handle relaunched a browser every couple of minutes
             for good (found live: 454 attempts on one bad handle). If a give-up
             was really a transient blip, `node tools/status.mjs retry <id>`
             clears the state and the next run tries again. */
          const outNow = e.partsSent || 0;
          landed = outNow;
          const entry = recordPartial(sent, r.id, outNow, line);
          if (outNow > st.startAt) done++;
          const gaveUp = entry.attempts >= MAX_TRIES;
          const what = outNow > 0 ? `${outNow} of 3 bubbles out` : 'failed before any bubble';
          say(`    ${gaveUp ? 'GIVING UP' : 'will retry'} [${r.id}]: ${what} (try ${entry.attempts} of ${MAX_TRIES}): ${line}`);
          evt(gaveUp ? 'gave-up' : (outNow > 0 ? 'partial' : 'retry'), { id: r.id, handle: r.to_handle, bubbles: outNow, attempts: entry.attempts, error: line });
        } else {
          say(`    walk skipped [${r.id}]: ${line}`);
          evt('skip', { id: r.id, handle: r.to_handle, error: line });
        }
        await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
      }
      /* Outreach - follow them, comment on their latest post - runs when ANY
         bubble landed: bubble 1 already says a message is waiting, and that is
         true. In its OWN try, because Harsh's run proved the old shape wrong: a
         thrown send skipped outreach silently, so a half-DM'd person was never
         followed and never commented. outreach.mjs keeps its own per-handle
         record, so a resume can never double-comment. */
      if (DRY || landed > 0) {
        await page.waitForTimeout(6000 + Math.floor(Math.random() * 9000));
        try {
          const o = await runOutreach(page, r.to_handle, { dry: DRY, say });
          evt('outreach', { handle: r.to_handle, result: o });
        } catch (e) {
          say(`    outreach failed for @${r.to_handle}: ${e.message.split('\n')[0]}`);
          evt('outreach-failed', { handle: r.to_handle, error: e.message.split('\n')[0] });
          await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
        }
      }
      if (!DRY) {
        const pause = 25000 + Math.floor(Math.random() * 50000);   // 25-75s, no bursts
        say(`    done. pausing ${Math.round(pause / 1000)}s.`);
        await page.waitForTimeout(pause);
      }
    }
    say(DRY ? 'auto dry run done - nothing was sent.' : `auto done - ${done} sent today.`);
  } catch (err) {
    await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
    console.error('\n✗ ' + err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  process.exit(process.exitCode || 0);
}

/* ---------- list mode: what is waiting + the exact command per message ---------- */

if (!DRY_ID && !SEND_ID) {
  const { rows } = pending();
  if (!rows.length) { say('nothing waiting - every Instagram message has been notified (or none exist).'); process.exit(0); }
  say(`${rows.length} message(s) waiting for an Instagram notification:\n`);
  for (const r of rows) {
    const age = Math.round((Date.now() / 1000 - r.created_at) / 3600);
    say(`  ${r.id}  @${r.to_handle}  for "${r.to_name}"  (${age}h ago)`);
  }
  say('\nsend them all:  node tools/instagram/notify.mjs --auto');
  process.exit(0);
}

/* ---------- single message: --dry-run <id> or --send <id> ---------- */

const id = DRY_ID || SEND_ID;
const m = loadOne(id);
const sent = loadSent();
const st0 = entryState(sent[m.id]);
if (SEND_ID && st0.kind === 'done') die(`message ${m.id} was already sent to @${m.to_handle} on ${sent[m.id]}. Not sending twice.`);
if (SEND_ID && st0.kind === 'gaveup') die(`message ${m.id} failed ${MAX_TRIES} times and was given up. Delete its entry from .notified.json to force one more try.`);
if (SEND_ID && st0.kind === 'resume') say(`(resuming: ${st0.startAt} of 3 bubbles already went out - starting at bubble ${st0.startAt + 1})`);

const parts = dmParts(m, linkFor(m));
say(`\nmessage ${m.id} -> @${m.to_handle} (for "${m.to_name}")`);
say(`it arrives as ${parts.length} separate Instagram messages:\n`);
showParts(parts);

const browser = await launch(CONFIG.headless === true);
const page = browser.pages()[0] || await browser.newPage();
try {
  await ensureRightAccount(page);
  const out = await deliver(page, m, !!DRY_ID, st0.startAt);
  if (DRY_ID) {
    say(`- dry run: all ${parts.length} messages were typed and the Send button was NOT pressed.`);
    say(`  what each one would have looked like: tools/instagram/dm-dry-run-1..${parts.length}.png`);
  } else {
    recordSent(sent, m.id);
    say(`✓ sent ${out} messages. @${m.to_handle} has the words and the link. Screenshot: tools/instagram/dm-sent.png`);
  }

  /* Now the part that makes them notice it. Same dry flag all the way down. */
  await page.waitForTimeout(6000);
  await runOutreach(page, m.to_handle, { dry: !!DRY_ID, say });
  if (DRY_ID) say('\ndry run over: nothing was sent, nobody was followed, no comment was posted.');
} catch (err) {
  if (err.partsSent !== undefined) {
    const entry = recordPartial(sent, m.id, err.partsSent, err.message.split('\n')[0]);
    say(`! PARTIAL: ${err.partsSent} of ${parts.length} messages reached @${m.to_handle} before this failed.`);
    say(`  Recorded as a partial (try ${entry.attempts} of ${MAX_TRIES}) - the next run resumes at bubble ${err.partsSent + 1}, never repeating what landed.`);
  }
  await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
  console.error('\n✗ ' + err.message);
  console.error('  screenshot of what it was looking at: tools/instagram/last-failure.png');
  process.exitCode = 1;
} finally {
  await browser.close();
}
