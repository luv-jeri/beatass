#!/usr/bin/env node
/**
 * Stages every unposted queue item in its OWN TAB of one visible window, each
 * stopped at the Share button with crop set to Original - a human reviews and
 * presses Share per tab. Born 2026-08-04: the auto-poster cropped reels and
 * closed the browser mid-upload; staging + human Share is the safe path.
 *
 *   node tools/instagram/stage-reels.mjs        stage all unposted items
 *
 * The window stays open until this script is Ctrl-C'd. Mark items posted in
 * content/instagram/.posted.json yourself after sharing.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');
const DIR = path.join(ROOT, CONFIG.contentDir);

const posted = fs.existsSync(path.join(DIR, '.posted.json'))
  ? JSON.parse(fs.readFileSync(path.join(DIR, '.posted.json'), 'utf8')) : {};
const files = fs.readdirSync(DIR)
  .filter((f) => /\.(mp4|mov|jpg|jpeg|png)$/i.test(f))
  .filter((f) => !posted[f])
  .sort();
if (!files.length) {
  console.log('nothing unposted in the queue.');
  process.exit(0);
}
const captionFor = (file) => {
  const sidecar = path.join(DIR, file.replace(/\.[^.]+$/, '.txt'));
  const text = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, 'utf8').trim() : CONFIG.caption;
  const tags = (CONFIG.hashtags || []).map((t) => '#' + t.replace(/^#/, '')).join(' ');
  return tags ? `${text}\n\n${tags}` : text;
};

const ctx = await chromium.launchPersistentContext(SESSION, {headless: false, viewport: {width: 1180, height: 900}});

async function dismissPopups(page) {
  for (const label of [/not now/i, /^cancel$/i]) {
    const b = page.getByRole('button', { name: label }).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
}

async function stage(page, file) {
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await dismissPopups(page);
  const create = page.getByRole('link', { name: /new post|create/i })
    .or(page.locator('svg[aria-label="New post"]')).first();
  await create.click({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('span, div')]
      .find((e) => (e.innerText || '').trim() === 'Post' && e.offsetParent && e.childElementCount === 0);
    const target = el && (el.closest('a,[role="button"],[role="link"],[role="menuitem"],button') || el);
    if (target) target.click();
  });
  await page.waitForTimeout(2500);
  const fileInput = page.locator('[role="dialog"] input[type="file"], form input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 20000 });
  await fileInput.setInputFiles(path.join(DIR, file));
  await page.waitForTimeout(6000);
  await dismissPopups(page);

  // THE CROP FIX (live-verified 2026-08-04): clicking the Select Crop button
  // toggles the preview straight to the full original frame — no menu. Without
  // it Instagram center-crops 9:16 reels to 4:5 and cuts the top off.
  const cropBtn = page.locator('svg[aria-label="Select Crop"], svg[aria-label="Select crop"]').first();
  await cropBtn.waitFor({ state: 'visible', timeout: 15000 });
  await cropBtn.locator('xpath=ancestor::button[1]')
    .or(cropBtn.locator('xpath=ancestor::*[@role="button"][1]')).first().click();
  await page.waitForTimeout(1200);
  const orig = page.getByText('Original', { exact: true }).first();
  if (await orig.isVisible().catch(() => false)) {
    await orig.click();
    await page.waitForTimeout(900);
  }

  for (const step of ['Next', 'Next']) {
    const b = page.getByRole('button', { name: step, exact: true }).first();
    await b.waitFor({ state: 'visible', timeout: 45000 });
    await b.click();
    await page.waitForTimeout(2500);
  }
  const box = page.getByRole('textbox', { name: /caption/i })
    .or(page.locator('div[contenteditable="true"]')).first();
  await box.waitFor({ state: 'visible', timeout: 30000 });
  await box.click();
  await box.type(captionFor(file), { delay: 8 });
  console.log(`  staged: ${file} — review the tab and press Share`);
}

const pages = [];
for (const file of files) {
  const page = await ctx.newPage();
  try {
    await stage(page, file);
    pages.push(page);
  } catch (e) {
    console.error(`  ${file}: FAILED to stage — ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: path.join(HERE, 'last-failure.png') }).catch(() => {});
  }
}
console.log(`\n— ${pages.length}/${files.length} STAGED in separate tabs. Review each, press Share, and`);
console.log('  WAIT in each tab until Instagram confirms. Window stays open until Ctrl-C.');
setInterval(() => {}, 60000); // real keepalive - a bare unsettled await lets node exit
await new Promise(() => {});
