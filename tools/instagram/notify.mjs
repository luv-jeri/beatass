/**
 * Tells a confession's recipient on Instagram that a message is waiting for
 * them, by DM from our own account. The DM says openly that it is automated,
 * and carries only the /m view link - the page with the message, the doll
 * clip, block, report, and reply.
 *
 *   node tools/instagram/notify.mjs                     list waiting messages
 *   node tools/instagram/notify.mjs --dry-run <id>      walk the whole flow, screenshot, send NOTHING
 *   node tools/instagram/notify.mjs --send <id>         actually send the DM (one message, one run)
 *   node tools/instagram/notify.mjs --block <handle>    honour a STOP reply: never DM them again
 *
 * Every real send is one deliberate human-run command - there is no batch
 * mode on purpose. Rule 3: nothing goes outward without Sanjay's yes, and
 * running --send IS that yes, one message at a time.
 *
 * A --local flag points the database reads at the local dev D1 instead of
 * production, which is how the flow is tested without touching real data.
 *
 * Selector honesty (G27): every Instagram selector below was captured from
 * the live DOM on 2026-08-03, not guessed. When Instagram redesigns and a
 * step stops matching, the run stops and writes tools/instagram/last-failure.png
 * so you can see the screen it was looking at.
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

const args = process.argv.slice(2);
const LOCAL = args.includes('--local');
const flagVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DRY_ID = flagVal('--dry-run');
const SEND_ID = flagVal('--send');
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
  catch (e) { die('could not read the database answer:\n' + r.stdout.slice(-400)); }
}

const sq = (s) => "'" + String(s).replace(/'/g, "''") + "'";  // SQL string literal

/** Waiting = has a handle, has a minted link, recipient hasn't blocked us. */
function pending() {
  const sent = fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, 'utf8')) : {};
  const rows = d1(
    "SELECT m.id, m.to_name, m.to_handle, m.view_token, m.created_at FROM messages m " +
    "WHERE m.to_handle IS NOT NULL AND m.view_token IS NOT NULL " +
    "AND NOT EXISTS (SELECT 1 FROM blocklist b WHERE b.email = 'ig:' || m.to_handle) " +
    "ORDER BY m.created_at"
  );
  return { rows: rows.filter((r) => !sent[r.id]), sent };
}

function loadOne(id) {
  if (!/^[a-f0-9]{16}$/.test(id || '')) die('that does not look like a message id (16 hex chars).');
  const rows = d1(`SELECT id, to_name, to_handle, view_token FROM messages WHERE id = ${sq(id)}`);
  if (!rows.length) die(`no message ${id} in the ${LOCAL ? 'local' : 'live'} database.`);
  const m = rows[0];
  if (!m.to_handle) die(`message ${id} has no Instagram handle - it was an email-only send.`);
  if (!m.view_token) die(`message ${id} has no view link stored (sent before the notifier existed). Nothing to link to.`);
  const blocked = d1(`SELECT 1 AS x FROM blocklist WHERE email = ${sq('ig:' + m.to_handle)}`);
  if (blocked.length) die(`@${m.to_handle} has blocked beatass. We honour that. Not sending.`);
  return m;
}

/* ---------- what the DM says ---------- */

const dmText = (link) =>
  'hey - someone left you an anonymous message on beatass.com\n\n' +
  'read it here: ' + link + '\n\n' +
  'this is an automated message from beatass.com. the link also lets you ' +
  'reply, report it, or block us. reply STOP and we will never message you again.';

/* ---------- the browser walk (selectors captured live, G27) ---------- */

async function openThread(page, handle) {
  await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissPopups(page);

  say('searching @' + handle + '...');
  const q = page.locator('input[name="searchInput"]').first();
  await q.waitFor({ state: 'visible', timeout: 20000 });
  await q.click();
  await q.type(handle, { delay: 60 });
  await page.waitForTimeout(3500);

  // Result rows are role=button whose text is "Display name\nusername\nbio".
  // Only an EXACT username line may match - a near-miss handle must never
  // open somebody else's thread.
  const hit = await page.evaluate((h) => {
    const rows = [...document.querySelectorAll('[role="button"]')]
      .filter((e) => e.offsetParent &&
        (e.innerText || '').split('\n').some((line) => line.trim().toLowerCase() === h));
    if (!rows.length) return false;
    rows[0].click();
    return true;
  }, handle.toLowerCase());
  if (!hit) die(`Instagram found no account named exactly "@${handle}". Check the handle - not sending anywhere else.`);

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

/* ---------- the three jobs ---------- */

if (BLOCK_HANDLE) {
  const h = BLOCK_HANDLE.toLowerCase().replace(/^@+/, '');
  if (!/^[a-z0-9._]{1,30}$/.test(h)) die('that does not look like an Instagram handle.');
  d1(`INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (${sq('ig:' + h)}, ${Math.floor(Date.now() / 1000)})`);
  say(`@${h} is blocked forever. They will never hear from beatass again.`);
  process.exit(0);
}

if (!DRY_ID && !SEND_ID) {
  // list mode: what is waiting, and the exact command to act on each
  const { rows } = pending();
  if (!rows.length) { say('nothing waiting - every Instagram message has been notified (or none exist).'); process.exit(0); }
  say(`${rows.length} message(s) waiting for an Instagram notification:\n`);
  for (const r of rows) {
    const age = Math.round((Date.now() / 1000 - r.created_at) / 3600);
    say(`  ${r.id}  @${r.to_handle}  for "${r.to_name}"  (${age}h ago)`);
    say(`      dry run:  node tools/instagram/notify.mjs --dry-run ${r.id}`);
    say(`      send:     node tools/instagram/notify.mjs --send ${r.id}\n`);
  }
  process.exit(0);
}

const id = DRY_ID || SEND_ID;
const m = loadOne(id);
const { sent } = pending();
if (SEND_ID && sent[m.id]) die(`message ${m.id} was already sent to @${m.to_handle} on ${sent[m.id]}. Not sending twice.`);

const link = `${SITE}/m?id=${m.id}&t=${m.view_token}`;
const text = dmText(link);
say(`\nmessage ${m.id} -> @${m.to_handle} (for "${m.to_name}")`);
say('the DM will say:\n');
say(text.split('\n').map((l) => '  | ' + l).join('\n') + '\n');

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: CONFIG.headless === true,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled']
});
const page = browser.pages()[0] || await browser.newPage();

try {
  await ensureRightAccount(page);
  await openThread(page, m.to_handle);
  await typeDm(page, text);

  if (DRY_ID) {
    await page.screenshot({ path: path.join(HERE, 'dm-dry-run.png') });
    // clear the draft so nothing lingers armed in the thread
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.press('Backspace');
    say('— dry run: everything worked up to the Send button, and it was NOT pressed.');
    say('  what it would have looked like: tools/instagram/dm-dry-run.png');
  } else {
    await page.locator('div[role="button"][aria-label="Send"]').first().click({ timeout: 10000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(HERE, 'dm-sent.png') });
    sent[m.id] = new Date().toISOString();
    fs.mkdirSync(path.dirname(SENT_LOG), { recursive: true });
    fs.writeFileSync(SENT_LOG, JSON.stringify(sent, null, 2));
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
