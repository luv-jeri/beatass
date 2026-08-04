// Shared plumbing for the browser runners. Connects to the automation Chrome
// (tools/browser/launch-chrome.sh) over CDP so logins persist in its profile.
import {chromium} from 'playwright';
import fs from 'fs';

export async function connect(port = 9333) {
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const context = browser.contexts()[0];
    if (!context) throw new Error('Chrome is up but has no browser context');
    return {browser, context};
  } catch (e) {
    console.error(`Cannot reach Chrome on CDP port ${port} (${e.message}).`);
    console.error('Start the automation Chrome first:  bash tools/browser/launch-chrome.sh');
    process.exit(1);
  }
}

// Download a page resource without exposing its signed URL outside the page:
// in-page fetch -> base64 -> local file. Works where direct requests 403.
export async function saveFromPage(page, url, outPath) {
  // In-page fetch flakes intermittently ("Failed to fetch", 2026-08-04) and a
  // failed download must never trigger a paid regeneration - retry here.
  let b64, lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      b64 = await page.evaluate(async (u) => {
        const res = await fetch(u);
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        return await new Promise((ok, err) => {
          const r = new FileReader();
          r.onload = () => ok(r.result.split(',')[1]);
          r.onerror = err;
          r.readAsDataURL(blob);
        });
      }, url);
      break;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  if (!b64) throw lastErr;
  fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
  return fs.statSync(outPath).size;
}

// Flow swallows plain .click() on its composer chips (clicks fall through to
// the sidebar). This full pointer/mouse burst on the element itself is the
// proven workaround from the 2026-08-03 session.
export async function fireClick(locator) {
  await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const o = {bubbles: true, cancelable: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, view: window};
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Flow's media grid is virtualized: off-screen items are removed from the
// DOM, so one querySelectorAll undercounts. Walk the scroll container top to
// bottom and accumulate srcs in first-seen order (= newest-first).
export async function collectGridSrcs(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollHeight > el.clientHeight + 100) el.scrollTop = 0;
    }
  });
  await sleep(1500);
  const seen = new Set();
  const srcs = [];
  for (let step = 0; step < 30; step++) {
    const batch = await page.evaluate(() =>
      [...document.querySelectorAll('video')].map((v) => v.src || v.querySelector('source')?.src).filter(Boolean)
    );
    for (const s of batch) if (!seen.has(s)) { seen.add(s); srcs.push(s); }
    const atBottom = await page.evaluate(() => {
      let done = true;
      for (const el of document.querySelectorAll('*')) {
        if (el.scrollHeight > el.clientHeight + 100) {
          if (el.scrollTop + el.clientHeight < el.scrollHeight - 5) done = false;
          el.scrollTop += el.clientHeight * 0.8;
        }
      }
      return done;
    });
    await sleep(1200);
    if (atBottom) break;
  }
  return srcs;
}
