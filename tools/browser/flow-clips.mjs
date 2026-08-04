#!/usr/bin/env node
// Flow clip runner: submits every clip in a PART-*-FLOW-PROMPTS.txt file to
// the open Flow project, or downloads the rendered grid videos.
//
//   node tools/browser/flow-clips.mjs --prompts <file> --plan          # parse + list only, no browser
//   node tools/browser/flow-clips.mjs --prompts <file> --dry-run      # everything except Create (no credits)
//   node tools/browser/flow-clips.mjs --prompts <file> --yes          # real submit (15 credits/clip)
//   node tools/browser/flow-clips.mjs download --out <dir>            # save grid videos as flow-clip-N.mp4
//
// Prereqs: bash tools/browser/launch-chrome.sh, log into Flow, open the
// project, and in the composer set: Video / Frames / 9:16 / Omni Flash /
// 10s / x1 outputs, Agent pill OFF. The script reminds but cannot verify.
import fs from 'fs';
import path from 'path';
import {connect, saveFromPage, fireClick, sleep, collectGridSrcs} from './lib.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// ---- parse the prompts file: blocks of "CLIP N - still: <name>" + prompt ----
function parsePrompts(file) {
  const parts = fs.readFileSync(file, 'utf8').split(/^=+$/m).map((s) => s.trim()).filter(Boolean);
  const jobs = [];
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(/^CLIP (\d+) - still: (\S+)/);
    if (m && parts[i + 1]) {
      // optional "characters: Maya, Stepsister" line = saved Flow characters to
      // attach as ingredients ("-" or absent = plain t2v)
      const cm = parts[i].match(/^characters:\s*(.+)$/m);
      const characters = cm && cm[1].trim() !== '-' ? cm[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
      jobs.push({clip: Number(m[1]), still: m[2], characters, prompt: parts[i + 1].replace(/\s+/g, ' ').trim()});
    }
  }
  return jobs;
}

async function flowPage(context) {
  const page = context.pages().find((p) => p.url().includes('labs.google'));
  if (!page) {
    console.error('No Flow tab found. Open your Flow project in the automation Chrome first.');
    process.exit(1);
  }
  await page.bringToFront();
  return page;
}

// ---- ingredients flow (characters attached per clip, composer in Ingredients mode) ----

// The composer card is the nearest useful ancestor of the contenteditable; chips
// (attached ingredients) render inside it as small images with a "close" button.
function composerRootEval(fn) {
  return `(() => {
    const ce = [...document.querySelectorAll('div[contenteditable="true"]')].pop();
    if (!ce) return null;
    let root = ce;
    for (let i = 0; i < 5 && root.parentElement; i++) root = root.parentElement;
    return (${fn})(root);
  })()`;
}

async function clearIngredients(page) {
  const n = await page.evaluate(composerRootEval(`(root) => {
    const btns = [...root.querySelectorAll('button')].filter((b) =>
      /close|remove|cancel/i.test((b.getAttribute('aria-label') || '') + b.textContent));
    btns.forEach((b) => b.click());
    return btns.length;
  }`));
  if (n) await sleep(1000);
  return n || 0;
}

async function openPicker(page) {
  // the "+" is the previous sibling button of the Agent pill in the composer bar
  const found = await page.evaluate(() => {
    const agent = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Agent');
    if (!agent) return false;
    let prev = agent.previousElementSibling;
    while (prev && prev.tagName !== 'BUTTON') prev = prev.previousElementSibling;
    if (!prev) return false;
    prev.setAttribute('data-flowclips', 'plus');
    return true;
  });
  if (!found) throw new Error('composer + button not found (Agent pill missing?)');
  await fireClick(page.locator('[data-flowclips="plus"]'));
  await sleep(1500);
}

