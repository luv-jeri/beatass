/**
 * Posts the next unposted video or image from the content folder to our own
 * Instagram account.
 *
 *   node tools/instagram/post.mjs --dry-run    everything except pressing Share
 *   node tools/instagram/post.mjs              actually posts
 *   node tools/instagram/post.mjs --login      just log in and save the session
 *
 * Which account it posts to lives in config.json. Change "handle" there and it
 * posts somewhere else — the script refuses to run if the browser is signed in
 * as anybody other than that handle, so a stale session cannot post to the
 * wrong account.
 *
 * The login session is stored OUTSIDE this repo, in
 * ~/.config/beatass-instagram/, because a saved session is a credential and
 * credentials never live in a repo.
 * The username/password also live there, in credentials.json.
 *
 * Instagram redesigns its web interface regularly. When a step stops matching,
 * the run stops and writes a screenshot to tools/instagram/last-failure.png so
 * you can see exactly which screen it was looking at.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));

// a saved browser session is a credential: keep it out of the repo
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');

// Username/password live OUTSIDE the repo too, next to the saved session.
// Fill them in at ~/.config/beatass-instagram/credentials.json:
//   { "username": "your_handle", "password": "your_password" }
function credentials() {
  const f = path.join(SESSION, 'credentials.json');
  try {
    const c = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (c.username && c.password) return c;
  } catch (e) { /* fall through to env vars */ }
  return { username: process.env.IG_USERNAME, password: process.env.IG_PASSWORD };
}

const DRY = process.argv.includes('--dry-run');
const LOGIN_ONLY = process.argv.includes('--login');

const say = (m) => console.log(m);
const die = (m) => { console.error('\n✗ ' + m + '\n'); process.exit(1); };

/** Files waiting to be posted, oldest name first, minus anything already sent. */
function nextItem() {
  const dir = path.join(ROOT, CONFIG.contentDir);
  if (!fs.existsSync(dir)) die(`No content folder at ${CONFIG.contentDir}. Make it and drop a video or image in.`);

  const logFile = path.join(dir, '.posted.json');
  const posted = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : {};

  const file = fs.readdirSync(dir)
    .filter((f) => /\.(mp4|mov|jpg|jpeg|png)$/i.test(f))
    .filter((f) => !posted[f])
    .sort()[0];

  return { dir, file, logFile, posted };
}

