/**
 * The Instagram page steps that more than one tool needs.
 *
 * These lived inside notify.mjs, which meant the health check had to
 * re-implement them - and a health check that re-implements the thing it is
 * checking tests the copy, not the tool. It reported the DM composer as broken
 * on its first run for exactly that reason, while the real notifier was fine.
 * One copy now, imported by notify.mjs, outreach.mjs and health.mjs.
 *
 * Every selector here was read off the live Instagram DOM (G27). The comments
 * that look like warnings are warnings: they are each a bug that happened.
 */

export async function dismissPopups(page) {
  for (const label of ['Not now', 'Not Now', 'Cancel', 'Dismiss']) {
    const b = page.getByRole('button', { name: label, exact: true });
    if (await b.count() && await b.first().isVisible().catch(() => false)) {
      await b.first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

/** Same identity check as post.mjs: refuse to act as the wrong account. */

export async function openThread(page, handle) {
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

export async function typeDm(page, text) {
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

/** Empty the composer without sending. Used by every dry run. */
export async function clearBox(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await page.keyboard.press('Backspace');
}

/**
 * Which account is this browser signed in as?
 *
 * There were three copies of this, and all three read one place on one page
 * after a fixed wait - so when Instagram's home page was slow, the answer came
 * back empty. The notifier treated empty as "carry on", which is the wrong way
 * round: not knowing which account you are is exactly when you must stop.
 *
 * Two places are read now (the nav avatar, then the settings page), each
 * retried, and an unreadable answer is an error rather than a shrug.
 */
/**
 * Instagram sometimes bumps a saved session to a "Continue as <you>" screen.
 * It is not a logout - the cookie is still there and the account is fine - but
 * every page you ask for returns that screen instead, so every selector in
 * every tool misses at once. Seen live 2026-08-04: nine health checks failed
 * together and it looked like Instagram had renamed half its website.
 *
 * Pressing Continue is the whole fix. It is our own profile, no password is
 * involved, and it is exactly what a person would click. The username on the
 * screen is checked first: if the face on that button is not us, nothing is
 * pressed, because "Use another profile" and "Create new account" sit right
 * next to it.
 */
export async function resumeSession(page, wanted) {
  const want = String(wanted).replace(/^@/, '').toLowerCase();
  for (let i = 0; i < 2; i++) {
    const seen = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      const btn = [...document.querySelectorAll('button, div[role="button"]')]
        .find((e) => e.offsetParent && (e.innerText || '').trim() === 'Continue');
      return { hasContinue: !!btn, text: txt.slice(0, 400) };
    }).catch(() => ({ hasContinue: false, text: '' }));
    if (!seen.hasContinue) return false;

    /* the name printed above the button has to be ours */
    const mine = new RegExp('(^|\\s)' + want.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'i').test(seen.text);
    if (!mine) throw new Error('Instagram is asking to continue as somebody else. Nothing was pressed. Run: node tools/instagram/post.mjs --login');

    await page.getByRole('button', { name: 'Continue', exact: true }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }
  /* Say honestly whether it worked. Seen 2026-08-04: the button is there, the
     click lands, and the screen simply stays - Instagram wants a real person's
     tap in a real window. Returning "cleared" then would have made every check
     below fail for a reason nobody could see. */
  const stillParked = await page.evaluate(() => [...document.querySelectorAll('button, div[role="button"]')]
    .some((e) => e.offsetParent && (e.innerText || '').trim() === 'Continue')).catch(() => false);
  if (stillParked) throw new Error(SESSION_PARKED);
  return true;
}

/* One string, so the tools and the health check describe this the same way. */
export const SESSION_PARKED =
  'Instagram has parked the saved session on its "Continue as _beatass_" screen and an automated click will not clear it. '
  + 'Nothing is wrong with the account: there is no password prompt and no security check. '
  + 'Fix it in about 20 seconds: run  node tools/instagram/post.mjs --login  which opens a real window on the same session, '
  + 'press Continue there, close the window. Everything resumes by itself.';

export async function whoAmI(page, wanted) {
  const fromNav = () => page.evaluate(() => {
    const img = document.querySelector('a[href^="/"] img[alt*="profile picture" i]');
    const a = img && img.closest('a');
    const m = a && (a.getAttribute('href') || '').match(/^\/([A-Za-z0-9._]+)\/?$/);
    return m ? m[1] : '';
  }).catch(() => '');

  for (let i = 0; i < 3; i++) {
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000 + i * 3000);
    /* clear the "Continue as you" screen first - behind it, everything works */
    if (await resumeSession(page, wanted)) await page.waitForTimeout(3000);
    await dismissPopups(page);
    const who = await fromNav();
    if (who) return who;
  }
  /* Fallback: the settings page puts the username in a plain field. Slower,
     but it is there even when the home page has not finished painting. */
  await page.goto('https://www.instagram.com/accounts/edit/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const fromSettings = await page.evaluate(() => {
    const el = document.querySelector('input[id*="username" i], input[name="username"]');
    if (el && el.value) return el.value;
    const m = (document.body.innerText || '').match(/^\s*([A-Za-z0-9._]{2,30})\s*$/m);
    return m ? m[1] : '';
  }).catch(() => '');
  return fromSettings || '';
}

/** Stop unless we are the account we think we are. Acting as somebody else is
 *  the one mistake here that cannot be undone. */
export async function ensureAccount(page, wanted) {
  const want = String(wanted).replace(/^@/, '').toLowerCase();
  const signedIn = (await page.context().cookies('https://www.instagram.com')).some((c) => c.name === 'ds_user_id');
  if (!signedIn) throw new Error('not signed in to Instagram. Run: node tools/instagram/post.mjs --login');
  const who = await whoAmI(page, want);
  if (!who) throw new Error('could not read which account is signed in, so nothing was done. Try again, or run: node tools/instagram/post.mjs --login');
  if (who.toLowerCase() !== want) throw new Error(`signed in as "${who}" but config.json says "${wanted}". Refusing to act as the wrong account.`);
  return who;
}
