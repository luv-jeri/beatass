/**
 * Tells a confession's recipient on Instagram that a message is waiting for
 * them, by DM from our own account. The DM says openly that it is automated,
 * and carries only the /m view link - the page with the message, the doll
 * clip, block, report, and reply.
 *
 *   node tools/instagram/notify.mjs                     list what is waiting
 *   node tools/instagram/notify.mjs --text <id>         print the DM word for word, no browser
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

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));

// a saved browser session is a credential: it lives outside the repo
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');

// which messages have already been notified, so a re-run cannot double-DM
const SENT_LOG = path.join(ROOT, CONFIG.contentDir, '.notified.json');

const SITE = 'https://beatass.com';
const DAILY_CAP = 30;            // most auto-sends in one calendar day

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
  return { rows: rows.filter((r) => !sent[r.id]), sent };
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

export const dmText = (m, link) => {
  const p = dmPreview(m.body);
  return 'hey - someone left you an anonymous message on beatass.com\n\n' +
    (p.text ? '"' + p.text + '"\n\n' : '') +
    (p.clipped ? 'read the rest' : 'see what they did to the doll') +
    ' (and reply to them) here: ' + link + '\n\n' +
    'this is an automated message from beatass.com. open the link to read it, ' +
    'share it, report it, or block us so we never message you again.';
};

/* --selftest proves the preview logic before any DM is composed: no database,
   no browser, nothing outward. Runs in CI. */