async function attachIngredients(page, names) {
  // Agent mode swallows prompts — force the pill OFF before any attach/type
  const agent = page.locator('button:has-text("Agent")').last();
  if ((await agent.getAttribute('aria-pressed').catch(() => null)) === 'true') {
    await fireClick(agent);
    await sleep(1200);
  }
  const cleared = await clearIngredients(page);
  if (cleared) console.log(`    cleared ${cleared} leftover chip(s)`);

  for (const name of names) {
    await openPicker(page);
    const dlg = page.locator('[role="dialog"], [role="menu"], [role="listbox"]').last();
    // filter to Characters so file assets named alike can never match
    const filter = dlg.getByText('Characters', {exact: false}).first();
    if (await filter.isVisible().catch(() => false)) {
      await fireClick(filter);
      await sleep(800);
    }
    const tile = dlg.getByText(name, {exact: true}).first();
    await tile.waitFor({timeout: 10000});
    await fireClick(tile);
    await sleep(1200);
    // character rows insert directly and close the picker; only some asset
    // types surface an explicit "Add to Prompt" button — click it if present
    const add = page.getByRole('button', {name: 'Add to Prompt'}).first();
    if (await add.isVisible().catch(() => false)) {
      await fireClick(add);
      await sleep(1200);
    }
  }

  // verify: at least one chip image per attached character inside the composer card
  const chips = await page.evaluate(composerRootEval('(root) => root.querySelectorAll("img").length'));
  if ((chips || 0) < names.length) {
    throw new Error(`only ${chips || 0} ingredient chip(s) visible after attaching ${names.length}`);
  }
  console.log(`    attached: ${names.join(', ')} (${chips} chip(s) in composer)`);
}

async function submitClip(page, job, dryRun) {
  if (job.characters && job.characters.length) await attachIngredients(page, job.characters);

  // still: none = text-to-video — no asset to attach, composer must already
  // be in Text to Video mode (set it once in the UI before running).
  if (job.still !== 'none') {
    // 1. Open the asset picker via the "Start" chip (fireClick — see lib.mjs).
    await fireClick(page.getByText('Start', {exact: true}).last());
    const search = page.getByPlaceholder('Search assets');
    await search.waitFor({timeout: 10000});

    // 2. Search the still by exact name and verify the preview really is it —
    //    picker rows reorder during uploads; a blind first-row click attaches
    //    the wrong scene (bitten 2026-08-03).
    await search.fill(job.still);
    const img = page.locator(`img[alt="${job.still}.png"]`).first();
    await img.waitFor({timeout: 10000});

    // 3. Attach. If "Add to Prompt" isn't up yet, selecting the asset wakes it.
    const add = page.getByRole('button', {name: 'Add to Prompt'}).first();
    if (!(await add.isVisible().catch(() => false))) await fireClick(img);
    await add.waitFor({timeout: 5000});
    await fireClick(add);
    await sleep(1000);
  }

  // 4. Type the prompt with real keystrokes — Flow's editor ignores untrusted
  //    insertText/paste, but accepts CDP keyboard input.
  // div, not textarea — a hidden reCAPTCHA textarea also exists and must not match
  const composer = page.locator('div[contenteditable="true"]').last();
  await composer.click();
  await page.keyboard.type(job.prompt);
  const len = await composer.evaluate((el) => (el.value ?? el.textContent ?? '').length);
  if (len < 300) throw new Error(`composer only holds ${len} chars — typing did not land`);

  if (dryRun) {
    // Clear what we typed and detach so no credits are at risk.
    await composer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
    await page.keyboard.press('Backspace');
    if (job.characters && job.characters.length) await clearIngredients(page);
    console.log(`  clip ${job.clip}: DRY RUN ok (attach + ${len} chars typed, then cleared)`);
    return;
  }

  // 5. Create, then confirm the editor emptied (= submission accepted).
  const create = page.locator('button:has-text("Create"), button[aria-label*="Create" i]').last();
  await fireClick(create);
  for (let t = 0; t < 20; t++) {
    await sleep(1000);
    const now = await composer.evaluate((el) => (el.value ?? el.textContent ?? '').length).catch(() => 0);
    if (now < 50) {
      console.log(`  clip ${job.clip}: submitted (${job.still})`);
      return;
    }
  }
  throw new Error('editor never cleared after Create — submission likely failed');
}

