/* The canary test — gate zero for the bug reporter.
 *
 * A "canary" is a unique string we plant somewhere a real secret would live,
 * and then go looking for in everything the reporter is about to send. If a
 * canary ever comes out the other end, a real confession would have too.
 *
 * This is the test that makes it acceptable to run a bug reporter on a product
 * whose entire promise is that nobody can read the message. It runs in plain
 * node against the real module — no browser needed — so it is cheap enough to
 * run on every commit.
 *
 *   node bugreport/test-privacy.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const ok = (name) => { pass++; console.log('  ok   ' + name); };
const bad = (name, got, want) => {
  fail++;
  console.log('  FAIL ' + name);
  if (got !== undefined) console.log('        got:  ' + JSON.stringify(got));
  if (want !== undefined) console.log('        want: ' + JSON.stringify(want));
};
const eq = (name, got, want) => (got === want ? ok(name) : bad(name, got, want));

/* Load the module with just enough browser around it to run.
   The fake node only has to be rich enough for the module to mount without
   throwing — this test is about what the module CAPTURES, not how it looks. */
function node() {
  const n = {
    style: {}, dataset: {}, className: '', innerHTML: '',
    firstChild: null,
    onclick: null,
    remove() {},
    focus() {},
    setAttribute() {}, getAttribute: () => null,
    appendChild() {},
    addEventListener() {},
    classList: { add() {}, remove() {} },
    querySelector: () => node(),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0 })
  };
  n.firstChild = n;
  return n;
}

