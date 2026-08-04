/**
 * Tells a confession's recipient on WhatsApp that a message is waiting for
 * them, from our own business account. It arrives as three separate messages -
 * a one-line intro, then their confession alone in its own bubble, then the
 * link plus the automated/opt-out notice. The link goes to the /m page: the
 * full message, the doll clip, block, report, and the only reply box.
 *
 *   node tools/whatsapp/notify.mjs                     list what is waiting
 *   node tools/whatsapp/notify.mjs --selftest          check the wording, no database, no browser
 *   node tools/whatsapp/notify.mjs --text <id>         print all three messages, no browser
 *   node tools/whatsapp/notify.mjs --dry-run <id>      walk one message, screenshot, send NOTHING
 *   node tools/whatsapp/notify.mjs --send <id>         send one
 *   node tools/whatsapp/notify.mjs --auto              send every waiting one, unattended
 *   node tools/whatsapp/notify.mjs --auto --dry        walk every waiting one, send NOTHING
 *   node tools/whatsapp/notify.mjs --block <number>    honour a STOP: never message them again
 *
 * --auto is the hands-off mode that the launchd job (com.beatass.whatsapp) runs
 * on a one-minute timer. Its safety rails, because nobody is watching:
 *   - only messages that have a number AND a stored view link,
 *   - the wa:<number> block list is re-checked immediately before each send,
 *   - a number WhatsApp does not recognise is skipped, never counted as sent,
 *   - a message is never sent twice (.wa-notified.json),
 *   - at most DAILY_CAP sends per calendar day,
 *   - a random pause between sends so it never bursts,
 *   - one bad message is skipped (screenshot saved), the rest still go.
 *
 * An empty queue never opens a browser: it costs one database query and exits,
 * which is what makes a one-minute timer cheap.
 *
 * A --local flag reads the local dev database instead of production.
 *
 * The browser half lives in wa-send.mjs and is loaded only when something is
 * actually being sent, so --selftest and --text work with no browser at all.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { logEvent } from '../events.mjs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));

/* The session and everything that names a real person live outside the repo.
   The repo is public; a saved login is a credential and a phone number is
   somebody's pocket. */
const SESSION = path.join(os.homedir(), '.config', 'beatass-whatsapp');
const CONFIG_FILE = path.join(SESSION, 'config.json');
const SENT_LOG = path.join(SESSION, '.wa-notified.json');

const SITE = 'https://beatass.com';
const DAILY_CAP = 30;            // most unattended sends in one calendar day
/* How many times a number that WhatsApp rejects is retried before we stop.
   Learned the hard way on 2026-08-05: an undeliverable message was deliberately
   never marked as sent (nothing was delivered, so saying "sent" would be a lie),
   but with a 60-second timer that turned into a browser window opening every
   minute, forever, for one wrong number. A few retries are worth it - WhatsApp
   can answer slowly and a person can join later - unbounded retries are not. */
const MAX_TRIES = 3;
const evt = (step, extra) => logEvent('whatsapp', { lane: 'wa', step, ...extra });

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const AUTO = args.includes('--auto');
/* Sanjay, 2026-08-04: leave the window up. Handy while we are still watching
   runs by eye - an unattended run should NOT use it, or windows pile up. */
const KEEP_OPEN = args.includes('--keep-open');
const DRY = args.includes('--dry');            // pairs with --auto: walk, never send
const flagVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY_ID = flagVal('--dry-run');
const SEND_ID = flagVal('--send');
const TEXT_ID = flagVal('--text');
const BLOCK_NUM = flagVal('--block');

const say = (m) => console.log(m);
const die = (m) => { console.error('\n✗ ' + m + '\n'); process.exit(1); };

/* Enough of a number to recognise in a log, not enough to be a leak. */
const mask = (n) => String(n || '').replace(/^(\+91)(\d{2})\d{4}(\d{4})$/, '$1$2****$3');

