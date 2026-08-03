/**
 * Is the Instagram automation still able to do its job?
 *
 *   node tools/instagram/health.mjs          run every check, print a table
 *   node tools/instagram/health.mjs --quiet  only speak up if something failed
 *
 * Exit 0 = everything works. Exit 1 = something is broken and messages are
 * silently not being delivered. A scheduler runs this daily (auto-health.sh).
 *
 * WHY THIS EXISTS
 * The DM notifier and the outreach tool drive Instagram's website by looking
 * for named things on the page: a box called "Add a comment", a button called
 * "Send". Instagram redesigns its website whenever it likes. When one of those
 * names changes, nothing crashes and nothing complains - the tool just stops
 * finding the thing, and messages quietly stop going out. That failure is
 * invisible until somebody thinks to look, and nobody thinks to look.
 *
 * So this walks the same pages the real tools walk and confirms each thing is
 * still there. It is a smoke alarm, not a test suite.
 *
 * WHAT IT WILL NOT DO
 * It sends nothing, follows nobody, posts nothing and changes no setting. Where
 * a control only appears once there is text (Instagram hides the Send button
 * and the comment Post button until you type), it types a probe word, checks
 * the control appeared, and wipes the box - the same trick the dry runs use,
 * which has been proven not to send.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { FOLLOW_LABELS, PRIVATE_RX, followButtonRx, loadLog, STATE_KEY } from './outreach.mjs';
/* The REAL steps the notifier uses, not a copy of them. The first version of
   this file re-implemented openThread and reported the composer as broken
   while the actual notifier was working perfectly. A check that tests its own
   copy of the code is worse than no check: it raises false alarms and it will
   still miss the day Instagram changes the real thing. */
import { dismissPopups as igDismiss, openThread, typeDm, clearBox, resumeSession, SESSION_PARKED } from './ig-dm.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');
const REPORT = path.join(SESSION, 'health.json');
const IG = 'https://www.instagram.com';
const QUIET = process.argv.includes('--quiet');
const want = String(CONFIG.handle).replace(/^@/, '').toLowerCase();

/* A big, stable, public account with posts, used only to look at. Nothing is
   done to it. Override in config.json if it ever goes away. */
const PROBE = String((CONFIG.outreach || {}).healthProbeHandle || 'instagram').replace(/^@/, '');
const PROBE_WORD = 'x';   // typed into boxes to make hidden buttons appear, never sent

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail: detail || '' });
  if (!QUIET) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  (' + detail + ')' : ''}`);
};

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: true, viewport: { width: 1280, height: 900 },
  args: ['--disable-blink-features=AutomationControlled']
});
const page = browser.pages()[0] || await browser.newPage();

const visible = (sel, ms) => page.locator(sel).first()
  .waitFor({ state: 'visible', timeout: ms || 10000 }).then(() => true).catch(() => false);

