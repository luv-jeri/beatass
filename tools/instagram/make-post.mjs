/**
 * Renders one 1080x1350 Instagram post, or a 1080x1920 story with --story
 * (output <slug>-story.png), into content/instagram/, recreating the
 * design system's post template (design/assets/brand/png/ig-post-template) as
 * a live layout: taped note card with the message, wordmark top-left,
 * "anonymous, obviously" top-right, the hurt doll bottom-right.
 *
 *   node tools/instagram/make-post.mjs [--story] <slug> "<message>" ["<red note>"]
 *
 * e.g.  node tools/instagram/make-post.mjs 002-thankyou \
 *         "you never once said thank you. not once in three years." \
 *         "somebody actually sent this"
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const DESIGN = path.join(ROOT, 'design', 'assets', 'brand', 'svg');

const args = process.argv.slice(2);
const story = args.includes('--story');
const pos = args.filter(a => a !== '--story');
const [slug, message, note] = pos;

/* One template, two crops. The story is taller, so everything breathes:
   bigger card, bigger type, doll gets room. */
const D = story ? {
  w: 1080, h: 1920,
  topY: 110, headPx: 84, markPx: 96, anonY: 124, anonPx: 50,
  cardL: 110, cardT: 430, cardW: 860, cardMinH: 620, cardPad: '64px 70px 56px',
  msgPx: 66, msgLh: 92, ruleStep: 92,
  noteL: 150, noteT: 1240, notePx: 54,
  dollR: 90, dollB: 210, dollW: 300, dollH: 420,
  siteB: 120, sitePx: 56, siteIPx: 44
} : {
  w: 1080, h: 1350,
  topY: 84, headPx: 74, markPx: 84, anonY: 96, anonPx: 44,
  cardL: 145, cardT: 300, cardW: 790, cardMinH: 480, cardPad: '56px 64px 48px',
  msgPx: 54, msgLh: 73, ruleStep: 73,
  noteL: 175, noteT: 950, notePx: 46,
  dollR: 100, dollB: 90, dollW: 240, dollH: 336,
  siteB: 96, sitePx: 52, siteIPx: 40
};
if (!slug || !message) {
  console.error('usage: node tools/instagram/make-post.mjs [--story] <slug> "<message>" ["<red note>"]');
  process.exit(1);
}

const svg = (f) => fs.readFileSync(path.join(DESIGN, f), 'utf8')
  .replace(/<\?xml[^>]*>/, '');
const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Patrick';src:url(data:font/woff2;base64,${font('PatrickHand.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:${D.w}px;height:${D.h}px;background:#fbf7ea;overflow:hidden;position:relative;font-family:'Patrick'}
/* the printed page: ruled lines + the red margin */
body:after{content:'';position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,transparent 0 74px,rgba(38,53,110,.10) 74px 76px);pointer-events:none}
body:before{content:'';position:absolute;left:88px;top:0;bottom:0;width:3px;background:rgba(207,58,45,.30);z-index:1}
.top{position:absolute;top:${D.topY}px;left:140px;display:flex;align-items:center;gap:26px;z-index:2}
.top svg.head{width:${D.headPx}px;height:${D.headPx}px}
.top svg.mark{height:${D.markPx}px;width:auto}
.anon{position:absolute;top:${D.anonY}px;right:76px;font-family:'Scrawl';font-weight:700;font-size:${D.anonPx}px;color:#8d8778;transform:rotate(-2deg);z-index:2}
.card{position:absolute;left:${D.cardL}px;top:${D.cardT}px;width:${D.cardW}px;min-height:${D.cardMinH}px;background:#fffdf5;
  border:4px solid #26356e;border-radius:26px 21px 28px 19px;transform:rotate(-.4deg);z-index:2;
  background-image:repeating-linear-gradient(to bottom,transparent 0 ${D.ruleStep - 2}px,rgba(38,53,110,.12) ${D.ruleStep - 2}px ${D.ruleStep}px);
  background-position:0 24px;padding:${D.cardPad}}
.tape{position:absolute;left:50%;top:-26px;width:190px;height:52px;margin-left:-95px;
  background:rgba(226,214,178,.8);transform:rotate(-1.6deg);border-radius:3px}
.msg{font-size:${D.msgPx}px;line-height:${D.msgLh}px;color:#26356e;white-space:pre-wrap;word-wrap:break-word}
.note{position:absolute;left:${D.noteL}px;top:${D.noteT}px;font-family:'Scrawl';font-weight:700;font-size:${D.notePx}px;color:#cf3a2d;transform:rotate(-1.5deg);z-index:2}
.doll{position:absolute;right:${D.dollR}px;bottom:${D.dollB}px;width:${D.dollW}px;height:${D.dollH}px;z-index:2}
.site{position:absolute;left:140px;bottom:${D.siteB}px;display:flex;align-items:baseline;z-index:2}
.site svg{height:${D.sitePx}px;width:auto}
.site i{font-style:normal;font-family:'Patrick';font-size:${D.siteIPx}px;color:#8d8778}
</style>
<div class="top">${svg('icon-head-full.svg').replace('<svg ', '<svg class="head" ')}
${svg('wordmark.svg').replace('<svg ', '<svg class="mark" ')}</div>
<div class="anon">anonymous, obviously</div>
<div class="card"><div class="tape"></div><div class="msg">${esc(message)}</div></div>
${note ? `<div class="note">${esc(note)} <span style="font-family:'Patrick'">&#8599;</span></div>` : ''}
${svg('doll-hurt.svg').replace('<svg ', '<svg class="doll" ')}
<div class="site">${svg('wordmark.svg').replace('<svg ', `<svg style="height:${D.sitePx}px;width:auto" `)}<i>.com</i></div>`;

const outDir = path.join(ROOT, 'content', 'instagram');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, slug + (story ? '-story' : '') + '.png');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: D.w, height: D.h } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out });
await b.close();

console.log(`wrote ${path.relative(ROOT, out)} - ${D.w}x${D.h}, ${Math.round(fs.statSync(out).size / 1024)} KB`);
