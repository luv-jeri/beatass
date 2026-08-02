/**
 * Composes a vertical Beatass reel from a recorded doll-beating video, a
 * transparent message overlay, and a branded end card.
 *
 * node tools/instagram/make-reel.mjs <slug> "<message>" --video <in.mp4> [--note "<red note>"] [--voice <audio file>]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const DESIGN = path.join(ROOT, 'design', 'assets', 'brand', 'svg');

const svg = (f) => fs.readFileSync(path.join(DESIGN, f), 'utf8')
  .replace(/<\?xml[^>]*>/, '');
const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const [slug, message, ...options] = process.argv.slice(2);
let video;
let note;
let voice;

for (let i = 0; i < options.length; i += 1) {
  const flag = options[i];
  const value = options[i + 1];
  if ((flag === '--video' || flag === '--note' || flag === '--voice') && !value) {
    console.error(`missing value for ${flag}`);
    process.exit(1);
  }
  if (flag === '--video') video = value;
  else if (flag === '--note') note = value;
  else if (flag === '--voice') voice = value;
  else {
    console.error(`unknown option: ${flag}`);
    process.exit(1);
  }
  i += 1;
}

if (!slug || !message || !video) {
  console.error('usage: node tools/instagram/make-reel.mjs <slug> "<message>" --video <in.mp4> [--note "<red note>"] [--voice <audio file>]');
  process.exit(1);
}

const faceCss = `@font-face{font-family:'Patrick';src:url(data:font/woff2;base64,${font('PatrickHand.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}`;
const pageRules = `body:after{content:'';position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,transparent 0 74px,rgba(38,53,110,.10) 74px 76px);pointer-events:none}
body:before{content:'';position:absolute;left:88px;top:0;bottom:0;width:3px;background:rgba(207,58,45,.30);z-index:1}`;

const overlayHtml = `<!doctype html><meta charset="utf-8"><style>
${faceCss}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:transparent;overflow:hidden;position:relative;font-family:'Patrick'}
.stack{position:absolute;left:90px;top:130px;width:900px}
.card{width:900px;background:#fffdf5;border:4px solid #26356e;border-radius:26px 21px 28px 19px;
  transform:rotate(-.5deg);padding:48px 56px 44px;
  background-image:repeating-linear-gradient(to bottom,transparent 0 76px,rgba(38,53,110,.12) 76px 78px);
  background-position:0 24px}
.tape{position:absolute;left:50%;top:-26px;width:190px;height:52px;margin-left:-95px;
  background:rgba(226,214,178,.8);transform:rotate(-1.6deg);border-radius:3px}
.msg{font-size:58px;line-height:78px;color:#26356e;white-space:pre-wrap;word-wrap:break-word}
.note{margin:28px 0 0 40px;font-family:'Scrawl';font-weight:700;font-size:46px;color:#cf3a2d;transform:rotate(-1.5deg)}
.site{position:absolute;left:90px;bottom:60px;display:flex;align-items:baseline}
.site svg{height:48px;width:auto}.site i{font-style:normal;font-family:'Patrick';font-size:38px;color:#8d8778}
</style>
<div class="stack"><div class="card"><div class="tape"></div><div class="msg">${esc(message)}</div></div>
${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
<div class="site">${svg('wordmark.svg').replace('<svg ', '<svg style="height:48px;width:auto" ')}<i>.com</i></div>`;

const endcardHtml = `<!doctype html><meta charset="utf-8"><style>
${faceCss}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;background:#fbf7ea;overflow:hidden;position:relative;font-family:'Patrick'}
${pageRules}
.stack{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:42px;z-index:2}
.head{width:160px;height:160px}.mark{height:130px;width:auto}
.tagline{font-size:52px;color:#5b6a9c}.site{font-family:'Scrawl';font-weight:700;font-size:54px;color:#cf3a2d;transform:rotate(-1.5deg)}
</style>
<div class="stack">${svg('icon-head-full.svg').replace('<svg ', '<svg class="head" ')}
${svg('wordmark.svg').replace('<svg ', '<svg class="mark" ')}
<div class="tagline">say the thing you'd never say</div><div class="site">beatass.com</div></div>`;

const run = (name, args) => {
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(`${name} pass failed`);
    throw result.error || new Error(`ffmpeg exited with status ${result.status}`);
  }
};

const concatEntry = (file) => `file '${file.replace(/'/g, "'\\\\''")}'`;
const render = async (html, output, transparent = false) => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: output, omitBackground: transparent });
  } finally {
    await browser.close();
  }
};

const outDir = path.join(ROOT, 'content', 'instagram');
const out = path.join(outDir, `${slug}-reel.mp4`);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'beatass-reel-'));
const overlay = path.join(temp, 'overlay.png');
const endcard = path.join(temp, 'endcard.png');
const main = path.join(temp, 'main.mp4');
const end = path.join(temp, 'end.mp4');
const list = path.join(temp, 'list.txt');
const voiced = path.join(temp, 'voiced.mp4');

try {
  fs.mkdirSync(outDir, { recursive: true });
  await render(overlayHtml, overlay, true);
  await render(endcardHtml, endcard);

  run('main segment', [
    '-y', '-i', video, '-i', overlay, '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
    '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p[v0];[v0][1:v]overlay=0:0[v]',
    '-map', '[v]', '-map', '2:a', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
    '-c:a', 'aac', '-movflags', '+faststart', main,
  ]);
  run('end card', [
    '-y', '-loop', '1', '-t', '1.8', '-i', endcard, '-f', 'lavfi', '-t', '1.8', '-i', 'anullsrc=r=44100:cl=stereo',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-shortest', '-c:a', 'aac', end,
  ]);
  fs.writeFileSync(list, `${concatEntry(main)}\n${concatEntry(end)}\n`);
  run('concat', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);

  if (voice) {
    run('voice', [
      '-y', '-i', out, '-i', voice, '-filter_complex', '[1:a]apad[a]', '-map', '0:v', '-map', '[a]',
      '-c:v', 'copy', '-c:a', 'aac', '-shortest', voiced,
    ]);
    fs.renameSync(voiced, out);
  }

  console.log(`wrote ${path.relative(ROOT, out)}`);
} catch (error) {
  if (!error?.message?.includes('ffmpeg exited')) console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
