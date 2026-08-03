#!/usr/bin/env node
/**
 * Stages ONE image carousel in a visible window, stopped at the Share button -
 * a human reviews and presses Share (same safe flow as stage-reels.mjs).
 *
 *   node tools/instagram/stage-carousel.mjs --slides <dir> --caption <file.txt>
 *
 * Uploads every .jpg/.png in <dir> (numeric name order) as one post. Slides
 * pre-sized to 4:5 need no crop; the Select Crop toggle is still clicked when
 * present because the composer can default to square. Window stays open until
 * Ctrl-C. Mark posted in content/instagram/.posted.json yourself if queued.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null; };
const slidesDir = arg('slides');
const captionFile = arg('caption');
if (!slidesDir) { console.error('need --slides <dir>'); process.exit(1); }

const files = fs.readdirSync(slidesDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((f) => path.join(slidesDir, f));
if (!files.length) { console.error('no slides in ' + slidesDir); process.exit(1); }
const caption = captionFile ? fs.readFileSync(captionFile, 'utf8').trim() : CONFIG.caption;

const ctx = await chromium.launchPersistentContext(SESSION, { headless: false, viewport: { width: 1180, height: 900 } });
const page = await ctx.newPage();

async function dismissPopups() {
  for (const label of [/not now/i, /^cancel$/i]) {
    const b = page.getByRole('button', { name: label }).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
}

await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await dismissPopups();
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
await fileInput.setInputFiles(files);
await page.waitForTimeout(6000);
await dismissPopups();

const cropSvg = page.locator('svg[aria-label="Select Crop"], svg[aria-label="Select crop"]').first();
if (await cropSvg.count()) {
  await cropSvg.locator('xpath=ancestor::button[1]')
    .or(cropSvg.locator('xpath=ancestor::*[@role="button"][1]')).first().click().catch(() => {});
  await page.waitForTimeout(1200);
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
await box.type(caption, { delay: 8 });
console.log(`staged: ${files.length}-slide carousel - review the window and press Share.`);
console.log('WAIT in the tab until Instagram confirms. Window stays open until Ctrl-C.');
await new Promise(() => {});