/** Third copy of the same rule, and deliberately so: the browser tells the
 *  sender early, the Worker decides what gets stored, and this one is for
 *  --block, which has to reach the same stored shape from something typed on a
 *  command line. Keep all three in step (src/index.js waNumber, template.html
 *  waNumber, here). */
function waNumber(raw) {
  let d = String(raw || '').replace(/\D+/g, '').replace(/^0+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  return /^[6-9]\d{9}$/.test(d) ? '+91' + d : '';
}

/* ---------- what the messages say ---------- */

const linkFor = (m) => `${SITE}/m?id=${m.id}&t=${m.view_token}`;

/* Clipped even though WhatsApp would carry the whole thing: the clip IS the
   hook, and the rest of it, the doll clip and the only reply box all live on
   the page. Same budget as the Instagram DM so both channels read alike. */
const PREVIEW = 280;

export function waPreview(body) {
  const clean = String(body || '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= PREVIEW) return { text: clean, clipped: false };
  const cut = clean.slice(0, PREVIEW);
  const space = cut.lastIndexOf(' ');
  /* break on a word if there is one near the end, else mid-word rather than
     throwing away half the preview to a very long unbroken string */
  return { text: (space > PREVIEW - 60 ? cut.slice(0, space) : cut).trimEnd() + '...', clipped: true };
}

/* Three messages, not one, for the reason Sanjay gave on 2026-08-03: a single
   blob buries the confession between a greeting and a legal footer. Sent
   separately, the middle one is nothing but their words - the only part a
   stranger actually cares about.
   Emoji and *bold* added 2026-08-05, Sanjay's call: the plain version arrived
   on a phone as a wall of grey text and "the user never sees these details".
   This is a deliberate exception to the project's no-emoji house rule, which
   exists for the hand-drawn website - a WhatsApp message is a different medium
   and reads as ignorable without them.
   The middle bubble stays UNformatted on purpose: it carries somebody's own
   words, and an asterisk or an underscore inside a confession would collide
   with WhatsApp's formatting and mangle their sentence. */
export const waParts = (m, link) => {
  const p = waPreview(m.body);
  const parts = [];
  if (p.text) {
    parts.push('📩 *someone just left you an anonymous message on beatass.com*\n\nthis is what they wrote 👇');
    parts.push('"' + p.text + '"');
  } else {
    parts.push('📩 *someone just left you an anonymous message on beatass.com*');
  }
  parts.push(
    '👉 *tap here to read ' + (p.clipped ? 'the rest of it' : 'it all') +
    ', see what they did to the doll, and reply to them:*\n' + link + '\n\n' +
    '⚠️ *this is an automated message from beatass.com.* we only deliver messages - ' +
    'we did not write this one, and we never share your number.\n\n' +
    '🛑 *do not want these?* open the same link and tap *block* - one tap and we can ' +
    'never message you again. you can *report* it from there too.');
  return parts;
};

/** The whole thing as one block, for printing and reading. Never typed. */
export const waText = (m, link) => waParts(m, link).join('\n\n');

function showParts(parts) {
  parts.forEach((p, i) => {
    say(`  message ${i + 1} of ${parts.length}:`);
    say(p.split('\n').map((l) => '    | ' + l).join('\n') + '\n');
  });
}

/* --selftest proves the wording and the number rule before anything is
   composed: no database, no browser, nothing outward. Runs in CI. */
if (args.includes('--selftest')) {
  let fails = 0, checks = 0;
  const eq = (label, got, want) => {
    checks++;
    if (got !== want) { fails++; console.error(`✗ ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); }
  };

  /* the number rule - the three copies of this must agree or a block silently
     stops matching the number it was meant to stop */
  eq('a plain ten-digit number', waNumber('9876543210'), '+919876543210');
  eq('spaces are ignored', waNumber('98765 43210'), '+919876543210');
  eq('dashes are ignored', waNumber('98765-43210'), '+919876543210');
  eq('a trunk zero is dropped', waNumber('09876543210'), '+919876543210');
  eq('a typed country code is dropped', waNumber('919876543210'), '+919876543210');
  eq('a full international number', waNumber('+91 98765 43210'), '+919876543210');
  eq('a 00 prefix', waNumber('00919876543210'), '+919876543210');
  eq('an already-stored number survives a round trip', waNumber('+919876543210'), '+919876543210');
  eq('a landline-style 5 is refused', waNumber('5876543210'), '');
  eq('too few digits is refused', waNumber('98765'), '');
  eq('too many digits is refused', waNumber('98765432109876'), '');
  eq('a non-Indian number is refused', waNumber('+1 415 555 2671'), '');
  eq('empty is refused', waNumber(''), '');
  eq('null is refused', waNumber(null), '');
  eq('letters are refused', waNumber('call me maybe'), '');

  /* the masking used in every log line - a log that names people is a leak */
  eq('a number is masked in logs', mask('+919876543210'), '+9198****3210');
  eq('masking leaves nothing else alone', mask(''), '');

  /* the retry rule - born from a real 60-second loop on 2026-08-05 */
  eq('a message never tried is waiting', stillWaiting(undefined), true);
  eq('a delivered message is never sent again', stillWaiting('2026-08-05T01:25:00.000Z'), false);
  eq('one failed try is still waiting', stillWaiting({ attempts: 1 }), true);
  eq('two failed tries are still waiting', stillWaiting({ attempts: 2 }), true);
  eq('three failed tries is the end of it', stillWaiting({ attempts: 3 }), false);
  eq('more than three is still the end', stillWaiting({ attempts: 9 }), false);
  eq('a malformed entry does not loop forever', stillWaiting({}, 0), false);

  const long = 'x'.repeat(400);
  eq('short body is quoted whole', waPreview('you never called back').text, 'you never called back');
  eq('short body is not clipped', waPreview('hi').clipped, false);
  eq('long body is clipped', waPreview(long).clipped, true);
  eq('clip stays within budget', waPreview(long).text.length <= PREVIEW + 3, true);
  eq('clip ends with the marker', waPreview(long).text.endsWith('...'), true);
  eq('clip breaks on a word', waPreview(('word '.repeat(80)).trim()).text.endsWith('word...'), true);
  eq('empty body survives', waPreview('').text, '');
  eq('null body survives', waPreview(null).text, '');
  eq('carriage returns normalise', waPreview('a\r\nb').text, 'a\nb');
  eq('runs of blank lines collapse', waPreview('a\n\n\n\n\nb').text, 'a\n\nb');

  const m = { body: 'i still think about it', id: 'a'.repeat(16), view_token: 'b'.repeat(32) };
  const LINK = 'https://beatass.com/m?id=x&t=y';
  const t = waText(m, LINK);
  eq('the words are in the message', t.includes('"i still think about it"'), true);
  eq('the link is in the message', t.includes(LINK), true);
  eq('the reply route is the page', t.includes('reply to them'), true);
  eq('it admits it is automated', t.includes('automated message from beatass.com'), true);
  eq('the opt-out line survives', t.includes('never message you again'), true);
  eq('it offers a block in so many words', t.includes('tap *block*'), true);
  eq('it offers a report', t.includes('*report*'), true);
  eq('a clipped one says so', waText({ body: long }, 'L').includes('read the rest'), true);
  eq('an empty body still sends a link', waText({ body: '' }, 'L').includes('L'), true);

  /* The split is the whole point. Bubble 2 must be their words and NOTHING
     else - if a greeting, a link, or the legal footer ever creeps back into
     it, these go red. */
  const p = waParts(m, LINK);
  eq('a normal one is three messages', p.length, 3);
  eq('bubble 2 is only their words', p[1], '"i still think about it"');
  eq('bubble 2 has no link', p[1].includes('beatass.com'), false);
  eq('bubble 2 has no greeting', /hey /.test(p[1]), false);
  eq('bubble 2 has no legal footer', p[1].includes('automated'), false);
  eq('bubble 1 introduces it', p[0].includes('anonymous message'), true);
  eq('bubble 1 carries no link', p[0].includes(LINK), false);
  eq('bubble 3 carries the link', p[2].includes(LINK), true);
  eq('bubble 3 carries the opt-out', p[2].includes('never message you again'), true);

  /* The formatting Sanjay asked for on 2026-08-05, checked so a later tidy-up
     cannot quietly flatten the messages back into grey text. */
  eq('bubble 1 leads with an emoji', /^\u{1F4E9}/u.test(p[0]), true);
  eq('bubble 1 bolds the headline', p[0].includes('*someone just left you an anonymous message on beatass.com*'), true);
  eq('bubble 3 bolds the call to action', /\u{1F449} \*tap here to read/u.test(p[2]), true);
  eq('bubble 3 flags itself with a warning sign', p[2].includes('\u26A0'), true);
  eq('bubble 3 marks the opt-out with a stop sign', p[2].includes('\u{1F6D1}'), true);
  /* Their words must stay clean: no bold markers, because an asterisk inside
     somebody's confession would collide with WhatsApp's formatting. */
  eq('bubble 2 carries no formatting of ours', p[1].includes('*'), false);
  eq('bubble 2 carries no emoji of ours', /\u{1F4E9}|\u{1F449}|\u{1F6D1}/u.test(p[1]), false);
  eq('an empty body drops the quote bubble', waParts({ body: '' }, 'L').length, 2);
  eq('a clipped body still splits in three', waParts({ body: long }, 'L').length, 3);
  eq('no bubble is empty', p.every((x) => x.trim().length > 0), true);

  console.log(fails ? `\nwhatsapp selftest FAILED (${fails} of ${checks})`
    : `whatsapp selftest: ${checks}/${checks} pass`);
  process.exit(fails ? 1 : 0);
}

/* ---------- the database, through wrangler (no secrets touched) ---------- */

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'beatass-db',
    LOCAL ? '--local' : '--remote', '--json', '--command', sql],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) die('database query failed:\n' + (r.stderr || r.stdout || '').slice(-800));
  try { return JSON.parse(r.stdout)[0].results; }
  catch { die('could not read the database answer:\n' + (r.stdout || '').slice(-400)); }
}

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";  // SQL string literal

function loadSent() {
  return fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')) : {};
}
/* Message ids only, never a number: this file is a record of what went out,
   not a contact list. */
function recordSent(sent, id) {
  sent[id] = new Date().toISOString();
  fs.mkdirSync(path.dirname(SENT_LOG), { recursive: true });
  fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2));
}
/**
 * Is this message still waiting to go out?
 *
 * The log holds one of three things per message id:
 *   nothing            never attempted        -> waiting
 *   a date string      delivered              -> done, never again
 *   {attempts, ...}    tried and failed       -> waiting until MAX_TRIES is used up
 *
 * Pure on purpose, so the selftest can prove the retry rule without a database.
 */
export function stillWaiting(entry, maxTries = MAX_TRIES) {
  if (!entry) return true;
  if (typeof entry === 'string') return false;
  return (entry.attempts || 0) < maxTries;
}

/**
 * The log's key for a NUMBER rather than a message.
 *
 * Hashed, so the file stays a record of what happened and never becomes a list
 * of real phone numbers sitting on the disk. We only ever need to ask "have we
 * already proved this one is dead?", and a hash answers that perfectly well.
 *
 * Why by number at all: a wrong number gets typed into the site more than once
 * (it did, within the hour, on 2026-08-05). Remembering only the message would
 * make every fresh confession to the same dead number cost another three
 * browser windows.
 */
const deadKey = (num) => 'num:' + crypto.createHash('sha256').update(String(num)).digest('hex').slice(0, 16);

/** Record a failed attempt. Never records a delivery - nothing was delivered. */
function recordFailure(sent, id, reason) {
  const prev = (sent[id] && typeof sent[id] === 'object') ? sent[id] : { attempts: 0 };
  const entry = { attempts: (prev.attempts || 0) + 1, reason, last: new Date().toISOString() };
  sent[id] = entry;
  fs.mkdirSync(path.dirname(SENT_LOG), { recursive: true });
  fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2));
  return entry;
}

function sentToday(sent) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.values(sent).filter((v) => typeof v === 'string' && v.slice(0, 10) === today).length;
}
function isBlocked(num) {
  return d1(`SELECT 1 AS x FROM blocklist WHERE email = ${sq('wa:' + num)}`).length > 0;
}

/** Waiting = has a number, has a minted link, they have not blocked us, and we
 *  have not already sent it. */
function pending() {
  const sent = loadSent();
  const rows = d1(
    "SELECT m.id, m.to_name, m.to_whatsapp, m.view_token, m.body, m.created_at FROM messages m " +
    "WHERE m.to_whatsapp IS NOT NULL AND m.view_token IS NOT NULL " +
    "AND NOT EXISTS (SELECT 1 FROM blocklist b WHERE b.email = 'wa:' || m.to_whatsapp) " +
    "ORDER BY m.created_at"
  );
  return {
    rows: rows.filter((r) => stillWaiting(sent[r.id]) && stillWaiting(sent[deadKey(r.to_whatsapp)])),
    sent
  };
}

function loadOne(id) {
  if (!/^[a-f0-9]{16}$/.test(id || '')) die('that does not look like a message id (16 hex chars).');
  const rows = d1(`SELECT id, to_name, to_whatsapp, view_token, body FROM messages WHERE id = ${sq(id)}`);
  if (!rows.length) die(`no message ${id} in the ${LOCAL ? 'local' : 'live'} database.`);
  const m = rows[0];
  if (!m.to_whatsapp) die(`message ${id} has no WhatsApp number - it went by another channel.`);
  if (!m.view_token) die(`message ${id} has no view link stored.`);
  if (isBlocked(m.to_whatsapp)) die(`${mask(m.to_whatsapp)} has blocked beatass. We honour that. Not sending.`);
  return m;
}

/* ---------- --block: honour a STOP forever ---------- */

if (BLOCK_NUM) {
  const num = waNumber(BLOCK_NUM);
  if (!num) die('that does not look like an Indian mobile number.');
  d1(`INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (${sq('wa:' + num)}, ${Math.floor(Date.now() / 1000)})`);
  say(`${mask(num)} is blocked forever. They will never hear from beatass again.`);
  process.exit(0);
}

/* ---------- --text <id>: exactly what will be sent. No browser. ---------- */

if (TEXT_ID) {
  const m = loadOne(TEXT_ID);
  const parts = waParts(m, linkFor(m));
  say(`\nmessage ${m.id} -> ${mask(m.to_whatsapp)} (for "${m.to_name}")`);
  say(`it arrives as ${parts.length} separate WhatsApp messages:\n`);
  showParts(parts);
  process.exit(0);
}

/* ---------- list mode: what is waiting ---------- */

if (!DRY_ID && !SEND_ID && !AUTO) {
  const { rows } = pending();
  if (!rows.length) { say('nothing waiting - every WhatsApp message has been sent (or none exist).'); process.exit(0); }
  say(`${rows.length} message(s) waiting for a WhatsApp send:\n`);
  for (const r of rows) {
    const age = Math.round((Date.now() / 1000 - r.created_at) / 3600);
    say(`  ${r.id}  ${mask(r.to_whatsapp)}  for "${r.to_name}"  (${age}h ago)`);
  }
  say('\nsee one without sending:  node tools/whatsapp/notify.mjs --text <id>');
  say('send them all:            node tools/whatsapp/notify.mjs --auto');
  process.exit(0);
}

/* ---------- anything past here needs the browser ---------- */

/* Loaded late and on purpose: the selectors in wa-send.mjs were captured from
   the live page, and everything above this line works without them. */
let wa;
try {
  wa = await import('./wa-send.mjs');
} catch (e) {
  die('the browser half (tools/whatsapp/wa-send.mjs) is missing or broken:\n  ' +
      String(e.message).split('\n')[0]);
}

const cfg = fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {};
const account = cfg.account || '';
/* The name is what the account guard can actually check: WhatsApp Web prints
   the profile name on the Settings panel and the phone number nowhere at all. */
const accountName = cfg.name || '';
if (!waNumber(account) || !accountName)
  die(`the sending account is not set up. Put both of these in\n  ${CONFIG_FILE}\n` +
      `  like this:  {"account":"+91XXXXXXXXXX","name":"Exactly The Profile Name"}`);

/**
 * Open the chat and deliver the messages as separate bubbles.
 *
 * The one thing that keeps a dry run dry: the ONLY thing in here that sends is
 * wa.pressSend, it is behind `if (dry) ... continue`, and nothing ever presses
 * a bare Enter. A dry run types each bubble, photographs it, wipes the box, and
 * moves on - so it can rehearse a three-message send without one of them
 * leaving.
 *
 * Returns how many bubbles actually went out.
 */
async function deliver(page, m, dry) {
  const opened = await wa.openChat(page, m.to_whatsapp);
  if (opened === 'not-on-whatsapp') {
    const e = new Error('that number is not on WhatsApp');
    e.undeliverable = true;
    throw e;
  }
  const parts = waParts(m, linkFor(m));
  let out = 0;
  for (let i = 0; i < parts.length; i++) {
    await wa.typeMessage(page, parts[i]);
    if (dry) {
      await page.screenshot({ path: path.join(HERE, `dry-run-${i + 1}.png`) });
      await wa.clearBox(page);
      continue;
    }
    try {
      await wa.pressSend(page);
    } catch (e) {
      /* Half-delivered. Whoever catches this must still mark the message as
         sent, or a retry re-sends the bubbles that already landed. */
      e.partsSent = out;
      throw e;
    }
    out++;
    /* Bubbles land a beat apart, the way a person types them - three in the
       same second is a spam signature. */
    if (i < parts.length - 1) await page.waitForTimeout(1800 + Math.floor(Math.random() * 1600));
  }
  if (!dry) {
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(HERE, 'sent.png') });
  }
  return out;
}

/* ---------- --auto: work the whole queue, unattended ---------- */

if (AUTO) {
  const { rows, sent } = pending();
  if (!rows.length) { say(`auto: nothing waiting${LOCAL ? ' (local db)' : ''}.`); process.exit(0); }
  let done = sentToday(sent);
  say(`auto${DRY ? ' (dry)' : ''}: ${rows.length} waiting, ${done}/${DAILY_CAP} sent today.`);

  /* Visible, even unattended. Headless was tried twice on 2026-08-04 with
     nothing else holding the session folder, and WhatsApp Web would not restore
     the login either time ("not signed in") - so a headless timer would fail
     every minute in silence. A window appearing is the price of it working, and
     an empty queue never gets this far, so the window only shows up when a
     message is genuinely going out. */
  const browser = await wa.launch(SESSION, false);
  const page = browser.pages()[0] || await browser.newPage();
  try {
    await wa.ensureAccount(page, { account, name: accountName });
    for (const r of rows) {
      if (!DRY && done >= DAILY_CAP) { say(`auto: daily cap of ${DAILY_CAP} reached. Stopping.`); break; }
      if (isBlocked(r.to_whatsapp)) { say(`  skip ${mask(r.to_whatsapp)}: blocked.`); continue; }
      say(`  ${DRY ? 'walk' : 'send'} -> ${mask(r.to_whatsapp)} for "${r.to_name}" [${r.id}]`);
      evt('attempt', { id: r.id, to: mask(r.to_whatsapp), dry: DRY });
      try {
        await deliver(page, r, DRY);
        if (!DRY) {
          recordSent(sent, r.id);
          evt('delivered', { id: r.id, to: mask(r.to_whatsapp), bubbles: 3 });
          done++;
          const pause = 25000 + Math.floor(Math.random() * 50000);   // 25-75s, no bursts
          say(`    done. pausing ${Math.round(pause / 1000)}s.`);
          await page.waitForTimeout(pause);
        }
      } catch (e) {
        if (e.partsSent) {
          /* Some bubbles landed. Record it anyway - a retry would repeat them. */
          recordSent(sent, r.id);
          done++;
          say(`    PARTIAL [${r.id}]: ${e.partsSent} of 3 sent, then: ${e.message.split('\n')[0]}`);
          evt('partial', { id: r.id, to: mask(r.to_whatsapp), bubbles: e.partsSent, error: e.message.split('\n')[0] });
        } else if (e.undeliverable) {
          /* Still not recorded as SENT - nothing was delivered, and the log must
             never claim otherwise. Recorded as a failed ATTEMPT instead, so the
             same wrong number cannot be retried every minute until the end of
             time. After MAX_TRIES it drops out of the queue for good. */
          const at = recordFailure(sent, r.id, 'not-on-whatsapp');
          /* and against the number, so the NEXT message to it is skipped
             without opening a browser at all */
          recordFailure(sent, deadKey(r.to_whatsapp), 'not-on-whatsapp');
          evt(at.attempts >= MAX_TRIES ? 'gave-up' : 'undeliverable', { id: r.id, to: mask(r.to_whatsapp), attempts: at.attempts });
          say(at.attempts >= MAX_TRIES
            ? `    undeliverable [${r.id}]: ${e.message}. Giving up after ${at.attempts} tries - it will not be retried.`
            : `    undeliverable [${r.id}]: ${e.message}. Try ${at.attempts} of ${MAX_TRIES}.`);
        } else {
          say(`    skipped [${r.id}]: ${e.message.split('\n')[0]}`);
          evt('skip', { id: r.id, to: mask(r.to_whatsapp), error: e.message.split('\n')[0] });
        }
        await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
      }
    }
    say(DRY ? 'auto dry run done - nothing was sent.' : `auto done - ${done} sent today.`);
  } catch (err) {
    await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
    console.error('\n✗ ' + err.message);
    process.exitCode = 1;
  } finally {
    if (!KEEP_OPEN) await browser.close();
    else say('  (window left open - close it yourself when you are done)');
  }
  process.exit(process.exitCode || 0);
}

/* ---------- single message: --dry-run <id> or --send <id> ---------- */

const id = DRY_ID || SEND_ID;
const m = loadOne(id);
const sent = loadSent();
if (SEND_ID && sent[m.id]) die(`message ${m.id} already went to ${mask(m.to_whatsapp)} on ${sent[m.id]}. Not sending twice.`);

const parts = waParts(m, linkFor(m));
say(`\nmessage ${m.id} -> ${mask(m.to_whatsapp)} (for "${m.to_name}")`);
say(`it arrives as ${parts.length} separate WhatsApp messages:\n`);
showParts(parts);

const browser = await wa.launch(SESSION, false);   // visible: one message at a time is a watched run
const page = browser.pages()[0] || await browser.newPage();
try {
  await wa.ensureAccount(page, { account, name: accountName });
  const out = await deliver(page, m, !!DRY_ID);
  if (DRY_ID) {
    say(`- dry run: all ${parts.length} messages were typed and nothing was sent.`);
    say(`  what each one would have looked like: tools/whatsapp/dry-run-1..${parts.length}.png`);
  } else {
    recordSent(sent, m.id);
    say(`- sent ${out} messages. ${mask(m.to_whatsapp)} has the words and the link.`);
    say(`  screenshot: tools/whatsapp/sent.png`);
  }
} catch (err) {
  if (err.partsSent) {
    recordSent(sent, m.id);
    say(`! PARTIAL: ${err.partsSent} of ${parts.length} messages arrived before this failed.`);
    say('  Logged as sent so a retry cannot repeat them. Finish it by hand if it matters.');
  }
  await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
  console.error('\n✗ ' + err.message);
  console.error('  screenshot of what it was looking at: tools/whatsapp/last-failure.png');
  process.exitCode = 1;
} finally {
  if (!KEEP_OPEN) await browser.close();
  else say('  (window left open - close it yourself when you are done)');
}
process.exit(process.exitCode || 0);
