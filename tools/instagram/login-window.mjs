/**
 * Opens a real Instagram window on the saved session and waits for YOU.
 *
 *   node tools/instagram/login-window.mjs
 *
 * Use it when the automation says it is signed out, or parked on the
 * "Continue as _beatass_" screen. Both happen, and neither can be cleared by a
 * script: Instagram wants a person, and with two-factor turned on it wants a
 * code only you can read.
 *
 * What it does: opens the window, then watches. Log in however you need to -
 * press Continue, type the password, type the code from your phone. It checks
 * every three seconds and tells you the moment it can actually read the
 * account. Then it saves the session and closes itself.
 *
 * It never types anything. It does not read your password, it does not touch
 * credentials.json, and it cannot see the code on your phone. It only watches
 * for the outcome.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');
const WANT = String(CONFIG.handle).replace(/^@/, '').toLowerCase();
const MINUTES = 10;

console.log(`
A window is opening on the beatass Instagram session.

  1. Do whatever it asks: press Continue, sign in, type the code from your phone.
  2. Leave the window open until this says it worked. Do not close it yourself.
  3. It closes on its own, and the login is remembered from then on.

Waiting up to ${MINUTES} minutes. Ctrl-C to give up.
`);

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: false,
  viewport: { width: 1180, height: 900 },
  args: ['--disable-blink-features=AutomationControlled']
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

let ok = false, said = '';
const deadline = Date.now() + MINUTES * 60000;

while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  let state;
  try {
    state = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const img = document.querySelector('a[href^="/"] img[alt*="profile picture" i]');
      const a = img && img.closest('a');
      const m = a && (a.getAttribute('href') || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
      return {
        who: m ? m[1] : '',
        parked: [...document.querySelectorAll('button, div[role="button"]')]
          .some((e) => e.offsetParent && (e.innerText || '').trim() === 'Continue'),
        password: !!document.querySelector('input[type="password"]'),
        code: !!document.querySelector('input[name="verificationCode"], input[autocomplete="one-time-code"]')
      };
    });
  } catch { continue; }   // a navigation was in flight, look again

  /* The one thing that counts: can we read the account off a working page? */
  if (state.who && state.who.toLowerCase() === WANT) { ok = true; break; }
  if (state.who && state.who.toLowerCase() !== WANT) {
    console.log(`\n! That is signed in as @${state.who}, not @${WANT}. Switch accounts in the window.`);
    said = 'wrong';
    continue;
  }

  const now = state.code ? 'waiting for your two-factor code'
    : state.password ? 'waiting for the password'
    : state.parked ? 'waiting for you to press Continue'
    : 'loading';
  if (now !== said) { console.log('  ' + now + '...'); said = now; }
}

if (ok) {
  /* Prove it, on a page the automation actually uses, not just the home page. */
  await page.goto('https://www.instagram.com/direct/new/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const canDm = await page.locator('input[name="searchInput"]').first()
    .waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  console.log(`\n${canDm ? '✓' : '!'} signed in as @${WANT}. Sending a message ${canDm ? 'works' : 'still does NOT work - run the health check'}.`);
  console.log('  Session saved. The waiting messages go out on the next 2-minute run.\n');
} else {
  console.log('\nGave up waiting. Nothing was changed. Run it again when you have a minute.\n');
}
await browser.close();
process.exit(ok ? 0 : 1);
