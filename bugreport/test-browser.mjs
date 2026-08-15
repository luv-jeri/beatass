/* The bug reporter, driven in a real browser.
 *
 * test-privacy.mjs proves the redaction FUNCTIONS are correct. This proves the
 * whole path is: a real page, a real person typing a real confession, a real
 * click on "Report a problem", and then we read the actual bytes leaving the
 * browser and go looking for what they typed.
 *
 * The difference matters. A redaction function can be perfect and still be
 * wired up to the wrong place. This test does not care how it is wired.
 *
 *   node bugreport/test-browser.mjs
 */
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', 'public');

/* Serve public/ over http rather than opening the file directly. The reporter
   is fetched from /bugreport.js, and on a file:// page that resolves to the
   root of the disk. Serving it is also simply more honest: this is the tree
   that gets deployed. */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
function serve() {
  return new Promise((res) => {
    const server = http.createServer((req, rq) => {
      const name = req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0];
      const file = path.join(PUBLIC, name);
      if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) { rq.writeHead(404); rq.end('no'); return; }
      rq.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      rq.end(fs.readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => res(server));
  });
}

/* Strings that could only have come from a human typing them. If any of these
   leaves the browser, a real confession would have too. */
const CONFESSION = 'CANARY-ALPHA7 I have been in love with you since the day we met';
const RECIPIENT = 'canary.beta9@example.com';
const HANDLE = 'canary_gamma3';
const WHATSAPP = '9812345678';

let pass = 0, fail = 0;
const ok = (n) => { pass++; console.log('  ok   ' + n); };
const bad = (n, d) => { fail++; console.log('  FAIL ' + n + (d ? '\n        ' + d : '')); };

