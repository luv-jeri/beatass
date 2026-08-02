/**
 * Renders the real Claude Design Instagram templates (design/ig-templates/*.dc.html)
 * to PNG, pixel-faithful, all five tones, with the doll recording dropped into
 * the 440x440 #media slot. The .dc.html files stay the source of truth: this
 * script consumes them, so a design tweak means editing the template, not here.
 *
 *   node tools/instagram/render-template.mjs --type post  --tone grudge <slug> "<message>" [--annotation "..."] [--media <gif/png>]
 *   node tools/instagram/render-template.mjs --type story --tone crush  <slug> "<message>"
 *   node tools/instagram/render-template.mjs --type reel  --tone roast --frame cover|lowerthird|end <slug> "<message>"
 *
 * Output: content/instagram/<slug>[-story | -reel-<frame>].png
 *
 * It does the three things the Claude Design runtime did, without needing React:
 * fills {{tokens}}, resolves <sc-if value="{{isX}}"> blocks, and drops in the
 * tone/annotation/size values from the template's own renderVals (ported below).
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const TPL = path.join(ROOT, 'design', 'ig-templates');
const SVG_ABS = 'file://' + path.join(ROOT, 'design', 'assets', 'brand', 'svg') + '/';

// ---- args: known flags take a value; everything else is positional ----
const VALUE_FLAGS = new Set(['type', 'tone', 'frame', 'media', 'annotation']);
const flags = {}; const pos = [];
{
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--') && VALUE_FLAGS.has(a[i].slice(2))) { flags[a[i].slice(2)] = a[++i]; }
    else pos.push(a[i]);
  }
}
const type = flags.type || 'post';
const tone = flags.tone || 'crush';
const frame = flags.frame || 'cover';
const media = flags.media || '';
const annotation = flags.annotation || '';
const [slug, message] = pos;
if (!slug || !message || !['post', 'story', 'reel'].includes(type)) {
  console.error('usage: render-template.mjs --type post|story|reel [--tone t] [--frame f] <slug> "<message>" [--annotation "..."] [--media path]');
  process.exit(1);
}

// ---- the tone/size logic, ported verbatim from each template's renderVals ----
const ANN = { crush: "don't make it weird", grudge: 'you know what you did', apology: 'i mean every word', roast: 'anonymous, obviously', thanks: 'for real. thank you.' };
function computeVals() {
  const len = message.length;
  const flags = { isCrush: tone === 'crush', isGrudge: tone === 'grudge', isApology: tone === 'apology', isRoast: tone === 'roast', isThanks: tone === 'thanks' };
  if (type === 'reel') {
    const DOLL = { crush: 'doll-loved', grudge: 'doll-hurt', apology: 'doll-flinch', roast: 'doll-panic', thanks: 'doll-default' };
    const STICK = { crush: 'sticker-hearts', grudge: 'sticker-pins', roast: 'sticker-flames', thanks: 'sticker-stars' };
    const cbase = len <= 24 ? 150 : len <= 48 ? 118 : len <= 90 ? 92 : len <= 140 ? 74 : 60;
    return {
      tone, frame, message,
      annText: annotation || (frame === 'cover' ? 'watch him take it →' : ANN[tone] || ANN.roast),
      coverSize: Math.round(cbase * (tone === 'roast' ? 1.15 : tone === 'apology' ? .85 : 1)),
      lowerSize: len <= 60 ? 60 : len <= 120 ? 50 : 42,
      dollSrc: '../../assets/brand/svg/' + DOLL[tone] + '.svg',
      hasSticker: !!STICK[tone],
      stickerSrc: '../../assets/brand/svg/' + (STICK[tone] || 'sticker-stars') + '.svg',
      ...flags, isCover: frame === 'cover', isLower: frame === 'lowerthird', isEnd: frame === 'end'
    };
  }
  const base = len <= 24 ? 108 : len <= 48 ? 88 : len <= 90 ? 70 : len <= 140 ? 52 : len <= 200 ? 44 : 36;
  const f = tone === 'roast' && len <= 48 ? 1.15 : tone === 'apology' ? .85 : 1;
  return { tone, message, annText: annotation || ANN[tone] || ANN.roast, msgSize: Math.round(base * f), ...flags };
}

// ---- template resolution (the three jobs the DC runtime did) ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function resolve(html, vals) {
  // 1. <sc-if value="{{KEY}}" ...>BODY</sc-if>  -> BODY if vals[KEY] truthy, else ''
  html = html.replace(/<sc-if\s+value="\{\{\s*(\w+)\s*\}\}"[^>]*>([\s\S]*?)<\/sc-if>/g,
    (_, key, body) => (vals[key] ? body : ''));
  // 2. {{token}} -> value (message + annText get HTML-escaped; the rest are numbers/enums)
  html = html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vals[key];
    if (v === undefined) return '';
    return (key === 'message' || key === 'annText') ? esc(v) : String(v);
  });
  return html;
}

const FILE = { post: 'IgPost.dc.html', story: 'IgStory.dc.html', reel: 'IgReel.dc.html' }[type];
let raw = fs.readFileSync(path.join(TPL, FILE), 'utf8');

// keep only the canvas markup: drop the DC harness (support.js, <x-dc>, <helmet>, the trailing logic <script>)
raw = raw
  .replace(/<script src="\.\/support\.js"><\/script>/g, '')
  .replace(/<helmet>[\s\S]*?<\/helmet>/g, '')
  .replace(/<script type="text\/x-dc"[\s\S]*?<\/script>/g, '')
  .replace(/<\/?x-dc>/g, '');

let body = resolve(raw, computeVals());
// point asset urls at the repo's real SVGs
body = body.replace(/\.\.\/\.\.\/assets\/brand\/svg\//g, SVG_ABS);
// take just the <body> inner (the <div id="canvas"> and siblings)
const bodyInner = body.replace(/[\s\S]*<body[^>]*>/, '').replace(/<\/body>[\s\S]*/, '');

