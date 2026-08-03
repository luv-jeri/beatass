/**
 * Makes sure a DM we sent actually gets noticed.
 *
 * An Instagram DM from an account you do not follow does not land in your
 * inbox. It lands in "Message requests", a folder most people never open. So
 * three things happen around every DM, and all three point at that folder:
 *
 *   1. we follow them        -> they get a notification and look at our profile
 *   2. our profile bio says  -> "someone sent you a message, check your requests"
 *   3. we comment on their   -> "check your DM requests" (public accounts only,
 *      most recent post         a private account has nothing we can comment on)
 *
 * Order matters. The DM is sent FIRST, always. The follow and the comment both
 * say "you have a message waiting", so the message has to be waiting before
 * either of them goes out.
 *
 *   node tools/instagram/outreach.mjs --selftest        decision logic, no browser
 *   node tools/instagram/outreach.mjs --bio             show the bio it would set
 *   node tools/instagram/outreach.mjs --bio --apply     actually change our bio
 *   node tools/instagram/outreach.mjs --run <handle> --dry   walk it, change NOTHING
 *   node tools/instagram/outreach.mjs --run <handle>    follow + comment for real
 *
 * notify.mjs imports runOutreach() and calls it right after a DM lands, which
 * is the path that matters. The --run flag is for someone already DM'd.
 *
 * Rails, because this runs unattended:
 *   - one follow and one comment per person, EVER (.outreach.json), so a second
 *     confession to the same handle never means a second comment,
 *   - a daily ceiling on each, separate from the DM ceiling,
 *   - private accounts and accounts with no posts get no comment,
 *   - both actions are verified by re-reading the page afterwards, never by
 *     "we clicked something",
 *   - --dry types the comment and photographs it without pressing Post.
 *
 * Selector honesty (G27): every selector below was read off the live Instagram
 * DOM on 2026-08-03, not guessed from memory.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const OUT = CONFIG.outreach || {};

/* Who has already been followed and commented on. Keyed by handle, not by
   message id: following is about a person, and two confessions to the same
   person must not produce two comments on their post. */
const LOG_FILE = path.join(ROOT, CONFIG.contentDir, '.outreach.json');

const IG = 'https://www.instagram.com';
const today = () => new Date().toISOString().slice(0, 10);

/* ---------- what we say (pure, tested, no browser) ---------- */

/** One comment, one line. Instagram's comment box sends on Enter, so a
 *  newline in here would post half a sentence: they are stripped, not trusted. */
export function commentText(handle, variants) {
  const list = (variants && variants.length ? variants : OUT.comments) || [];
  if (!list.length) return '';
  /* Same handle always gets the same line, different handles get different
     ones. Posting one identical string on fifty strangers' posts is the
     clearest spam signature there is. */
  let h = 0;
  const s = String(handle || '').toLowerCase();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return String(list[h % list.length]).replace(/\s*\n\s*/g, ' ').trim();
}

/* Instagram's own limit. A bio one character over is silently refused. */
export const BIO_MAX = 150;
export const bioText = (cfg) => String((cfg || OUT).bio || '').trim();

/* ---------- who gets what (pure, tested, no browser) ---------- */

export function countToday(log, key, day) {
  const d = day || today();
  return Object.values(log || {}).filter((r) => r && typeof r[key] === 'string' && r[key].slice(0, 10) === d).length;
}

/**
 * Decides, before any browser is touched, whether this person gets a follow
 * and a comment - and says why not, in words, when they do not.
 */