function load(pathname) {
  const listeners = [];
  const sandbox = {
    location: { pathname, origin: 'https://beatass.com', href: 'https://beatass.com' + pathname },
    navigator: { userAgent: 'test', language: 'en', onLine: true },
    document: {
      cookie: '',
      title: 'beatass',
      readyState: 'complete',
      addEventListener() {},
      querySelector: () => null,
      createElement: () => node(),
      body: { appendChild() {} },
      documentElement: { classList: { add() {}, remove() {} } }
    },
    console: { error() {}, warn() {}, log() {} },
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
    performance: {},
    localStorage: { length: 0 }, sessionStorage: { length: 0 },
    TextEncoder,
    fetch: null,
    addEventListener: (...a) => listeners.push(a)
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  const src = fs.readFileSync(path.join(HERE, 'bugreport.js'), 'utf8');
  const keys = Object.keys(sandbox);
  // eslint-disable-next-line no-new-func
  new Function(...keys, src)(...keys.map((k) => sandbox[k]));
  return sandbox.BugReport;
}

console.log('\nbug reporter — privacy canaries\n');

const BR = load('/');

/* ---- 1. the things that must never survive being captured ---- */
console.log('redaction at capture time');

const CANARIES = [
  ['the confession itself has an email in it', 'I never told priya@example.com the truth', 'priya@example.com'],
  ['a recipient WhatsApp number', 'send it to +919876543210 please', '9876543210'],
  ['a bare Indian mobile', 'call 9876543210', '9876543210'],
  ['an instagram handle', 'her handle is @priya_writes', 'priya_writes'],
  ['a 16-hex message id', 'message a1b2c3d4e5f60718 failed', 'a1b2c3d4e5f60718'],
  ['a 32-hex view token', 'token 0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef']
];

for (const [name, input, secret] of CANARIES) {
  const out = BR._clean(input);
  out.includes(secret)
    ? bad(name + ' — LEAKED', out)
    : ok(name);
}

/* ---- 2. the URL rule: a /m address is a password ---- */
console.log('\nURL never carries the token');

const URLS = [
  ['/m view token is dropped', 'https://beatass.com/m?id=a1b2c3d4e5f60718&t=0123456789abcdef0123456789abcdef', '/m'],
  ['block link email is dropped', 'https://beatass.com/block?e=priya%40example.com&t=abc', '/block'],
  ['reply token is dropped', 'https://beatass.com/reply?id=a1b2c3d4e5f60718&t=deadbeef', '/reply'],
  ['media id becomes a shape', 'https://beatass.com/media/a1b2c3d4e5f60718.gif', '/media/:id.gif'],
  ['a plain path survives', 'https://beatass.com/api/send', '/api/send']
];
for (const [name, input, want] of URLS) eq(name, BR._route(input), want);

/* every URL rule, checked again for raw secrets rather than exact shape */
for (const [, input] of URLS) {
  const out = BR._route(input);
  if (out.includes('?') || /[a-f0-9]{16}/i.test(out.replace('/:id', '')) || out.includes('@'))
    bad('a URL still carries something it should not: ' + input, out);
}
ok('no captured URL contains a query string, a raw id, or an address');

/* ---- 3. describing an element must not quote what is in it ---- */
console.log('\nelement description never quotes a value');

/* The canary is deliberately a string that could ONLY have been typed by a
   person — it must not collide with any copy that is already on the page. */
const TYPED = 'CANARY7Q2X-what-I-actually-confessed';

const fakeField = {
  tagName: 'TEXTAREA',
  id: 'i-msg',
  className: 'msg',
  value: TYPED,
  textContent: TYPED,
  placeholder: "I've been holding this in for two years...",
  getAttribute: () => null,
  getBoundingClientRect: () => ({ x: 10, y: 20, width: 300, height: 120 })
};
const d = BR.describe(fakeField);
const flat = JSON.stringify(d);
flat.includes(TYPED)
  ? bad('element description leaked the typed value', flat)
  : ok('the typed value is not in the description');
flat.includes('holding this in for two years')
  ? bad('element description carried the placeholder, which reads like a confession', flat)
  : ok('the placeholder is not quoted either');
eq('the field is still identifiable', d.selector, '#i-msg');
eq('its box is still reported', d.box.w, 300);

/* ---- 4. the bundle as a whole ---- */
console.log('\nthe whole bundle');

const bundle = BR._build({
  kind: 'bug',
  note: 'It broke when I pressed send. My email is priya@example.com and the link was https://beatass.com/m?id=a1b2c3d4e5f60718&t=0123456789abcdef0123456789abcdef',
  replyEmail: 'reporter@example.com',
  elements: [d],
  screenshots: []
});
const json = JSON.stringify(bundle);

const MUST_NOT_APPEAR = [
  ['priya@example.com', 'a third party address inside the note'],
  ['0123456789abcdef0123456789abcdef', 'a view token inside the note'],
  ['a1b2c3d4e5f60718', 'a message id inside the note'],
  [TYPED, 'the confession text']
];
for (const [needle, what] of MUST_NOT_APPEAR) {
  json.includes(needle) ? bad('bundle leaked ' + what, needle) : ok('bundle has no ' + what);
}

json.includes('reporter@example.com')
  ? ok('the reporter\'s own address IS kept — they typed it on purpose')
  : bad('the reporter\'s reply address was lost', 'missing');

eq('no cookie values are collected', bundle.env.hasCookies, false);
eq('storage is a yes/no, not contents', bundle.env.hasStorage, false);

/* ---- 5. the two pages that must refuse outright ---- */
console.log('\nthe pages that may never be captured');
eq('/m refuses to arm', load('/m').allowed, false);
eq('/admin refuses to arm', load('/admin').allowed, false);
eq('the app page is allowed', load('/').allowed, true);

/* ---- 6. the ceiling still holds ---- */
console.log('\nsize ceiling');
const bufs = BR._buffers();
for (let i = 0; i < 4000; i++) bufs.logs.push({ level: 'error', text: 'x'.repeat(400), ts: Date.now() });
const big = BR._build({ kind: 'bug', note: 'y'.repeat(9000), replyEmail: '', elements: [], screenshots: [] });
const bytes = new TextEncoder().encode(JSON.stringify(big)).length;
bytes <= 512 * 1024
  ? ok('an enormous buffer still fits under 512 KB (' + Math.round(bytes / 1024) + ' KB)')
  : bad('the bundle blew the ceiling', bytes + ' bytes');
big.truncated === true
  ? ok('and it says so, rather than pretending it is complete')
  : bad('truncation was silent', big.truncated, true);

console.log('\n' + (fail === 0
  ? `privacy canaries: all ${pass} checks pass\n`
  : `privacy canaries: ${fail} FAILED of ${pass + fail}\n`));
process.exit(fail === 0 ? 0 : 1);
