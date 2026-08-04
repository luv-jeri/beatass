/**
 * Opens a real WhatsApp Web window and waits for you to link the account.
 *
 *   node tools/whatsapp/login.mjs            use Playwright's own browser
 *   node tools/whatsapp/login.mjs --chrome   use the Google Chrome you have installed
 *
 * You only do this once. WhatsApp Web logs in by showing a QR code that you
 * scan with the phone that owns the account: on the phone, Settings ->
 * Linked devices -> Link a device, then point the camera at the window.
 *
 * What this script does: opens the window, then watches. It checks every three
 * seconds and tells you what it can see - QR code showing, linking, or in. The
 * moment it is in, it photographs the screen and closes itself.
 *
 * It never types anything, and it cannot see your phone.
 *
 * The session is saved to ~/.config/beatass-whatsapp, which is OUTSIDE this
 * repo, because a saved login is a credential and credentials never go in a
 * repo - this one is public.
 *
 * If the window shows an "unsupported browser" message, close it and run again
 * with --chrome.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SESSION = path.join(os.homedir(), '.config', 'beatass-whatsapp');
const MINUTES = 4;
const USE_CHROME = process.argv.includes('--chrome');

fs.mkdirSync(SESSION, { recursive: true });

console.log(`
A WhatsApp Web window is opening.

  1. On the phone that owns the business account:
       Settings -> Linked devices -> Link a device
  2. Point it at the QR code in the window.
  3. Leave the window open until this says it worked. Do not close it yourself.

Waiting up to ${MINUTES} minutes. Ctrl-C to give up.
`);

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: false,
  viewport: { width: 1180, height: 900 },
  ...(USE_CHROME ? { channel: 'chrome' } : {}),
  args: ['--disable-blink-features=AutomationControlled']
});
const page = browser.pages()[0] || await browser.newPage();
await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});

/* Which signals mean what is NOT guessed from memory: every state below prints
   what it actually matched, and a screenshot is saved either way, so the real
   page decides - not this file's assumptions about WhatsApp's markup. */
let ok = false, said = '';
const deadline = Date.now() + MINUTES * 60000;

while (Date.now() < deadline) {
  await page.waitForTimeout(3000);
  let s;
  try {
    s = await page.evaluate(() => {
      const txt = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
      const has = (sel) => !!document.querySelector(sel);
      return {
        // the chat list pane only exists once a session is linked
        chatList: has('#pane-side') || has('[aria-label="Chat list" i]'),
        search: has('[aria-label*="Search" i][contenteditable], [aria-label*="Search" i] input'),
        qr: has('canvas') && /scan|qr|link/i.test(txt),
        unsupported: /update (your )?(browser|whatsapp)|not supported|unsupported/i.test(txt),
        loading: /loading|connecting|syncing/i.test(txt),
        head: txt.slice(0, 140)
      };
    });
  } catch { continue; }   // a navigation was in flight, look again

  if (s.unsupported) {
    console.log('\n! WhatsApp says this browser is not supported.');
    console.log('  Close the window and run:  node tools/whatsapp/login.mjs --chrome\n');
    await page.screenshot({ path: path.join(HERE, 'login-unsupported.png') }).catch(() => {});
    await browser.close();
    process.exit(2);
  }

  /* The one thing that counts: the chat list is on screen. */
  if (s.chatList) { ok = true; break; }

  const now = s.qr ? 'QR code is showing - scan it with the phone'
    : s.loading ? 'linked, syncing your chats'
    : 'loading';
  if (now !== said) {
    console.log('  ' + now + '...');
    if (s.qr) console.log('    (page says: "' + s.head + '")');
    said = now;
  }
}

const shot = path.join(HERE, ok ? 'login-ok.png' : 'login-failed.png');
await page.screenshot({ path: shot }).catch(() => {});

if (ok) {
  console.log(`\n- linked. The chat list is on screen and the session is saved.`);
  console.log(`  proof: ${path.relative(process.cwd(), shot)}`);
  console.log(`\nOne thing left, so the sender can refuse to run on the wrong account.`);
  console.log(`Put the sending number in a file outside this repo (change the digits):\n`);
  console.log(`  echo '{"account":"+91XXXXXXXXXX"}' > ~/.config/beatass-whatsapp/config.json\n`);
} else {
  console.log('\nGave up waiting. Nothing was changed, run it again when you have a minute.');
  console.log(`  what it was looking at: ${path.relative(process.cwd(), shot)}\n`);
}
await browser.close();
process.exit(ok ? 0 : 1);