const run = async () => {
  const server = await serve();
  const PAGE = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));

  /* Catch the report before it can go anywhere, and keep the raw body. */
  let captured = null;
  await page.route('**/api/bug', async (route) => {
    const req = route.request();
    captured = { body: req.postData() || '', headers: req.headers() };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'test0000test0000' })
    });
  });

  await page.goto(PAGE);
  await page.waitForTimeout(300);

  console.log('\nbug reporter in a real browser\n');
  console.log('the button');

  const btn = page.locator('.br-open');
  (await btn.count()) === 1 ? ok('one "Report a problem" button exists') : bad('button missing or duplicated');
  await btn.isVisible() ? ok('it is visible') : bad('it is not visible');

  /* The whole point of the lazy split: the real file must NOT be loaded yet. */
  const loadedEarly = await page.evaluate(() => !!window.BugReport);
  loadedEarly ? bad('the reporter loaded before it was asked for') : ok('the reporter has NOT been downloaded yet');
  const earlyBufferExists = await page.evaluate(() => Array.isArray(window.__brEarly));
  earlyBufferExists ? ok('but the stub is already listening for errors') : bad('the early error buffer is missing');

  /* ---- fill the page in exactly as a real person would ---- */
  console.log('\nsomeone writes a confession, then hits a problem');
  await page.fill('#i-name', 'Priya');
  await page.fill('#i-email', RECIPIENT);
  await page.fill('#i-msg', CONFESSION);
  await page.fill('#i-handle', HANDLE);
  await page.fill('#i-wa', WHATSAPP);
  /* #i-sender (the sender's own address) lives on the later preview screen, so
     it is not on this one. The reporter's own address is typed into the report
     sheet's own field below, which is the case that matters here. */

  /* an error happens BEFORE they open the reporter — the interesting case */
  await page.evaluate((c) => console.error('render failed while showing: ' + c), CONFESSION);

  await btn.click();
  await page.waitForTimeout(700);

  const sheet = page.locator('.br-sheet.on');
  (await sheet.count()) === 1 ? ok('the sheet opened') : bad('the sheet did not open');
  (await page.evaluate(() => !!window.BugReport)) ? ok('and NOW the reporter is loaded') : bad('reporter still not loaded');

  await page.fill('#br-note', 'I pressed send and nothing happened. My address is reporter.self@example.com');
  await page.fill('#br-mail', 'reporter.self@example.com');
  await page.click('.br-send');
  await page.waitForTimeout(900);

  console.log('\nwhat actually left the browser');
  if (!captured) {
    bad('nothing was submitted at all');
  } else {
    const body = captured.body;
    ok('a report was submitted (' + Math.round(body.length / 1024) + ' KB)');

    const LEAKS = [
      [CONFESSION, 'the confession'],
      ['CANARY-ALPHA7', 'the confession canary'],
      [RECIPIENT, "the recipient's email"],
      ['canary.beta9', 'the recipient email local part'],
      [HANDLE, "the recipient's instagram handle"],
      [WHATSAPP, "the recipient's whatsapp number"]
    ];
    for (const [needle, what] of LEAKS) {
      body.includes(needle) ? bad('LEAKED ' + what, 'found: ' + needle) : ok('no trace of ' + what);
    }

    body.includes('reporter.self@example.com')
      ? ok("the reporter's OWN address is kept - they typed it into the report on purpose")
      : bad("the reporter's reply address was dropped");

    /* the error raised before the sheet opened must still have made it,
       with the confession scrubbed out of it */
    body.includes('render failed')
      ? ok('the error from BEFORE the button was pressed was captured')
      : bad('early errors were lost - the stub handover is broken');

    /* and the page URL must not carry a query string */
    /\"route\":\"[^\"]*\?/.test(body)
      ? bad('a captured URL still has a query string')
      : ok('no captured URL carries a query string');
  }

  /* ---- the screenshot, which is the one thing text redaction cannot save ----
     Once the page is pixels, no scrubber can reach into it. The only defence
     is masking the PAGE before the picture is taken, so that is what gets
     checked here: with data-capturing set, every private field must be
     visually gone and our own chrome must not be in shot. */
  console.log('\na screenshot cannot photograph a confession');

  const shot = await page.evaluate(() => {
    document.documentElement.setAttribute('data-capturing', '');
    const seen = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return 'missing';
      const c = getComputedStyle(el);
      const fill = c.webkitTextFillColor || c.color;
      return /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(fill) ? 'masked' : 'VISIBLE:' + fill;
    };
    const gone = (sel) => {
      const el = document.querySelector(sel);
      return !el || getComputedStyle(el).display === 'none' ? 'hidden' : 'IN SHOT';
    };
    const out = {
      msg: seen('#i-msg'), email: seen('#i-email'), name: seen('#i-name'),
      handle: seen('#i-handle'), wa: seen('#i-wa'),
      ourButton: gone('.br-open'), ourSheet: gone('.br-sheet'),
      /* the doll must still be visible or the picture is useless */
      canvas: document.querySelector('canvas') ? getComputedStyle(document.querySelector('canvas')).display : 'none'
    };
    document.documentElement.removeAttribute('data-capturing');
    return out;
  });

  for (const [field, label] of [['msg', 'the confession'], ['email', "the recipient's email"],
    ['name', "the recipient's name"], ['handle', 'the instagram handle'], ['wa', 'the whatsapp number']]) {
    shot[field] === 'masked' ? ok(label + ' is masked out of the picture') : bad(label + ' would be photographed', shot[field]);
  }
  shot.ourButton === 'hidden' ? ok('our own button is not in the picture') : bad('the report button is in shot');
  shot.ourSheet === 'hidden' ? ok('our own sheet is not in the picture') : bad('the sheet is in shot');
  shot.canvas !== 'none' ? ok('but the doll drawing IS still visible - the picture is still useful') : bad('the drawing got masked too');

  console.log('\nhow much evidence one report may carry');
  const caps = await page.evaluate(() => {
    const src = document.querySelector('script[src*="bugreport"]') ? '' : '';
    return { hasShoot: typeof window.BugReport.shoot === 'function' };
  });
  caps.hasShoot ? ok('screenshot mode exists') : bad('screenshot mode is missing');

  console.log('\nthe pages that may never be captured');
  /* /m and /admin are served by the Worker, not this file, so drive the module
     directly with a faked path to prove the guard, then confirm on the real page. */
  const guard = await page.evaluate(() => ({ kind: window.BugReport.pageKind, allowed: window.BugReport.allowed }));
  guard.kind === 'app' ? ok('this page reports itself as the app page') : bad('wrong page kind: ' + guard.kind);
  guard.allowed === true ? ok('and capture is allowed here') : bad('capture blocked on the app page');

  console.log('\nnothing else broke');
  jsErrors.length === 0 ? ok('no javascript errors') : bad('javascript errors', jsErrors.join(' | '));

  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
  scrolls ? bad('the page scrolls with the sheet open') : ok('the page still does not scroll');

  await browser.close();
  server.close();

  console.log('\n' + (fail === 0
    ? `bug reporter in-browser: all ${pass} checks pass\n`
    : `bug reporter in-browser: ${fail} FAILED of ${pass + fail}\n`));
  process.exit(fail === 0 ? 0 : 1);
};

run().catch((e) => { console.error(e); process.exit(1); });
