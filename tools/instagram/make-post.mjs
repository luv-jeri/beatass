/**
 * Renders one 1080x1350 Instagram post into content/instagram/, recreating the
 * design system's post template (design/assets/brand/png/ig-post-template) as
 * a live layout: taped note card with the message, wordmark top-left,
 * "anonymous, obviously" top-right, the hurt doll bottom-right.
 *
 *   node tools/instagram/make-post.mjs <slug> "<message>" ["<red note>"]
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

const [slug, message, note] = process.argv.slice(2);
if (!slug || !message) {
  console.error('usage: node tools/instagram/make-post.mjs <slug> "<message>" ["<red note>"]');
  process.exit(1);
}

const svg = (f) => fs.readFileSync(path.join(DESIGN, f), 'utf8')
  .replace(/<\?xml[^>]*>/, '');
const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Patrick';src:url(data:font/woff2;base64,${font('PatrickHand.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:#fbf7ea;overflow:hidden;position:relative;font-family:'Patrick'}
/* the printed page: ruled lines + the red margin */
body:after{content:'';position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,transparent 0 74px,rgba(38,53,110,.10) 74px 76px);pointer-events:none}
body:before{content:'';position:absolute;left:88px;top:0;bottom:0;width:3px;background:rgba(207,58,45,.30);z-index:1}
.top{position:absolute;top:84px;left:140px;display:flex;align-items:center;gap:26px;z-index:2}
.top svg.head{width:74px;height:74px}
.top svg.mark{height:84px;width:auto}
.anon{position:absolute;top:96px;right:76px;font-family:'Scrawl';font-weight:700;font-size:44px;color:#8d8778;transform:rotate(-2deg);z-index:2}
.card{position:absolute;left:145px;top:300px;width:790px;min-height:480px;background:#fffdf5;
  border:4px solid #26356e;border-radius:26px 21px 28px 19px;transform:rotate(-.4deg);z-index:2;
  background-image:repeating-linear-gradient(to bottom,transparent 0 71px,rgba(38,53,110,.12) 71px 73px);
  background-position:0 24px;padding:56px 64px 48px}
.tape{position:absolute;left:50%;top:-26px;width:190px;height:52px;margin-left:-95px;
  background:rgba(226,214,178,.8);transform:rotate(-1.6deg);border-radius:3px}
.msg{font-size:54px;line-height:73px;color:#26356e;white-space:pre-wrap;word-wrap:break-word}
.note{position:absolute;left:175px;top:950px;font-family:'Scrawl';font-weight:700;font-size:46px;color:#cf3a2d;transform:rotate(-1.5deg);z-index:2}
.doll{position:absolute;right:100px;bottom:90px;width:240px;height:336px;z-index:2}
.site{position:absolute;left:140px;bottom:96px;display:flex;align-items:baseline;z-index:2}
.site svg{height:52px;width:auto}
.site i{font-style:normal;font-family:'Patrick';font-size:40px;color:#8d8778}
</style>
<div class="top">${svg('icon-head-full.svg').replace('<svg ', '<svg class="head" ')}
${svg('wordmark.svg').replace('<svg ', '<svg class="mark" ')}</div>
<div class="anon">anonymous, obviously</div>
<div class="card"><div class="tape"></div><div class="msg">${esc(message)}</div></div>
${note ? `<div class="note">${esc(note)} <span style="font-family:'Patrick'">&#8599;</span></div>` : ''}
${svg('doll-hurt.svg').replace('<svg ', '<svg class="doll" ')}
<div class="site">${svg('wordmark.svg').replace('<svg ', '<svg style="height:52px;width:auto" ')}<i>.com</i></div>`;

const outDir = path.join(ROOT, 'content', 'instagram');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, slug + '.png');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out });
await b.close();

console.log(`wrote ${path.relative(ROOT, out)} — 1080x1350, ${Math.round(fs.statSync(out).size / 1024)} KB`);
