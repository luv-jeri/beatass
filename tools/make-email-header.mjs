/**
 * Draws email-header.png — the strip across the top of every email we send.
 *
 * A mail client will not load a web font, so the handwriting that carries the
 * whole look of this product cannot survive as text in an email. It can survive
 * as a picture. This renders the real wordmark, in the real fonts, from the
 * same drawing of the doll the site uses, at 2x so it stays crisp on a phone.
 *
 * Run it with:  node tools/make-email-header.mjs
 *
 * The output is committed and copied into public/ by build.py, so a normal
 * build never needs a browser.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// the same doll as the site and the og card, so the three can never drift apart
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

/* 560 wide is the email's own width; everything here is drawn at 2x and the
   email asks for it back at 560, which is how it stays sharp on a phone. */
const W = 1120, H = 224;

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:'Marker';src:url(data:font/woff2;base64,${font('Marker.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
*{margin:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#fbf7ea;overflow:hidden;position:relative;
  background-image:repeating-linear-gradient(to bottom,transparent 0 43px,rgba(38,53,110,.10) 43px 45px);
  display:flex;align-items:center;gap:34px;padding:0 56px 0 74px}
/* the red margin rule, in the same place it sits on the page */
body:before{content:'';position:absolute;left:38px;top:0;bottom:0;width:4px;background:rgba(207,58,45,.34)}
.doll{width:104px;height:146px;color:#26356e;flex:none;transform:rotate(-5deg)}
.words{flex:1;min-width:0}
.word{font-family:'Marker';font-size:74px;line-height:.92;color:#26356e;letter-spacing:-1.5px}
.word em{font-style:normal;color:#cf3a2d}
.tag{font-family:'Scrawl';font-weight:700;font-size:38px;line-height:1.1;color:#5b6a9c;margin-top:8px}
.tag i{font-style:normal;background:linear-gradient(transparent 56%,#ffe873 56%);padding:0 5px}
</style>
<svg class="doll" viewBox="0 0 150 210">
  ${DOLL}
  <g stroke="#cf3a2d" stroke-width="3.6" stroke-linecap="round">
    <path d="M56 116l8 7M64 116l-8 7M86 146l8 7M94 146l-8 7"/>
  </g>
</svg>
<div class="words">
  <div class="word">beat<em>ass</em></div>
  <div class="tag">say the thing you'd <i>never say</i></div>
</div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.evaluate(() => document.fonts.ready);      // never screenshot the fallback fonts
await p.screenshot({ path: path.join(ROOT, 'email-header.png') });
await b.close();

const kb = Math.round(fs.statSync(path.join(ROOT, 'email-header.png')).size / 1024);
console.log(`wrote email-header.png — ${W}x${H} (shown at ${W / 2}px wide), ${kb} KB`);
