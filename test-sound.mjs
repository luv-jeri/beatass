/**
 * Proves the doll actually makes noise, and the right kind of noise.
 *
 *   node test-sound.mjs
 *
 * You cannot listen to a headless browser, so this counts what the page asks
 * the speaker to do. Every sound here is built out of Web Audio nodes, so a
 * sound that plays creates nodes and a sound that does not, does not. The
 * counting is done by wrapping AudioContext before the page's own code runs.
 *
 * The bug it exists for: burning and being loved are STATES that last, but
 * they were played as one-shots on the button press. You lit the doll on fire,
 * heard a single puff, and then watched him burn in silence - which is exactly
 * what "the burning sound is missing" means. A test that only checked "does
 * pressing fire make a sound" would have passed the whole time.
 */
import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8895;
const errs = [];
const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) errs.push(`${label}\n    got:  ${JSON.stringify(got)}\n    want: ${JSON.stringify(want)}`);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}`);
};

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: ROOT, stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch {} };
process.on('exit', stop);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();

/* Count every sound the page starts, before any of its own code runs. */
await page.addInitScript(() => {
  window.__sfx = { starts: 0, loops: 0, running: 0 };
  const Real = window.AudioContext || window.webkitAudioContext;
  window.AudioContext = window.webkitAudioContext = function () {
    const ac = new Real();
    const bs = ac.createBufferSource.bind(ac);
    ac.createBufferSource = function () {
      const s = bs();
      const start = s.start.bind(s), stopFn = s.stop.bind(s);
      s.start = function (...a) { window.__sfx.starts++; window.__sfx.running++; if (s.loop) window.__sfx.loops++; return start(...a); };
      s.stop = function (...a) { window.__sfx.running--; return stopFn(...a); };
      return s;
    };
    const os = ac.createOscillator.bind(ac);
    ac.createOscillator = function () {
      const o = os();
      const start = o.start.bind(o);
      o.start = function (...a) { window.__sfx.starts++; return start(...a); };
      return o;
    };
    return ac;
  };
});

const count = () => page.evaluate(() => ({ ...window.__sfx }));

try {
  await page.goto(`http://127.0.0.1:${PORT}/beatass.html`, { waitUntil: 'networkidle' });

  /* reach the doll the same way a person does */
  await page.fill('#i-name', 'Test');
  await page.fill('#i-email', 'test@example.com');
  await page.fill('#i-msg', 'a message long enough to be allowed through to the doll screen.');
  await page.locator('button:has-text("next")').first().click().catch(() => {});
  await page.waitForTimeout(800);
  const doll = await page.locator('#doll').boundingBox();
  if (!doll) throw new Error('never reached the doll');

  console.log('\nhitting him:');
  const before = await count();
  await page.mouse.click(doll.x + doll.width * 0.5, doll.y + doll.height * 0.45);
  await page.waitForTimeout(600);
  const afterPunch = await count();
  /* a punch is layered on purpose - one node is a beep, several is a hit */
  check('a punch makes a layered sound, not a single beep', afterPunch.starts - before.starts >= 4, true);

  await page.click('.tool[data-tool="pin"]');
  await page.waitForTimeout(300);
  const beforePin = await count();
  await page.mouse.click(doll.x + doll.width * 0.5, doll.y + doll.height * 0.5);
  await page.waitForTimeout(600);
  const afterPin = await count();
  check('a pin makes a layered sound too', afterPin.starts - beforePin.starts >= 4, true);

  console.log('\nsetting him on fire:');
  await page.click('.tool[data-tool="fire"]');
  await page.waitForTimeout(1200);
  const litUp = await count();
  check('lighting the fire starts a looping sound', litUp.loops >= 1, true);

  /* THE test. Two seconds later the fire must still be making noise. */
  const t1 = await count();
  await page.waitForTimeout(2500);
  const t2 = await count();
  const crackles = t2.starts - t1.starts;
  console.log(`      (${crackles} new sounds in 2.5 seconds of burning)`);
  check('the fire KEEPS crackling while he burns, it is not one puff', crackles >= 5, true);

  console.log('\nputting it out:');
  await page.click('.tool[data-tool="fire"]');
  await page.waitForTimeout(1200);
  const t3 = await count();
  await page.waitForTimeout(2000);
  const t4 = await count();
  check('the fire goes quiet when it is turned off', t4.starts - t3.starts, 0);

  console.log('\nloving him:');
  await page.click('.tool[data-tool="love"]');
  await page.waitForTimeout(700);
  const l1 = await count();
  check('love makes a chord, not one note', l1.starts - t4.starts >= 4, true);
  await page.waitForTimeout(3200);
  const l2 = await count();
  check('being loved keeps making a soft sound', l2.starts - l1.starts >= 1, true);
  await page.click('.tool[data-tool="love"]');
  await page.waitForTimeout(1200);
  const l3 = await count();
  await page.waitForTimeout(2000);
  check('it stops when you stop', (await count()).starts - l3.starts, 0);

  console.log('\nthe mute button:');
  const muteBtn = page.locator('#b-mute, [data-mute], button:has-text("sound")').first();
  if (await muteBtn.count()) {
    await muteBtn.click();
    await page.click('.tool[data-tool="fire"]');
    await page.waitForTimeout(2500);
    const m1 = await count();
    await page.waitForTimeout(2000);
    check('muted means silent, even while burning', (await count()).starts - m1.starts, 0);
  } else {
    console.log('  --   no mute control found to test');
  }
} catch (err) {
  errs.push('the sound test could not finish: ' + err.message.split('\n')[0]);
  await page.screenshot({ path: ROOT + '/shots/sound-failure.png' }).catch(() => {});
} finally {
  await browser.close();
  stop();
}

if (errs.length) console.error('\nSOUND ERRORS:\n  ' + errs.join('\n  ') + '\n');
else console.log('\nsound: all checks pass');
process.exit(errs.length ? 1 : 0);
