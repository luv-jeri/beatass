/**
 * The browser half of the WhatsApp sender: open a chat, type, send.
 *
 * Nothing in here decides WHAT to send or WHETHER to send it - that is
 * notify.mjs. This file only knows how to work WhatsApp Web's screen.
 *
 * Selector honesty (G27): every selector below was read off the live page on
 * 2026-08-04, not remembered or guessed. What was actually there:
 *
 *   signed in            #pane-side exists (the chat list pane)
 *   the search box       input[type=text][aria-label="Search or start a new chat"]
 *                        (an <input>, NOT a contenteditable - worth knowing)
 *   open a stranger      https://web.whatsapp.com/send?phone=<digits>
 *                        goes straight to the chat, no interstitial page
 *   the message box      footer div[role=textbox][contenteditable=true],
 *                        aria-placeholder="Type a message", data-tab="10"
 *   the send button      footer button[aria-label="Send"] - it does NOT exist
 *                        until the box has text (a microphone sits there
 *                        instead), which is why nothing can be sent by
 *                        accident before a message is typed
 *   an unusable number   a [role=dialog] saying "The number ... isn't on
 *                        WhatsApp." with one OK button, and no composer at all
 *
 * When WhatsApp redesigns and one of these stops matching, the run stops and
 * the caller writes tools/whatsapp/last-failure.png. Open it, see what moved,
 * fix it here - one place, not five.
 */
import { chromium } from 'playwright';

/* macOS uses Cmd for select-all; anywhere else it is Ctrl. */
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

export function launch(session, headless) {
  return chromium.launchPersistentContext(session, {
    headless,
    viewport: { width: 1180, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
}

const composer = (page) => page.locator('footer [contenteditable="true"][role="textbox"]').last();

/** Close the "isn't on WhatsApp" style dialog so it cannot block the next chat. */
async function dismissDialog(page) {
  const ok = page.locator('[role="dialog"] button', { hasText: /^OK$/ }).first();
  if (await ok.count()) { await ok.click().catch(() => {}); await page.waitForTimeout(800); }
}

/**
 * Prove the session belongs to the account we think it does, before a single
 * message goes out.
 *
 * How: open Settings and require the configured profile name to be on it. That
 * panel is where WhatsApp shows who you are signed in as, and it is the only
 * place on the whole web app that says so - the phone number is not printed
 * anywhere in the interface, which is why the config carries a name too.
 *
 * Rejected, on evidence rather than taste: deep-linking our own number and
 * looking for WhatsApp's "(You)" self-chat marker. Tried it on 2026-08-04 and
 * a Business account renders that chat as an ordinary one ("+91 ... / Business
 * Account"), so the marker never appears and the check refused everything.
 *
 * It fails CLOSED: if the name cannot be read, it refuses rather than sending
 * from an account nobody verified.
 */
export async function ensureAccount(page, { name }) {
  await page.goto('https://web.whatsapp.com/', { waitUntil: 'domcontentloaded' });
  const paneOk = await page.locator('#pane-side').first()
    .waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
  if (!paneOk)
    throw new Error('WhatsApp Web is not signed in. Run: node tools/whatsapp/login.mjs');

  const gear = page.locator('[aria-label="Settings"], [title="Settings"]').first();
  if (!await gear.count())
    throw new Error('cannot find the Settings button, so cannot confirm which account this is');
  await gear.click();
  await page.waitForTimeout(2500);
  const who = await page.evaluate(() => {
    const t = document.body.innerText || '';
    return { settingsOpen: /(^|\n)Settings(\n|$)/.test(t), text: t };
  });
  const nameSeen = who.settingsOpen && who.text.includes(name);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  if (!nameSeen)
    throw new Error(
      `this session is not signed in as "${name}".\n` +
      '  Set the right profile name in ~/.config/beatass-whatsapp/config.json\n' +
      '  (it must match the name on WhatsApp Settings exactly). Nothing was sent.');
}

/**
 * Open a chat with a number that is almost certainly not in our contacts.
 * Returns 'ok' or 'not-on-whatsapp'. Never sends.
 */
export async function openChat(page, number) {
  const digits = String(number).replace(/\D+/g, '');
  await page.goto(`https://web.whatsapp.com/send?phone=${digits}`, { waitUntil: 'domcontentloaded' });

  /* Whichever appears first decides: the message box, or the dialog saying the
     number is unusable. Polled rather than raced on one selector so a slow
     load is not mistaken for a bad number. */
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (await composer(page).count()) return 'ok';
    const bad = await page.evaluate(() =>
      /isn't on WhatsApp|is not on WhatsApp|invalid/i.test(
        document.querySelector('[role="dialog"]')?.innerText || '')
    );
    if (bad) { await dismissDialog(page); return 'not-on-whatsapp'; }
    await page.waitForTimeout(1000);
  }
  throw new Error('the chat never opened (no message box, no dialog) within 40s');
}

/**
 * Type one message into the box. Does NOT send it.
 *
 * Newlines are typed as Shift+Enter, because a bare Enter in WhatsApp's box
 * sends immediately - and the third message has blank lines in it. This is the
 * one detail that would turn a dry run into a real send.
 */
export async function typeMessage(page, text) {
  const box = composer(page);
  if (!await box.count()) throw new Error('the message box is not on screen');
  await box.click();
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press('Shift+Enter');
    if (lines[i]) await page.keyboard.type(lines[i], { delay: 12 });
  }
  await page.waitForTimeout(400);
}

/** Wipe the box, so a dry run can rehearse the next message. */
export async function clearBox(page) {
  const box = composer(page);
  await box.click();
  await page.keyboard.press(SELECT_ALL);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
}

/**
 * Send what is in the box, and prove it left.
 *
 * The proof is that the Send button stops existing: it only exists while the
 * box has text, so its disappearance means the box emptied, which means the
 * message went. That is an observable fact about the page rather than a timer -
 * this project has already been bitten once by a poster that declared success
 * after sleeping for twelve seconds.
 */
export async function pressSend(page) {
  const btn = page.locator('footer button[aria-label="Send"]').first();
  if (!await btn.count())
    throw new Error('no Send button - the box was empty, so there was nothing to send');
  await btn.click({ timeout: 10000 });
  const gone = await btn.waitFor({ state: 'detached', timeout: 15000 })
    .then(() => true).catch(() => false);
  if (!gone)
    throw new Error('Send was clicked but the button is still there - assume it did NOT send');
}
