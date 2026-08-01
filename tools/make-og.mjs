/**
 * Draws og.png — the 1200x630 card that Facebook, WhatsApp, iMessage, Slack,
 * LinkedIn and Twitter show when somebody pastes a beatass.com link.
 *
 * It matters more here than on most sites: this product spreads by being
 * shared, and a link with no image is a grey box that nobody clicks.
 *
 * Run it with:  node tools/make-og.mjs
 *
 * The output is committed at the repo root and copied into public/ by
 * build.py, so a normal build never needs a browser.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// the real doll, lifted from template.html's <defs> so the card can never
// drift into being a different drawing than the site's
const DOLL = `
<path d="M75 4v30c0 5 8 6 12 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
<path d="M92 56c1-11-7-19-17-19s-18 8-17 19c1 10 8 17 17 17s16-7 17-17z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/>
<path d="M67 51c1.5 1 3 1 4.5 0M83 51c-1.5 1-3 1-4.5 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
<path d="M68 63c4-3 10-3 14 0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
<path d="M75 74v58M75 88c-14 5-22 12-29 22M75 88c14 5 23 12 29 22M75 132c-8 14-14 24-19 36M75 132c8 14 15 24 20 36" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>`;

const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Marker';src:url(data:font/woff2;base64,${font('Marker.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#fbf7ea;overflow:hidden;
  background-image:repeating-linear-gradient(to bottom,transparent 0 41px,rgba(38,53,110,.09) 41px 42px);
  display:flex;align-items:center;gap:40px;padding:0 88px;position:relative}
/* the red margin rule down the left, same as the site's paper */
body:before{content:'';position:absolute;left:56px;top:0;bottom:0;width:2px;background:rgba(207,58,45,.28)}
.words{flex:1;min-width:0}
.word{font-family:'Marker';font-size:104px;line-height:.95;color:#26356e;letter-spacing:-2px}
.word em{font-style:normal;color:#cf3a2d}
.tag{font-family:'Scrawl';font-weight:700;font-size:56px;line-height:1.12;color:#26356e;margin-top:18px}
.tag i{font-style:normal;background:linear-gradient(transparent 58%,#ffe873 58%);padding:0 6px}
.sub{font-family:'Scrawl';font-size:34px;color:#5b6a9c;margin-top:26px}
.doll{width:340px;height:476px;color:#26356e;flex:none;transform:rotate(-4deg)}
.pin{position:absolute;stroke:#cf3a2d;stroke-width:3;stroke-linecap:round}
</style>
<div class="words">
  <div class="word">beat<em>ass</em></div>
  <div class="tag">say the thing<br>you'd <i>never say</i></div>
  <div class="sub">anonymous. free. he takes the beating for you.</div>
</div>
<svg class="doll" viewBox="0 0 150 210">
  ${DOLL}
  <g stroke="#cf3a2d" stroke-width="3" stroke-linecap="round">
    <path d="M62 96l-11-7M96 112l12-6M70 120l-12 5"/>
  </g>
</svg>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);      // never screenshot the fallback fonts
await p.screenshot({ path: path.join(ROOT, 'og.png') });
await b.close();

const kb = Math.round(fs.statSync(path.join(ROOT, 'og.png')).size / 1024);
console.log(`wrote og.png — 1200x630, ${kb} KB`);