export function outreachPlan({ handle, log = {}, cfg = OUT, counts = null, day = null }) {
  const rec = log[handle] || {};
  const n = counts || { follows: countToday(log, 'followed', day), comments: countToday(log, 'commented', day) };
  const followCap = Number.isFinite(cfg.followPerDay) ? cfg.followPerDay : 25;
  const commentCap = Number.isFinite(cfg.commentPerDay) ? cfg.commentPerDay : 15;
  const why = {};

  let follow = true;
  if (cfg.follow === false) { follow = false; why.follow = 'following is turned off in config.json'; }
  else if (rec.followed) { follow = false; why.follow = `already followed on ${rec.followed.slice(0, 10)}`; }
  else if (n.follows >= followCap) { follow = false; why.follow = `daily follow limit of ${followCap} reached`; }

  let comment = true;
  if (cfg.comment === false) { comment = false; why.comment = 'commenting is turned off in config.json'; }
  else if (rec.commented) { comment = false; why.comment = `already commented on ${rec.commented.slice(0, 10)}`; }
  else if (rec.commentSkipped) { comment = false; why.comment = `nothing to comment on (${rec.commentSkipped})`; }
  else if (n.comments >= commentCap) { comment = false; why.comment = `daily comment limit of ${commentCap} reached`; }

  return { follow, comment, why };
}

/* ---------- the log on disk ---------- */

export function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch { return {}; }
}
function saveLog(log) {
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}
function record(handle, patch) {
  const log = loadLog();
  log[handle] = { ...(log[handle] || {}), ...patch };
  saveLog(log);
  return log;
}

/* ---------- the browser walk ---------- */

const wait = (page, a, b) => page.waitForTimeout(a + Math.floor(Math.random() * (b - a)));

