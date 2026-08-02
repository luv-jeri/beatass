/* See the email without sending one.
 *
 *   node tools/email-preview.mjs        writes email-preview.html and opens it
 *   node tools/email-preview.mjs --no-open   just writes the file
 *
 * It calls the same emailHtml() the Worker calls, so what you look at is what
 * would actually land in somebody's inbox. A hand-written mock would drift from
 * the real one within a week and then quietly lie to us.
 */
import { emailHtml } from '../src/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';

/* Point at the local server by default. The email pulls its masthead off the
   site, and against the real domain that image is whatever is deployed there —
   so previewing a change you have not shipped yet would show you the old one,
   or a broken box. Pass --live to check what the world currently gets. */
const SITE = process.argv.includes('--live')
  ? 'https://beatass.com'
  : (process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:8791');

function gifDataUri() {
  const f = path.join(ROOT, 'sample.gif');
  if (!fs.existsSync(f)) {
    console.log('note: no sample.gif yet, the preview will show no picture.');
    console.log('      run `npm test` once to produce one.');
    return '';
  }
  return 'data:image/gif;base64,' + fs.readFileSync(f).toString('base64');
}

// A message with the awkward bits in it: an apostrophe, a line break, and a
// character that must come out escaped rather than as markup.
const sample = {
  name: 'Priya',
  body: `You told everyone what I said in confidence.

I smiled at you the next day anyway. I've been carrying that around for three years & you have no idea.`,
  stats: 'damage 74% / love 12%',
  caption: '...and this is what they did to you. (damage 74%)',
  /* The real thing, animating. A live email points at /media/<id>.gif in R2,
     which does not exist until somebody actually sends one — so the preview
     carries the last GIF the test suite produced, inlined. It is the same
     bytes the recipient would get, so what animates here is what animates
     there. If it is missing, run `npm test` once to make one. */
  gifUrl: gifDataUri(),
  pageUrl: SITE,
  blockUrl: `${SITE}/block?e=priya%40example.com&t=preview`,
  reportUrl: `${SITE}/report?id=preview&t=preview`
};

const variants = [
  ['as it is normally sent', sample],
  ['no picture (the browser could not record)', { ...sample, gifUrl: '' }],
  ['a one line message', { ...sample, body: 'i still think about you.' }]
];

const page = `<!doctype html><meta charset="utf-8"><title>beatass email preview</title>
<body style="margin:0;background:#33302a;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
${variants.map(([label, data]) => `
<p style="margin:0;padding:18px 16px 8px;color:#e8e0cc;font-size:13px;letter-spacing:.12em;text-transform:uppercase">${label}</p>
<iframe style="width:100%;max-width:640px;height:860px;border:0;display:block;margin:0 auto 26px"
  srcdoc="${emailHtml(data).replace(/"/g, '&quot;')}"></iframe>`).join('')}
</body>`;

const out = path.join(ROOT, 'email-preview.html');
fs.writeFileSync(out, page);
console.log('wrote ' + out);
console.log(variants.length + ' versions: ' + variants.map(v => v[0]).join(', '));

if (!process.argv.includes('--no-open')) {
  execFile('open', [out], (err) => { if (err) console.log('open it yourself: ' + out); });
}
