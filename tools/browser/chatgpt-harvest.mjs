#!/usr/bin/env node
/**
 * Harvests already-generated images out of recent ChatGPT chats - for when a
 * runner submitted fine but its download step failed (selector rot, timeout).
 * Matches each chat to a job by prompt text, saves the assistant's image.
 *
 *   node tools/browser/chatgpt-harvest.mjs --jobs jobs.json --out dir [--recents 10]
 */
import fs from 'fs';
import path from 'path';
import {connect, saveFromPage, sleep} from './lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const jobs = JSON.parse(fs.readFileSync(opt('jobs'), 'utf8'));
const outDir = opt('out', 'harvest');
const recents = Number(opt('recents', 10));
fs.mkdirSync(outDir, {recursive: true});

const {browser, context} = await connect();
const page = await context.newPage();
await page.goto('https://chatgpt.com/', {waitUntil: 'domcontentloaded'});
await sleep(6000);
const chats = await page.evaluate((n) => [...document.querySelectorAll('a[href^="/c/"]')]
  .slice(0, n).map((a) => a.getAttribute('href')), recents);
console.log(`${chats.length} recent chats, ${jobs.length} jobs to match`);

const found = {};
for (const href of chats) {
  if (Object.keys(found).length === jobs.length) break;
  // Direct /c/ URLs render only the shell; navigate by clicking the sidebar link.
  const ok = await page.evaluate((h) => {
    const a = [...document.querySelectorAll('a[href^="/c/"]')].find((x) => x.getAttribute('href') === h);
    if (a) a.click();
    return !!a;
  }, href);
  if (!ok) continue;
  await sleep(9000);
  // Images lazy-mount only when scrolled into view (bitten 2026-08-04).
  await page.mouse.wheel(0, 1200);
  await sleep(3500);
  const data = await page.evaluate(() => {
    const user = [...document.querySelectorAll('[data-message-author-role="user"]')]
      .map((e) => e.innerText).join(' ');
    // Generated images live in the turn but OUTSIDE any author-role wrapper;
    // only the user's own upload sits under role="user" (checked 2026-08-04).
    const imgs = [...document.querySelectorAll('img[src*="estuary/content"], img[src*="oaiusercontent"]')]
      .filter((i) => !i.closest('[data-message-author-role="user"]'));
    return {user, src: imgs.length ? imgs[imgs.length - 1].src : null};
  });
  // Match on text AFTER the shared style-lock prefix - every prompt opens with
  // the same ~230 chars, so an early slice matches the wrong job.
  const uniq = (p) => (p.split('portrait,')[1] || p).slice(5, 70);
  const job = jobs.find((j) => !found[j.name] && data.user.includes(uniq(j.prompt)));
  if (!job) { console.log(`  ${href}: no job match`); continue; }
  if (!data.src) { console.log(`  ${href}: matched ${job.name} but NO image`); continue; }
  const out = path.join(outDir, `${job.name}.png`);
  const size = await saveFromPage(page, data.src, out);
  found[job.name] = true;
  console.log(`  ${job.name}: saved (${(size / 1e6).toFixed(1)} MB)`);
  await page.goto('https://chatgpt.com/', {waitUntil: 'domcontentloaded'});
  await sleep(5000);
}
const missing = jobs.filter((j) => !found[j.name]).map((j) => j.name);
console.log(missing.length ? `MISSING: ${missing.join(', ')}` : 'all jobs harvested.');
await browser.close();
process.exit(missing.length ? 1 : 0);