// media: replace the #media slot's placeholder children with the real recording frame
let mediaHtml = bodyInner;
if (media) {
  const src = 'file://' + path.resolve(media);
  mediaHtml = mediaHtml.replace(
    /(<div id="media"[^>]*>)[\s\S]*?(<\/div>\s*<div style="height:54px)/,
    `$1<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">$2`
  ).replace(
    /(<div id="media"[^>]*>)[\s\S]*?(<\/div>\s*<\/div>)/,
    (m, open, close) => m.includes('<img') ? m : `${open}<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">${close}`
  );
}

// fonts, inlined so there are no path games: the three faces the templates name
const font = (f) => fs.readFileSync(path.join(ROOT, 'fonts', f)).toString('base64');
const FONTS = `
@font-face{font-family:'Hand';src:url(data:font/woff2;base64,${font('PatrickHand.woff2')}) format('woff2')}
@font-face{font-family:'Scrawl';src:url(data:font/woff2;base64,${font('Caveat.woff2')}) format('woff2');font-weight:400 700}
@font-face{font-family:'Marker';src:url(data:font/woff2;base64,${font('Marker.woff2')}) format('woff2')}`;

const W = 1080, H = type === 'post' ? 1350 : 1920;
const page = `<!doctype html><meta charset="utf-8"><style>${FONTS}\n*{margin:0}html,body{width:${W}px;height:${H}px}</style>${mediaHtml}`;

const outName = slug + (type === 'story' ? '-story' : type === 'reel' ? '-reel-' + frame : '') + '.png';
const outDir = path.join(ROOT, 'content', 'instagram');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, outName);

// Render from a real file:// page (not setContent): an about:blank origin
// blocks file:// <img> assets, so the wordmark, dolls and stickers vanish.
const tmp = path.join(outDir, `.render-${process.pid}.html`);
fs.writeFileSync(tmp, page);
const browser = await chromium.launch();
try {
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await p.goto('file://' + tmp, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.locator('#canvas').screenshot({ path: out });
  console.log(`wrote ${out} - ${W}x${H} (${type}/${tone}${type === 'reel' ? '/' + frame : ''})`);
} finally {
  await browser.close();
  fs.rmSync(tmp, { force: true });
}