try {
  if (!QUIET) console.log('\nsigning in check');

  /* 1. the saved session still works, and is the right account */
  await page.goto(`${IG}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await igDismiss(page);
  const signedIn = (await page.context().cookies(IG)).some((c) => c.name === 'ds_user_id');
  check('the saved Instagram session is still valid', signedIn,
    signedIn ? '' : 'run tools/instagram/post.mjs --login');

  /* The cookie being there does NOT mean the session is usable. Instagram can
     park it behind a "Continue as you" screen, and then every page returns
     that screen - which reads, one check at a time, as though Instagram
     renamed its entire website. It happened on 2026-08-04 and cost nine
     confusing failures before a screenshot explained it. Named first now, and
     cleared, so the checks below test the real pages. */
  let parked = false;
  try {
    const cleared = await resumeSession(page, want);
    check('the session is not parked on a "Continue as you" screen', true,
      cleared ? 'it was - pressed Continue, carrying on' : 'no interstitial');
    if (cleared) await page.waitForTimeout(3000);
  } catch (e) {
    parked = true;
    check('the session is not parked on a "Continue as you" screen', false, 'it is, and Continue did not clear it');
  }
  if (parked) {
    /* Every check below reads a page that is not there. Reporting twelve
       separate failures would hide the one fact that matters. */
    console.error('\n' + SESSION_PARKED + '\n');
    throw new Error('stopped early: ' + SESSION_PARKED.split('.')[0]);
  }

  const who = await page.evaluate(() => {
    const img = document.querySelector('a[href^="/"] img[alt*="profile picture" i]');
    const a = img && img.closest('a');
    const m = a && (a.getAttribute('href') || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
    return m ? m[1] : '';
  }).catch(() => '');
  check(`we can still read which account we are (@${want})`, who.toLowerCase() === want, who ? '@' + who : 'could not read it');

  if (!QUIET) console.log('\nsending a DM');

  /* 3-5. Opening a thread is the real openThread() from the notifier, so this
     fails when the NOTIFIER would fail, and not one moment sooner. The probe
     account is only opened - nothing is typed into it beyond one character to
     make the Send button appear, and that is wiped again. */
  let threadOpen = false, composer = false, sendBtn = false;
  try {
    await openThread(page, PROBE);
    threadOpen = /\/direct\/t\/\d+/.test(page.url());
  } catch (e) {
    check('the new-message search finds an account and opens its thread', false, e.message.split('\n')[0]);
  }
  if (threadOpen) check('the new-message search finds an account and opens its thread', true, 'openThread() from notify.mjs');

  if (threadOpen) {
    try {
      await typeDm(page, PROBE_WORD);          // the real typer: Shift+Enter, never a bare Enter
      composer = true;
      await page.waitForTimeout(1200);
      sendBtn = await page.locator('div[role="button"][aria-label="Send"]').first().count() > 0;
    } catch (e) {
      check('the message box is still where we type', false, e.message.split('\n')[0]);
    } finally {
      await clearBox(page).catch(() => {});    // wipe it before anything can leave
      await page.waitForTimeout(500);
    }
  }
  if (composer) check('the message box is still where we type', true, 'div[role="textbox"][contenteditable="true"]');
  check('the Send button still appears once there is text', sendBtn, 'aria-label="Send"');
  const leftover = threadOpen
    ? await page.locator('div[role="textbox"][contenteditable="true"]').first().innerText().catch(() => '')
    : '';
  check('the probe text was wiped, so nothing can be sent by accident', !leftover.trim(), JSON.stringify(leftover));

  if (!QUIET) console.log('\nfollowing someone');

  /* 7-9. a profile: the follow button, the post grid, the private wording */
  await page.goto(`${IG}/${PROBE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await igDismiss(page);
  const headerLabels = await page.evaluate(() => {
    const h = document.querySelector('header');
    return h ? [...h.querySelectorAll('button, div[role="button"]')].filter((e) => e.offsetParent)
      .map((e) => (e.innerText || '').trim()).filter(Boolean) : [];
  });
  const followable = headerLabels.some((t) => followButtonRx().test(t));
  check(`the Follow button is still findable on a profile`, followable,
    followable ? headerLabels.find((t) => followButtonRx().test(t)) : 'header said: ' + headerLabels.slice(0, 4).join(' / '));
  check('none of our follow labels would hit "Following" by mistake',
    !FOLLOW_LABELS.some((l) => followButtonRx().test('Following') && l), true);

  const tiles = await page.evaluate((h) => {
    const scope = document.querySelector('main') || document.body;
    return [...scope.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].filter((e) => e.offsetParent)
      .map((e) => e.getAttribute('href') || '')
      .filter((href) => href.startsWith('/' + h + '/') || /^\/(p|reel)\//.test(href)).length;
  }, PROBE);
  check('their posts are still findable in the grid', tiles > 0, tiles + ' posts');

  if (!QUIET) console.log('\ncommenting');

  /* 10-11. the comment box and its Post button, which only exists after typing */
  let commentBox = false, postBtn = false;
  if (tiles > 0) {
    const first = await page.evaluate((h) => {
      const scope = document.querySelector('main') || document.body;
      const a = [...scope.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')].filter((e) => e.offsetParent)
        .map((e) => e.getAttribute('href') || '')
        .filter((href) => href.startsWith('/' + h + '/') || /^\/(p|reel)\//.test(href))[0];
      return a || '';
    }, PROBE);
    await page.goto(IG + first, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    commentBox = await visible('textarea[placeholder^="Add a comment"]', 12000);
    if (commentBox) {
      const box = page.locator('textarea[placeholder^="Add a comment"]').first();
      await box.click();
      await box.fill(PROBE_WORD);     // fill never presses a key, so it cannot post
      await page.waitForTimeout(1500);
      postBtn = await page.locator('form:has(textarea[placeholder^="Add a comment"])')
        .getByRole('button', { name: 'Post', exact: true }).first().count() > 0;
      await box.fill('');
    }
  }
  check('the comment box is still on a post', commentBox, 'textarea[placeholder^="Add a comment"]');
  check('the comment Post button still appears once there is text', postBtn, 'role=button named Post');

  if (!QUIET) console.log('\nour own profile');

  /* 12-13. the bio field and its save button */
  await page.goto(`${IG}/accounts/edit/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const bioBox = await visible('textarea[placeholder="Bio"]', 12000);
  check('our bio field is still editable', bioBox, 'textarea[placeholder="Bio"]');
  const submit = await page.locator('div[role="button"]').filter({ hasText: /^Submit$/ }).first().count() > 0;
  check('the bio Save button is still there', submit, 'div[role=button] "Submit"');

  const bioLive = bioBox && await page.locator('textarea[placeholder="Bio"]').first().inputValue().catch(() => '');
  check('our live bio still points people at their requests', /request/i.test(bioLive || ''),
    (bioLive || '').split('\n')[0]);

  /* 14. the private-account wording, if a known private handle is configured */
  const privHandle = (CONFIG.outreach || {}).healthPrivateHandle;
  if (privHandle) {
    await page.goto(`${IG}/${String(privHandle).replace(/^@/, '')}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    const txt = await page.evaluate(() => document.body.innerText || '');
    check('a private account is still recognised as private', PRIVATE_RX.test(txt), '@' + privHandle);
  } else if (!QUIET) {
    console.log('  --   private-account wording not checked (no healthPrivateHandle in config.json)');
  }
} catch (err) {
  check('the health check itself ran to the end', false, err.message.split('\n')[0]);
  await page.screenshot({ path: path.join(HERE, 'health-failure.png') }).catch(() => {});
} finally {
  await browser.close();
}

/* The brake state is worth reporting even though it is not a selector: an
   automation that is paused is also an automation that is not delivering. */
const st = loadLog()[STATE_KEY];
const paused = !!(st && st.coolOffUntil && new Date(st.coolOffUntil) > new Date());

const failed = results.filter((r) => !r.ok);
const report = {
  at: new Date().toISOString(),
  ok: failed.length === 0,
  passed: results.length - failed.length,
  total: results.length,
  paused, pausedUntil: paused ? st.coolOffUntil : null, pausedReason: paused ? st.coolOffReason : null,
  failures: failed.map((r) => r.name + (r.detail ? ' - ' + r.detail : '')),
  checks: results
};
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));

if (failed.length) {
  console.error(`\nINSTAGRAM AUTOMATION IS BROKEN - ${failed.length} of ${results.length} checks failed:`);
  for (const f of failed) console.error('  - ' + f.name + (f.detail ? '  (' + f.detail + ')' : ''));
  console.error(`\nMessages are probably not going out. Full report: ${REPORT}`);
  /* Two very different causes, two very different fixes. Printing the selector
     advice when the real problem is a parked session sends you hunting for a
     rename that never happened. */
  if (!results.some((r) => !r.ok && /parked/.test(r.name)))
    console.error('Instagram most likely renamed something. Look at the failing check and re-read the live page.\n');
} else if (!QUIET) {
  console.log(`\nall ${results.length} checks pass - the Instagram automation still works.`);
  if (paused) console.log(`note: outreach is PAUSED until ${st.coolOffUntil} (${st.coolOffReason}). Lift it with --resume.`);
  console.log(`report: ${REPORT}\n`);
}
process.exit(failed.length ? 1 : 0);
