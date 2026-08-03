#!/usr/bin/env node
/**
 * Composites on-slide text over generated carousel art in the site's own
 * handwriting fonts (lifted from beatass.html), so slides never carry
 * AI-typo'd text. Screenshots at Instagram's 1080x1350 (4:5).
 *
 *   node tools/carousel/compose.mjs --dir marketing/production/carousel-001
 *
 * Expects <dir>/raw/<name>.png + <dir>/texts.json (array, one entry per slide
 * in name order; lines separated by " / ", last line renders as the small
 * scrawl note). Output: <dir>/slides/<name>.jpg
 */
import {chromium} from 'playwright';
import fs from 'fs';
import path from 'path';

const dir = process.argv[process.argv.indexOf('--dir') + 1];
if (!dir) { console.error('need --dir'); process.exit(1); }

const site = fs.readFileSync('beatass.html', 'utf8');
const fonts = (site.match(/@font-face\{[^}]*\}/g) || []).join('\n');
if (!fonts.includes('woff2')) { console.error('no fonts found in beatass.html'); process.exit(1); }

const texts = JSON.parse(fs.readFileSync(path.join(dir, 'texts.json'), 'utf8'));
const raws = fs.readdirSync(path.join(dir, 'raw')).filter((f) => f.endsWith('.png')).sort(
  (a, b) => a.localeCompare(b, undefined, {numeric: true}));
if (raws.length !== texts.length) {
  console.error(`slide/text mismatch: ${raws.length} images vs ${texts.length} texts`); process.exit(1);
}
fs.mkdirSync(path.join(dir, 'slides'), {recursive: true});

// Paper-colored halo keeps ink readable over any part of the drawing.
const halo = (c) => `text-shadow:${[...Array(8)].map((_, i) =>
  `${Math.cos(i * Math.PI / 4) * 3}px ${Math.sin(i * Math.PI / 4) * 3}px 2px #fbf7ea`).join(',')};color:${c}`;

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1080, height: 1350}});
for (let i = 0; i < raws.length; i++) {
  const img = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, 'raw', raws[i])).toString('base64');
  const lines = texts[i].split(' / ');
  const note = lines.length > 1 ? lines.pop() : '';
  const html = `<!doctype html><style>${fonts}
    body{margin:0;width:1080px;height:1350px;background:#fbf7ea url(${img}) center/cover no-repeat;
         display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
    .t{font-family:'Marker';font-size:86px;line-height:1.14;text-align:center;margin:70px 40px 0;${halo('#26356e')}}
    .n{font-family:'Scrawl';font-weight:700;font-size:58px;text-align:center;margin:0 60px 64px;
       transform:rotate(-1.6deg);${halo('#cf3a2d')}}
  </style><body>
    <div class="t">${lines.join('<br>')}</div>
    <div class="n">${note}</div>
  </body>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: path.join(dir, 'slides', raws[i].replace('.png', '.jpg')), quality: 92, type: 'jpeg'});
  console.log('  composed:', raws[i]);
}
await browser.close();
console.log(`${raws.length} slides -> ${path.join(dir, 'slides')}`);
