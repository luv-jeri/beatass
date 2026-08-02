/**
 * Renders one 1080x1350 Instagram post image into content/instagram/.
 *
 *   node tools/instagram/make-post.mjs <slug> "<headline>" ["<sub line>"]
 *
 * e.g.  node tools/instagram/make-post.mjs 001-hello "say the thing you'd |never say|"
 *
 * Words between |pipes| get the yellow highlighter. A .txt sidecar with the
 * same slug (the caption) is up to you — without one, post.mjs uses the
 * default caption from config.json.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));

const [slug, headline, sub] = process.argv.slice(2);
if (!slug || !headline) {
  console.error('usage: node tools/instagram/make-post.mjs <slug> "<headline>" ["<sub>"]');
  process.exit(1);
}

// the same doll as the site, the og card and the email header
const DOLL = `
<path d="M75 3v13c0 4 4 5 7 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
<path d="M52 122c-8 4-14 9-18 15M98 122c8 4 14 9 18 15M65 168c-1 12-2 22-3 30M85 168c1 12 2 22 3 30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
<ellipse cx="75" cy="130" rx="30" ry="46" fill="#fffdf5" stroke="currentColor" stroke-width="5"/>
<path d="M75 112v34M71 122h8M71 132h8M71 142h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/>
<ellipse cx="75" cy="54" rx="37" ry="34" fill="#fffdf5" stroke="currentColor" stroke-width="5"/>
<path d="M53 39c3-3 7-4 10-3M97 39c-3-3-7-4-10-3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
<circle cx="62" cy="51" r="4.5" fill="currentColor"/><circle cx="88" cy="51" r="4.5" fill="currentColor"/>
<circle cx="52" cy="63" r="5" fill="#e0507f" opacity=".3"/><circle cx="98" cy="63" r="5" fill="#e0507f" opacity=".3"/>
<path d="M69 66c3 3 9 3 12 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;

const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const mark = (s) => esc(s).replace(/\|([^|]+)\|/g, '<i>$1</i>');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Marker';src:url(data:font/woff2;base64,${font('Marker.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;background:#fbf7ea;overflow:hidden;position:relative;
  background-image:repeating-linear-gradient(to bottom,transparent 0 55px,rgba(38,53,110,.09) 55px 57px);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;padding:70px;text-align:center}
body:before{content:'';position:absolute;left:76px;top:0;bottom:0;width:3px;background:rgba(207,58,45,.28)}
.doll{width:330px;height:462px;color:#26356e;transform:rotate(-4deg)}
.head{font-family:'Scrawl';font-weight:700;font-size:88px;line-height:1.08;color:#26356e;max-width:850px}
.head i{font-style:normal;background:linear-gradient(transparent 58%,#ffe873 58%);padding:0 8px}
.sub{font-family:'Scrawl';font-size:46px;color:#5b6a9c;max-width:800px}
.word{font-family:'Marker';font-size:58px;color:#26356e;letter-spacing:-1px;margin-top:10px}
.word em{font-style:normal;color:#cf3a2d}
.site{font-family:'Scrawl';font-weight:700;font-size:40px;color:#cf3a2d}
</style>
<svg class="doll" viewBox="0 0 150 210">${DOLL}</svg>
<div class="head">${mark(headline)}</div>
${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
<div class="word">beat<em>ass</em></div>
<div class="site">beatass.com</div>`;

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
