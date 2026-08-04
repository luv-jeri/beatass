/**
 * insights.mjs — snapshot the account's public performance numbers.
 *
 *   node tools/instagram/insights.mjs             one snapshot, prints summary
 *   node tools/instagram/insights.mjs --quiet     snapshot only (for the loop)
 *
 * Writes marketing/insights/snapshots/<UTC timestamp>.json and refreshes
 * marketing/insights/LATEST.md. Read-only: it never posts, likes, or clicks
 * anything on the account. Uses the same saved session as post.mjs.
 *
 * What it captures per reel/post: url, grid view count (reels tab overlay),
 * likes + comments (from the page's own meta description — the most stable
 * selector Instagram offers), and the caption's first line so a human can
 * tell posts apart. Retention/drop-off curves are app-only for now; if the
 * account becomes a professional account this script should grow a
 * professional-dashboard section.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(path.dirname(HERE));
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, 'config.json'), 'utf8'));
const SESSION = path.join(os.homedir(), '.config', 'beatass-instagram');
const QUIET = process.argv.includes('--quiet');
const say = (m) => { if (!QUIET) console.log(m); };

const HANDLE = CONFIG.handle.toLowerCase();
const OUTDIR = path.join(ROOT, 'marketing', 'insights');
fs.mkdirSync(path.join(OUTDIR, 'snapshots'), { recursive: true });

const browser = await chromium.launchPersistentContext(SESSION, {
  headless: CONFIG.headless === true,
  viewport: { width: 1280, height: 900 },
});
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // 1. Reels grid: hrefs + play-count overlays, in display order (newest first).
  await page.goto(`https://www.instagram.com/${HANDLE}/reels/`, { waitUntil: 'domcontentloaded' });
  await sleep(6000);
  const grid = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll('a[href*="/reel/"]')) {
      const views = a.innerText.trim().split('\n').filter(Boolean).pop() ?? '';
      out.push({ href: a.getAttribute('href'), gridViews: views });
    }
    return out;
  });

  // 2. Each reel page: likes/comments/date live in the meta description
  //    ("123 likes, 4 comments - handle on August 4, 2026: \"caption...\"").
  const reels = [];
  for (const r of grid) {
    await page.goto('https://www.instagram.com' + r.href, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    const meta = await page
      .$eval('meta[name="description"], meta[property="og:description"]', (m) => m.content)
      .catch(() => '');
    const m = meta.match(/([\d,.KM]+)\s+likes?,\s+([\d,.KM]+)\s+comments?\s+-\s+\S+\s+on\s+([^:]+):\s*"?(.*)/i) ?? [];
    reels.push({
      url: 'https://www.instagram.com' + r.href,
      gridViews: r.gridViews,
      likes: m[1] ?? '',
      comments: m[2] ?? '',
      postedOn: (m[3] ?? '').trim(),
      captionStart: (m[4] ?? meta).slice(0, 90),
    });
    say(`  ${r.href}  views=${r.gridViews} likes=${m[1] ?? '?'} comments=${m[2] ?? '?'}`);
  }

  // 3. Snapshot to disk (raw data belongs on disk, not in a chat context).
  const now = new Date().toISOString();
  const snapshot = { takenAt: now, handle: HANDLE, reels };
  const file = path.join(OUTDIR, 'snapshots', now.replace(/[:]/g, '-').slice(0, 16) + '.json');
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));

  const md = [
    `# Instagram insights — latest snapshot`,
    ``,
    `Taken ${now} (UTC). Raw history: marketing/insights/snapshots/`,
    ``,
    `| Reel | Views | Likes | Comments | Posted | Caption starts |`,
    `|---|---|---|---|---|---|`,
    ...reels.map((r) => `| ${r.url.replace('https://www.instagram.com', '')} | ${r.gridViews} | ${r.likes} | ${r.comments} | ${r.postedOn} | ${r.captionStart.replace(/\|/g, '/')} |`),
    ``,
    `Retention / drop-off curves need the app or a professional account —`,
    `not captured here yet.`,
    ``,
  ].join('\n');
  fs.writeFileSync(path.join(OUTDIR, 'LATEST.md'), md);
  say(`\nwrote ${file}`);
  say(`wrote marketing/insights/LATEST.md`);
} finally {
  await browser.close();
}
