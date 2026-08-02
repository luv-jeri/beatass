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
<path d="M75 4v30c0 5 8 6 12 9" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
<path d="M92 56c1-11-7-19-17-19s-18 8-17 19c1 10 8 17 17 17s16-7 17-17z" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/>
<path d="M67 51c1.5 1 3 1 4.5 0M83 51c-1.5 1-3 1-4.5 0" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
<path d="M68 63c4-3 10-3 14 0" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
<path d="M75 74v58M75 88c-14 5-22 12-29 22M75 88c14 5 23 12 29 22M75 132c-8 14-14 24-19 36M75 132c8 14 15 24 20 36" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`;

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
    <path d="M62 96l-11-7M96 112l12-6"/>
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