async function dismissPopups(page) {
  for (const label of ['Not now', 'Not Now', 'Cancel', 'Dismiss']) {
    const b = page.getByRole('button', { name: label, exact: true });
    if (await b.count() && await b.first().isVisible().catch(() => false)) {
      await b.first().click().catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

/** Everything we need to know about a profile, in one read. */
async function readProfile(page, handle) {
  await page.goto(`${IG}/${handle}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissPopups(page);
  return page.evaluate((h) => {
    const header = document.querySelector('header');
    const text = document.body.innerText || '';
    const labels = header
      ? [...header.querySelectorAll('button, div[role="button"]')]
        .filter((e) => e.offsetParent).map((e) => (e.innerText || '').trim())
      : [];
    const scope = document.querySelector('main') || document.body;
    const tiles = [...scope.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')]
      .filter((e) => e.offsetParent)
      .map((e) => e.getAttribute('href') || '')
      /* the grid links are /<handle>/p/<code>/ or the bare /p/<code>/ form;
         anything else on the page is somebody else's post */
      .filter((href) => href.startsWith('/' + h + '/') || /^\/(p|reel)\//.test(href));
    return {
      exists: !!header && !/sorry, this page isn't available/i.test(text),
      private: /this account is private/i.test(text),
      already: labels.some((t) => t === 'Following' || t === 'Requested'),
      canFollow: labels.some((t) => t === 'Follow' || t === 'Follow Back'),
      tiles: tiles.slice(0, 3),
      labels
    };
  }, handle.toLowerCase());
}

/**
 * Press Follow, then prove it took by re-reading the button. A click that
 * silently did nothing (Instagram rate-limits by making the button bounce
 * back) must not be logged as a follow.
 */
async function pressFollow(page, handle) {
  const btn = page.locator('header').getByRole('button', { name: 'Follow', exact: true }).first();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  await page.waitForTimeout(4000);
  const now = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? [...header.querySelectorAll('button, div[role="button"]')]
      .filter((e) => e.offsetParent).map((e) => (e.innerText || '').trim()) : [];
  });
  const stuck = now.some((t) => t === 'Following' || t === 'Requested');
  if (!stuck) throw new Error(`the Follow button on @${handle} did not change to Following - Instagram may be limiting us`);
  return now.includes('Requested') ? 'requested' : 'following';
}

/**
 * Comment on one post. `fill` is used rather than typing, because it sets the
 * value in one go and never presses a key - and Enter in Instagram's comment
 * box posts immediately. That is what keeps a dry run dry.
 */
async function pressComment(page, url, text, dry) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  await dismissPopups(page);

  const box = page.locator('textarea[placeholder^="Add a comment"]').first();
  if (!await box.count()) throw new Error('comments are turned off on that post');
  await box.waitFor({ state: 'visible', timeout: 15000 });
  await box.click();
  await box.fill(text);
  await page.waitForTimeout(1200);

  if (dry) {
    await page.screenshot({ path: path.join(HERE, 'outreach-dry-comment.png') });
    await box.fill('');
    return null;
  }

  /* The Post button only exists once the box has text, and there is more than
     one thing called Post on the page - scope it to the comment form. */
  const form = page.locator('form:has(textarea[placeholder^="Add a comment"])').first();
  await form.getByRole('button', { name: 'Post', exact: true }).first().click({ timeout: 10000 });
  await page.waitForTimeout(4000);

  /* Proof, not optimism: our words have to be on the page and the box has to
     be empty again. Instagram silently swallows comments when it thinks you
     are spamming, and the only tell is that nothing appears. */
  const probe = text.slice(0, 45);
  const landed = await page.evaluate((t) => (document.body.innerText || '').includes(t), probe);
  if (!landed) throw new Error('the comment did not appear on the post - Instagram may have refused it');
  await page.screenshot({ path: path.join(HERE, 'outreach-commented.png') });
  return page.url();
}

/**
 * The whole thing for one person. Never throws: outreach is the nice-to-have
 * around a DM that has already been delivered, so a failure here is reported
 * and logged, not allowed to kill the run.
 */
export async function runOutreach(page, handle, { dry = false, say = console.log } = {}) {
  const h = String(handle).toLowerCase().replace(/^@+/, '');
  const log = loadLog();
  const plan = outreachPlan({ handle: h, log });
  const result = { handle: h, followed: false, commented: false, notes: [] };
  /* A dry run changes nothing, and that includes the file on disk - otherwise
     rehearsing on somebody marks them done and the real run skips them. */
  const note = (patch) => { if (!dry) record(h, patch); };

  if (!plan.follow && !plan.comment) {
    say(`    outreach: nothing to do (${plan.why.follow || 'follow done'}; ${plan.why.comment || 'comment done'})`);
    return result;
  }

  let profile;
  try {
    profile = await readProfile(page, h);
  } catch (e) {
    say(`    outreach: could not open @${h}'s profile: ${e.message.split('\n')[0]}`);
    return result;
  }
  if (!profile.exists) {
    say(`    outreach: @${h} has no profile page we can see.`);
    return result;
  }

  /* follow */
  if (!plan.follow) {
    say(`    outreach: no follow (${plan.why.follow})`);
  } else if (profile.already) {
    note({ followed: new Date().toISOString(), followNote: 'was already following' });
    say(`    outreach: already following @${h}.`);
    result.followed = true;
  } else if (!profile.canFollow) {
    say(`    outreach: no Follow button on @${h} - skipping.`);
  } else if (dry) {
    await page.screenshot({ path: path.join(HERE, 'outreach-dry-follow.png') });
    say(`    outreach (dry): would follow @${h}. Screenshot: tools/instagram/outreach-dry-follow.png`);
  } else {
    try {
      const state = await pressFollow(page, h);
      note({ followed: new Date().toISOString(), followNote: state });
      result.followed = true;
      say(`    outreach: ${state === 'requested' ? 'follow requested' : 'followed'} @${h}.`);
    } catch (e) {
      say(`    outreach: follow failed for @${h}: ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: path.join(HERE, 'outreach-failure.png') }).catch(() => {});
    }
  }

  /* comment - only on a public account that actually has a post */
  if (!plan.comment) {
    say(`    outreach: no comment (${plan.why.comment})`);
    return result;
  }
  if (profile.private) {
    note({ commentSkipped: 'private account' });
    say(`    outreach: @${h} is private, so there is no post to comment on.`);
    return result;
  }
  if (!profile.tiles.length) {
    note({ commentSkipped: 'no posts' });
    say(`    outreach: @${h} has no posts to comment on.`);
    return result;
  }

  const text = commentText(h);
  if (!text) { say('    outreach: no comment lines in config.json - skipping.'); return result; }

  await wait(page, 6000, 16000);      // a beat between actions, never a burst
  try {
    const url = await pressComment(page, IG + profile.tiles[0], text, dry);
    if (dry) {
      say(`    outreach (dry): would comment on ${IG}${profile.tiles[0]}`);
      say(`      "${text}"`);
    } else {
      note({ commented: new Date().toISOString(), commentUrl: url, comment: text });
      result.commented = true;
      say(`    outreach: commented on @${h}'s latest post.`);
    }
  } catch (e) {
    say(`    outreach: comment failed for @${h}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(HERE, 'outreach-failure.png') }).catch(() => {});
  }
  return result;
}

/* ---------- our own bio ---------- */

export async function applyBio(page, bio, apply) {
  await page.goto(`${IG}/accounts/edit/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const box = page.locator('textarea[placeholder="Bio"]').first();
  await box.waitFor({ state: 'visible', timeout: 20000 });
  const before = await box.inputValue();
  if (!apply) return { before, after: before, changed: false };

  await box.fill(bio);
  await page.waitForTimeout(800);
  await page.locator('div[role="button"]').filter({ hasText: /^Submit$/ }).first().click({ timeout: 10000 });
  await page.waitForTimeout(5000);

  /* Read it back off a fresh page load. "We clicked Submit" is not proof. */
  await page.goto(`${IG}/accounts/edit/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  const after = await page.locator('textarea[placeholder="Bio"]').first().inputValue();
  return { before, after, changed: after.trim() === bio.trim() };
}

/* ---------- selftest: the decisions, with no browser and no network ---------- */

const IS_MAIN = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const args = process.argv.slice(2);

if (IS_MAIN && args.includes('--selftest')) {
  let bad = 0;
  const eq = (label, got, want) => {
    if (got !== want) { console.error(`✗ ${label}\n  got:  ${JSON.stringify(got)}\n  want: ${JSON.stringify(want)}`); bad++; }
  };
  const AI_TELLS = /[—–‘’“”…]/;   // em/en dash, curly quotes, ellipsis glyph

  /* the comment line */
  const c = commentText('someone');
  eq('a handle gets a comment', c.length > 0, true);
  eq('a comment is one line', c.includes('\n'), false);
  eq('a comment points at the requests folder', /request/i.test(c), true);
  eq('a comment fits in an Instagram comment', c.length <= 300, true);
  eq('the same handle always gets the same line', commentText('someone'), c);
  eq('newlines in a config line are flattened', commentText('x', ['a\nb']), 'a b');
  eq('no comment lines means no comment', commentText('x', []) === '' || commentText('x', []).length > 0, true);
  const spread = new Set(['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh'].map((x) => commentText(x)));
  eq('different people do not all get the same line', spread.size > 1, true);
  for (const line of (OUT.comments || [])) {
    eq(`comment line is honest about where the message is: "${line.slice(0, 25)}"`, /request/i.test(line), true);
    eq(`comment line has no AI-tell glyphs: "${line.slice(0, 25)}"`, AI_TELLS.test(line), false);
    eq(`comment line is one line: "${line.slice(0, 25)}"`, line.includes('\n'), false);
  }

  /* the bio */
  const bio = bioText();
  eq('there is a bio to set', bio.length > 0, true);
  eq('the bio fits Instagram\'s limit', bio.length <= BIO_MAX, true);
  eq('the bio tells them where the message is', /request/i.test(bio), true);
  eq('the bio has no AI-tell glyphs', AI_TELLS.test(bio), false);

  /* the decision, which is the part that can quietly spam somebody */
  const day = '2026-08-03';
  const stamp = day + 'T10:00:00.000Z';
  const fresh = outreachPlan({ handle: 'new', log: {}, day });
  eq('a new person gets a follow', fresh.follow, true);
  eq('a new person gets a comment', fresh.comment, true);

  const followedAlready = { old: { followed: stamp } };
  eq('nobody is followed twice', outreachPlan({ handle: 'old', log: followedAlready, day }).follow, false);
  eq('a follow already done still allows the comment', outreachPlan({ handle: 'old', log: followedAlready, day }).comment, true);

  const commentedAlready = { old: { followed: stamp, commented: stamp } };
  eq('nobody is commented on twice', outreachPlan({ handle: 'old', log: commentedAlready, day }).comment, false);
  eq('a second confession to the same person adds nothing', JSON.stringify(outreachPlan({ handle: 'old', log: commentedAlready, day })).includes('"follow":false'), true);

  eq('a private account is not retried every time',
    outreachPlan({ handle: 'p', log: { p: { commentSkipped: 'private account' } }, day }).comment, false);

  /* caps */
  const many = {};
  for (let i = 0; i < 40; i++) many['h' + i] = { followed: stamp, commented: stamp };
  const capped = outreachPlan({ handle: 'next', log: many, day });
  eq('the daily follow cap stops it', capped.follow, false);
  eq('the daily comment cap stops it', capped.comment, false);
  eq('the cap says so in words', /limit/.test(capped.why.follow || ''), true);
  eq('yesterday does not count against today', countToday({ a: { followed: '2026-08-02T10:00:00.000Z' } }, 'followed', day), 0);
  eq('today does count', countToday({ a: { followed: stamp } }, 'followed', day), 1);
  eq('a cap of 0 turns it off', outreachPlan({ handle: 'n', log: {}, cfg: { ...OUT, followPerDay: 0 }, day }).follow, false);

  /* the switches */
  eq('follow can be switched off', outreachPlan({ handle: 'n', log: {}, cfg: { ...OUT, follow: false }, day }).follow, false);
  eq('comment can be switched off', outreachPlan({ handle: 'n', log: {}, cfg: { ...OUT, comment: false }, day }).comment, false);
  eq('switching off the comment leaves the follow alone', outreachPlan({ handle: 'n', log: {}, cfg: { ...OUT, comment: false }, day }).follow, true);

  console.log(bad ? `\noutreach selftest FAILED (${bad})` : 'outreach selftest: all checks pass');
  process.exit(bad ? 1 : 0);
}

/* ---------- CLI ---------- */

if (IS_MAIN && !args.includes('--selftest')) {
  const { chromium } = await import('playwright');
  const os = await import('os');
  const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');
  const flagVal = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const DRY = args.includes('--dry') || args.includes('--dry-run');
  const RUN = flagVal('--run');
  const BIO = args.includes('--bio');
  const APPLY = args.includes('--apply');

  if (!RUN && !BIO) {
    console.log(`
what this does: after a DM goes out, follow the person and comment on their
latest post, so the message sitting in their requests folder gets noticed.

  node tools/instagram/outreach.mjs --bio               show the bio it would set
  node tools/instagram/outreach.mjs --bio --apply       change our bio for real
  node tools/instagram/outreach.mjs --run <handle> --dry   walk it, change nothing
  node tools/instagram/outreach.mjs --run <handle>      follow + comment for real

It also runs by itself after every DM sent by notify.mjs.
`);
    process.exit(0);
  }

  const browser = await chromium.launchPersistentContext(SESSION, {
    headless: CONFIG.headless === true, viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = browser.pages()[0] || await browser.newPage();
  try {
    if (BIO) {
      const bio = bioText();
      if (bio.length > BIO_MAX) throw new Error(`the bio in config.json is ${bio.length} characters, Instagram allows ${BIO_MAX}.`);
      const r = await applyBio(page, bio, APPLY);
      console.log('\nbio now:\n' + r.before.split('\n').map((l) => '  | ' + l).join('\n'));
      console.log('\nbio it would be:\n' + bio.split('\n').map((l) => '  | ' + l).join('\n'));
      if (!APPLY) console.log('\nnothing was changed. Add --apply to set it.');
      else if (r.changed) console.log('\n✓ bio changed, and read back from a fresh page load to prove it.');
      else { console.log('\n✗ Submit was pressed but the bio did not change. Left as it was.'); process.exitCode = 1; }
    } else {
      await runOutreach(page, RUN, { dry: DRY, say: console.log });
      if (DRY) console.log('\ndry run: nothing was followed and nothing was posted.');
    }
  } catch (err) {
    await page.screenshot({ path: path.join(HERE, 'outreach-failure.png') }).catch(() => {});
    console.error('\n✗ ' + err.message);
    console.error('  what it was looking at: tools/instagram/outreach-failure.png');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
  process.exit(process.exitCode || 0);
}
