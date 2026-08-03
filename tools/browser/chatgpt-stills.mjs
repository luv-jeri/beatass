#!/usr/bin/env node
// ChatGPT still generator: runs each job in its own chat tab, in parallel.
//
//   node tools/browser/chatgpt-stills.mjs --jobs jobs.json --board ref.png --out frames/ [--parallel 3]
//
// jobs.json: [{"name": "scene-1-v2", "prompt": "..."}, ...]
// The board image (style reference) is uploaded to every chat before the
// prompt. Output lands as <out>/<name>.png.
//
// Prereqs: bash tools/browser/launch-chrome.sh + logged into chatgpt.com once.
import fs from 'fs';
import path from 'path';
import {connect, saveFromPage, sleep} from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};

const jobsFile = opt('jobs');
if (!jobsFile) {
  console.error('Usage: chatgpt-stills.mjs --jobs jobs.json [--board ref.png] --out dir [--parallel 3]');
  process.exit(1);
}
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const board = opt('board');
const outDir = opt('out', 'frames');
const parallel = Number(opt('parallel', 3));
fs.mkdirSync(outDir, {recursive: true});
console.log(`${jobs.length} stills, ${parallel} tabs at a time${board ? `, board: ${board}` : ''}`);

async function typeInComposer(page, text) {
  // First click after a file upload never focuses the composer — click,
  // probe with one char, retry once if it landed nowhere (bitten 2026-08-03).
  const composer = page.locator('#prompt-textarea');
  for (let attempt = 0; attempt < 3; attempt++) {
    await composer.click();
    await page.keyboard.type('.');
    const got = await composer.evaluate((el) => el.textContent.length);
    if (got > 0) {
      await page.keyboard.press('Backspace');
      await page.keyboard.type(text);
      return;
    }
    await sleep(1500);
  }
  throw new Error('composer never took focus');
}

async function runJob(context, job) {
  const page = await context.newPage();
  try {
    await page.goto('https://chatgpt.com/', {waitUntil: 'domcontentloaded'});
    await page.locator('#prompt-textarea').waitFor({timeout: 30000});

    if (board) {
      await page.setInputFiles('input[type="file"]', board);
      await sleep(6000); // let the upload finish processing
    }
    await typeInComposer(page, job.prompt);
    await page.keyboard.press('Enter');

    // Poll until generation finishes (stop button gone) and an image exists.
    const deadline = Date.now() + 5 * 60 * 1000;
    let src = null;
    while (Date.now() < deadline) {
      await sleep(5000);
      const busy = await page.locator('[data-testid="stop-button"]').isVisible().catch(() => false);
      if (busy) continue;
      src = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('img[src*="oaiusercontent"], img[src^="blob:"]')];
        return imgs.length ? imgs[imgs.length - 1].src : null;
      });
      if (src) break;
    }
    if (!src) throw new Error('no generated image after 5 min');

    const out = path.join(outDir, `${job.name}.png`);
    const size = await saveFromPage(page, src, out);
    console.log(`  ${job.name}: saved ${out} (${(size / 1e6).toFixed(1)} MB)`);
    return {name: job.name, ok: true};
  } catch (e) {
    console.error(`  ${job.name}: FAILED — ${e.message}`);
    return {name: job.name, ok: false};
  } finally {
    await page.close().catch(() => {});
  }
}

const {browser, context} = await connect();
let next = 0;
const results = [];
await Promise.all(
  Array.from({length: Math.min(parallel, jobs.length)}, async (_, w) => {
    await sleep(w * 3000); // stagger tab startup
    while (next < jobs.length) {
      const job = jobs[next++];
      results.push(await runJob(context, job));
    }
  })
);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\nDone with failures: ${failed.map((f) => f.name).join(', ')}` : '\nAll stills saved.');
await browser.close();
process.exit(failed.length ? 1 : 0);