if (args.includes('--selftest')) {
  const eq = (label, got, want) => {
    if (got !== want) { console.error(`✗ ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); process.exitCode = 1; }
  };
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
  const t = dmText(m, 'https://beatass.com/m?id=x&t=y');
  eq('the words are in the DM', t.includes('"i still think about it"'), true);
  eq('the link is in the DM', t.includes('https://beatass.com/m?id=x&t=y'), true);
  eq('the reply route is the page', t.includes('reply to them'), true);
  eq('the opt-out line survives', t.includes('block us so we never message you again'), true);
  eq('a clipped DM says so', dmText({ body: long }, 'L').includes('read the rest'), true);
  eq('an empty body still sends a link', dmText({ body: '' }, 'L').includes('L'), true);
  console.log(process.exitCode ? '\ndm selftest FAILED' : 'dm preview selftest: 16/16 pass');
  process.exit(process.exitCode || 0);
}

/* ---------- --text <id>: exactly what the DM will say. No browser. ---------- */
if (TEXT_ID) {
  const m = loadOne(TEXT_ID);
  say(`\nmessage ${m.id} -> @${m.to_handle} (for "${m.to_name}")`);
  say('the DM will say:\n');
  say(dmText(m, linkFor(m)).split('\n').map((l) => '  | ' + l).join('\n') + '\n');
  process.exit(0);
}

/* ---------- the browser walk (selectors captured live, G27) ---------- */

function launch(headless) {
  return chromium.launchPersistentContext(SESSION, {
    headless, viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
}

async function dismissPopups(page) {
  for (const label of ['Not now', 'Not Now', 'Cancel', 'Dismiss']) {
    const b = page.getByRole('button', { name: label, exact: true });
    if (await b.count() && await b.first().isVisible().catch(() => false)) {
      await b.first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

/** Same identity check as post.mjs: refuse to act as the wrong account. */
async function ensureRightAccount(page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissPopups(page);
  const loggedIn = (await page.context().cookies('https://www.instagram.com'))
    .some((c) => c.name === 'ds_user_id');
  if (!loggedIn) die('Not logged in. Run: node tools/instagram/post.mjs --login');
  const who = await page.evaluate(() => {
    const img = document.querySelector('a[href^="/"] img[alt*="profile picture" i]');
    const a = img && img.closest('a');
    const m = a && (a.getAttribute('href') || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
    return m ? m[1] : '';
  }).catch(() => '');
  if (who && who.toLowerCase() !== String(CONFIG.handle).toLowerCase().replace(/^@/, ''))
    die(`Signed in as "${who}" but config.json says "${CONFIG.handle}". Not sending from the wrong account.`);
}

async function openThread(page, handle) {
  await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissPopups(page);

  const q = page.locator('input[name="searchInput"]').first();
  await q.waitFor({ state: 'visible', timeout: 20000 });
  await q.click();
  await q.type(handle, { delay: 60 });
  await page.waitForTimeout(3500);

  // Result rows are role=button whose text is "Display name\nusername\nbio".
  // Only an EXACT username line may match - a near-miss must never open
  // somebody else's thread.
  const hit = await page.evaluate((h) => {
    const rows = [...document.querySelectorAll('[role="button"]')]
      .filter((e) => e.offsetParent &&
        (e.innerText || '').split('\n').some((line) => line.trim().toLowerCase() === h));
    if (!rows.length) return false;
    rows[0].click();
    return true;
  }, handle.toLowerCase());
  if (!hit) throw new Error(`no Instagram account named exactly "@${handle}"`);

  await page.waitForURL(/\/direct\/t\/\d+/, { timeout: 20000 });
  await page.waitForTimeout(2500);
}

async function typeDm(page, text) {
  const box = page.locator('div[role="textbox"][contenteditable="true"]').first();
  await box.waitFor({ state: 'visible', timeout: 20000 });
  await box.click();
  /* Enter SENDS in Instagram's composer. A raw newline fed to type() is an
     Enter press - which is how the first dry run of this tool accidentally
     sent two half-messages (unsent, 2026-08-03). So the text goes in line by
     line, with Shift+Enter between lines, and never a bare newline. */
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press('Shift+Enter');
    if (lines[i]) await box.type(lines[i], { delay: 12 });
  }
  await page.waitForTimeout(1000);
  return box;
}

/** Open the thread, type the DM, then send (or, in dry mode, clear and stop). */
async function deliver(page, m, dry) {
  await openThread(page, m.to_handle);
  await typeDm(page, dmText(m, linkFor(m)));
  if (dry) {
    await page.screenshot({ path: path.join(HERE, 'dm-dry-run.png') });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.press('Backspace');
    return;
  }
  await page.locator('div[role="button"][aria-label="Send"]').first().click({ timeout: 10000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(HERE, 'dm-sent.png') });
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
      if (isBlocked(r.to_handle)) { say(`  skip @${r.to_handle}: blocked.`); continue; }
      say(`  ${DRY ? 'walk' : 'send'} -> @${r.to_handle} for "${r.to_name}" [${r.id}]`);
      try {
        await deliver(page, r, DRY);
        if (!DRY) {
          recordSent(sent, r.id);
          done++;
          const wait = 25000 + Math.floor(Math.random() * 50000);   // 25-75s, no bursts
          say(`    sent. pausing ${Math.round(wait / 1000)}s.`);
          await page.waitForTimeout(wait);
        }
      } catch (e) {
        say(`    skipped [${r.id}]: ${e.message.split('\n')[0]}`);
        await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
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
if (SEND_ID && sent[m.id]) die(`message ${m.id} was already sent to @${m.to_handle} on ${sent[m.id]}. Not sending twice.`);

say(`\nmessage ${m.id} -> @${m.to_handle} (for "${m.to_name}")`);
say('the DM will say:\n');
say(dmText(m, linkFor(m)).split('\n').map((l) => '  | ' + l).join('\n') + '\n');

const browser = await launch(CONFIG.headless === true);
const page = browser.pages()[0] || await browser.newPage();
try {
  await ensureRightAccount(page);
  await deliver(page, m, !!DRY_ID);
  if (DRY_ID) {
    say('- dry run: everything worked up to the Send button, and it was NOT pressed.');
    say('  what it would have looked like: tools/instagram/dm-dry-run.png');
  } else {
    recordSent(sent, m.id);
    say(`✓ sent. @${m.to_handle} has the link. Screenshot: tools/instagram/dm-sent.png`);
  }
} catch (err) {
  await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
  console.error('\n✗ ' + err.message);
  console.error('  screenshot of what it was looking at: tools/instagram/last-failure.png');
  process.exitCode = 1;
} finally {
  await browser.close();
}