async function download(context, outDir, limit) {
  fs.mkdirSync(outDir, {recursive: true});
  const page = await flowPage(context);
  let srcs = await collectGridSrcs(page);
  console.log(`${srcs.length} videos collected across the full grid.`);
  if (limit) srcs = srcs.slice(0, limit); // first-seen order is newest-first
  if (!srcs.length) {
    console.error('No <video> elements in the grid — are the renders finished?');
    process.exit(1);
  }
  console.log(`${srcs.length} videos in the grid (DOM order is newest-first).`);
  for (let i = 0; i < srcs.length; i++) {
    const out = path.join(outDir, `flow-clip-${i + 1}.mp4`);
    const size = await saveFromPage(page, srcs[i], out);
    console.log(`  saved ${out} (${(size / 1e6).toFixed(1)} MB)`);
  }
  console.log('\nMap clips to scenes with a first-frame contact sheet, e.g.:');
  console.log(`  for f in ${outDir}/flow-clip-*.mp4; do ffmpeg -y -i "$f" -frames:v 1 "\${f%.mp4}.png"; done`);
}

// ---- main ----
if (args[0] === 'download') {
  const {browser, context} = await connect();
  await download(context, opt('out') ?? 'downloads', Number(opt('limit')) || 0);
  await browser.close();
  process.exit(0);
}

const promptsFile = opt('prompts');
if (!promptsFile) {
  console.error('Usage: flow-clips.mjs --prompts <file> [--plan|--dry-run|--yes] [--only 1,3]  |  download --out <dir>');
  process.exit(1);
}
let jobs = parsePrompts(promptsFile);
if (opt('only')) {
  const keep = new Set(opt('only').split(',').map(Number));
  jobs = jobs.filter((j) => keep.has(j.clip));
}
console.log(`${jobs.length} clips parsed from ${promptsFile}:`);
for (const j of jobs) console.log(`  clip ${j.clip}  still=${j.still}  characters=[${(j.characters || []).join(',') || '-'}]  prompt=${j.prompt.length} chars`);
if (flag('plan')) process.exit(0);

if (!flag('dry-run') && !flag('yes')) {
  console.error(`\nReal submit costs ~12 credits/clip on Omni Flash (${jobs.length * 12} total). Re-run with --yes, or --dry-run to test.`);
  process.exit(1);
}
console.log('\nReminder: composer must be set to Video / Ingredients / 9:16 / Omni Flash / 8s / x1. The Agent pill is auto-disabled per clip.\n');

const tabs = Math.max(1, Math.min(Number(opt('tabs')) || 1, jobs.length));
const {browser, context} = await connect();
const first = await flowPage(context);
const pages = [first];
for (let i = 1; i < tabs; i++) {
  const p = await context.newPage();
  await p.goto(first.url(), {waitUntil: 'domcontentloaded'});
  pages.push(p);
}
// Per-tab settings guard: the composer chip must read Video + x1, otherwise
// this tab would submit at wrong settings (e.g. image mode or x4 credits).
for (const [i, p] of pages.entries()) {
  await sleep(i === 0 ? 0 : 8000);
  const chip = await p.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Video ·/.test(x.textContent));
    return b ? b.textContent.replace(/\s+/g, ' ') : null;
  });
  if (!chip || !chip.includes('x1')) {
    console.error(`tab ${i + 1}: composer chip is "${chip}" — expected Video mode at x1. Aborting before spend.`);
    process.exit(1);
  }
}
console.log(`${tabs} tab(s) ready.\n`);

const failed = [];
let next = 0;
await Promise.all(
  pages.map(async (page, w) => {
    while (next < jobs.length) {
      const job = jobs[next++];
      try {
        await submitClip(page, job, flag('dry-run'));
      } catch (e) {
        console.error(`  clip ${job.clip} (tab ${w + 1}): FAILED — ${e.message}`);
        failed.push(job.clip);
        await page.keyboard.press('Escape').catch(() => {});
      }
      await sleep(2000);
    }
  })
);
console.log(failed.length ? `\nDone with failures: clips ${failed.join(', ')}` : '\nAll clips handled.');
await browser.close();
process.exit(failed.length ? 1 : 0);
