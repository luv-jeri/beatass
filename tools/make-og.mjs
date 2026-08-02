/* NOTE (2026-08-02): the shipped art now comes from design/assets/brand/png/og-1200x630.png
   (the Claude Design brand kit). This generator is only the fallback if the
   design files are ever lost. */
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
    <path d="M56 116l8 7M64 116l-8 7M86 146l8 7M94 146l-8 7"/>
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