/** The caption for one file: its own .txt sidecar if present, else the default. */
function captionFor(dir, file) {
  const sidecar = path.join(dir, file.replace(/\.[^.]+$/, '.txt'));
  const text = fs.existsSync(sidecar)
    ? fs.readFileSync(sidecar, 'utf8').trim()
    : CONFIG.caption;
  const tags = (CONFIG.hashtags || []).map((t) => '#' + t.replace(/^#/, '')).join(' ');
  return tags ? `${text}\n\n${tags}` : text;
}

/** Instagram throws a different "not now" dialog at you every few weeks. */
async function dismissPopups(page) {
  for (const label of ['Not now', 'Not Now', 'Cancel', 'Dismiss']) {
    const b = page.getByRole('button', { name: label, exact: true });
    if (await b.count() && await b.first().isVisible().catch(() => false)) {
      await b.first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

async function ensureLoggedIn(page) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissPopups(page);

  const loginField = page.locator('input[name="username"]');
  if (await loginField.count() && await loginField.isVisible().catch(() => false)) {
    const { username: user, password: pass } = credentials();
    if (!user || !pass)
      die('Not logged in, and no credentials found.\n  Put them in ' + path.join(SESSION, 'credentials.json') + ' like:\n  { "username": "your_handle", "password": "your_password" }');

    say('logging in...');
    await loginField.fill(user);
    await page.locator('input[name="password"]').fill(pass);
    await page.locator('button[type="submit"]').click();

    // two-factor, or a "we saved your login" screen, both need a human
    await page.waitForTimeout(9000);
    await dismissPopups(page);
    if (await page.locator('input[name="verificationCode"]').count())
      die('Instagram is asking for a two-factor code. Run with "headless": false in config.json, type the code in the window, then run again — the session is saved after that.');
  }

  await dismissPopups(page);

  // Confirm WHICH account we are signed in as. Posting to the wrong account is
  // the one mistake here that cannot be taken back.
  await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const who = await page.locator('input[id*="username" i], input[name="username"]').first()
    .inputValue().catch(() => '');
  if (!who) die('Could not read which account is signed in. Run with "headless": false and look at the window.');
  if (who.toLowerCase() !== String(CONFIG.handle).toLowerCase().replace(/^@/, ''))
    die(`Signed in as "${who}" but config.json says "${CONFIG.handle}".\n  Either fix the handle in config.json, or delete ${SESSION} and log in again.`);

  say(`signed in as @${who}`);
  return who;
}

async function post(page, filePath, caption) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissPopups(page);

  say('opening the composer...');
  const create = page.getByRole('link', { name: /new post|create/i })
    .or(page.locator('svg[aria-label="New post"]'))
    .first();
  await create.click({ timeout: 20000 });
  await page.waitForTimeout(1500);

  // some layouts show a "Post" sub-item under Create
  const postItem = page.getByRole('link', { name: /^post$/i }).first();
  if (await postItem.count() && await postItem.isVisible().catch(() => false)) {
    await postItem.click();
    await page.waitForTimeout(1200);
  }

  say('uploading ' + path.basename(filePath));
  const chooser = page.waitForEvent('filechooser', { timeout: 20000 });
  await page.getByRole('button', { name: /select from computer/i }).first().click();
  (await chooser).setFiles(filePath);

  // a video gets an extra "how do you want to share this" step
  await page.waitForTimeout(6000);
  await dismissPopups(page);

  for (const step of ['Next', 'Next']) {
    const b = page.getByRole('button', { name: step, exact: true }).first();
    await b.waitFor({ state: 'visible', timeout: 45000 });
    await b.click();
    await page.waitForTimeout(2500);
  }

  say('writing the caption...');
  const box = page.getByRole('textbox', { name: /caption/i })
    .or(page.locator('div[contenteditable="true"]'))
    .first();
  await box.waitFor({ state: 'visible', timeout: 30000 });
  await box.click();
  await box.type(caption, { delay: 8 });
  await page.waitForTimeout(1000);

  if (DRY) {
    await page.screenshot({ path: path.join(HERE, 'dry-run.png'), fullPage: false });
    say('\n— dry run: everything worked up to the Share button, and it was NOT pressed.');
    say('  what it would have looked like: tools/instagram/dry-run.png');
    return false;
  }

  await page.getByRole('button', { name: /^share$/i }).first().click();
  await page.waitForTimeout(12000);
  say('shared.');
  return true;
}

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: CONFIG.headless === true,
  viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled']
});
const page = browser.pages()[0] || await browser.newPage();

try {
  await ensureLoggedIn(page);

  if (LOGIN_ONLY) {
    say('session saved. You will not need to log in again on this machine.');
  } else {
    const { dir, file, logFile, posted } = nextItem();
    if (!file) {
      say(`nothing new to post — every file in ${CONFIG.contentDir} has been posted.`);
    } else {
      const caption = captionFor(dir, file);
      const done = await post(page, path.join(dir, file), caption);
      if (done) {
        posted[file] = new Date().toISOString();
        fs.writeFileSync(logFile, JSON.stringify(posted, null, 2));
        say(`\n✓ posted ${file} to @${CONFIG.handle}`);
      }
    }
  }
} catch (err) {
  await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
  console.error('\n✗ ' + err.message);
  console.error('  screenshot of what it was looking at: tools/instagram/last-failure.png');
  console.error('  Instagram probably changed the page. The selector that failed is in the message above.');
  process.exitCode = 1;
} finally {
  await browser.close();
}
