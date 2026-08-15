import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import assert from 'assert/strict';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.dirname(fileURLToPath(import.meta.url));

// ---- crawl surface: prove the built page and shipped favicon files agree ----
// These checks read the build output, not template source. That catches the
// production failure we care about: correct-looking source that build.py did
// not actually publish into public/.
const builtHtml = fs.readFileSync(path.join(ROOT, 'beatass.html'), 'utf8');
const oneMeta = (pattern, label) => {
  const match = builtHtml.match(pattern);
  assert.ok(match, `built homepage is missing ${label}`);
  return match[1];
};
const searchTitle = oneMeta(/<title>([^<]+)<\/title>/, 'title');
const ogTitle = oneMeta(/<meta property="og:title" content="([^"]+)">/, 'og:title');
const twitterTitle = oneMeta(/<meta name="twitter:title" content="([^"]+)">/, 'twitter:title');
assert.equal(ogTitle, searchTitle, 'og:title drifted from the search title');
assert.equal(twitterTitle, searchTitle, 'twitter:title drifted from the search title');
// No emoji and no em-dash on purpose (Sanjay, 2026-08-03): Google strips the
// emoji anyway, and the em-dash reads as an AI tell in the search listing.
assert.match(searchTitle, /^BeatAss /, 'search title lost the proper-cased brand');
assert.ok(!/[—–…👊😈🪆🔥]/u.test(searchTitle), 'search title has an emoji or em-dash again');

const searchDescription = oneMeta(/<meta name="description" content="([^"]+)">/, 'description');
const ogDescription = oneMeta(/<meta property="og:description" content="([^"]+)">/, 'og:description');
const twitterDescription = oneMeta(/<meta name="twitter:description" content="([^"]+)">/, 'twitter:description');
assert.equal(ogDescription, searchDescription, 'og:description drifted from the search description');
assert.equal(twitterDescription, searchDescription, 'twitter:description drifted from the search description');
assert.ok([...searchDescription].length < 155, 'search description is 155 characters or longer');
assert.ok(!/[—–…👊😈🪆🔥]/u.test(searchDescription), 'search description has an emoji or em-dash again');

assert.match(builtHtml, /<link rel="icon" href="\/favicon\.ico" sizes="any">/,
  'built homepage does not declare /favicon.ico');
assert.match(builtHtml, /<link rel="icon" type="image\/png" sizes="48x48" href="\/favicon-48\.png">/,
  'built homepage does not declare the 48x48 PNG favicon');

// A picture written into the HTML as a data: URI has no web address of its own,
// so Google's favicon crawler can never fetch it - and declared last, it is the
// one browsers pick. One lived here until 2026-08-03 and the search result
// showed a blank icon the whole time.
assert.doesNotMatch(builtHtml, /<link[^>]*rel="icon"[^>]*href="data:/,
  'the homepage declares an inline data: favicon again - Google cannot fetch one');

// Google reads the site name from these two and the title. They have to agree,
// or it falls back to showing the bare domain.
assert.match(builtHtml, /<meta property="og:site_name" content="BeatAss">/,
  'og:site_name no longer says BeatAss');
assert.match(builtHtml, /"@type":"WebSite"[^}]*"name":"BeatAss"/,
  'the WebSite structured data no longer names the site BeatAss');

const png48 = fs.readFileSync(path.join(ROOT, 'public', 'favicon-48.png'));
assert.deepEqual([...png48.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
  'favicon-48.png is not a PNG');
assert.equal(png48.readUInt32BE(16), 48, 'favicon-48.png width is not 48');
assert.equal(png48.readUInt32BE(20), 48, 'favicon-48.png height is not 48');

const ico = fs.readFileSync(path.join(ROOT, 'public', 'favicon.ico'));
assert.equal(ico.readUInt16LE(0), 0, 'favicon.ico reserved header is invalid');
assert.equal(ico.readUInt16LE(2), 1, 'favicon.ico is not an icon container');
assert.equal(ico.readUInt16LE(4), 3, 'favicon.ico does not contain exactly three images');
const icoSizes = Array.from({length: 3}, (_, index) => {
  const offset = 6 + index * 16;
  return [ico[offset] || 256, ico[offset + 1] || 256];
});
assert.deepEqual(icoSizes, [[16, 16], [32, 32], [48, 48]],
  'favicon.ico does not contain 16, 32 and 48 pixel images');

const robots = fs.readFileSync(path.join(ROOT, 'public', 'robots.txt'), 'utf8');
assert.match(robots, /User-agent: \*\nAllow: \//, 'robots.txt does not allow the site');
assert.doesNotMatch(robots, /Disallow: \/favicon(?:\.ico|-48\.png)/,
  'robots.txt blocks a Google favicon path');
console.log('search metadata + favicon package: pass');

/* The API the page really talks to. Mocked at the real endpoint on purpose: the
   app posts the same multipart body it would post to the Worker, so this test
   fails the moment the two drift apart. The first call answers 429 so the
   failure path gets exercised; every call after it succeeds. The raw body is
   kept so we can prove the fields and the media actually left the browser. */
const sent={count:0,body:'',type:''};
const srv=http.createServer((q,s)=>{
  if(q.url==='/api/send' && q.method==='POST'){
    const chunks=[];
    q.on('data',c=>chunks.push(c));
    q.on('end',()=>{
      sent.count++;
      sent.body=Buffer.concat(chunks).toString('latin1');
      sent.type=q.headers['content-type']||'';
      const first=sent.count===1;
      s.writeHead(first?429:200,{'Content-Type':'application/json'});
      s.end(first
        ? JSON.stringify({error:"That's enough for one hour. Come back later."})
        : JSON.stringify({ok:true,id:'0123456789abcdef'}));
    });
    return;
  }
  /* Read the file BEFORE writing the header. The other way round, a missing
     file threw after the 200 had already gone out, and the 404 attempt then
     crashed the whole run with ERR_HTTP_HEADERS_SENT - which is how adding
     /sfx/*.mp3 to the page took this test down with it.
     Falls back to public/ so the built assets (sound effects, icons) resolve
     the same way they do in production. */
  const rel = q.url === '/' ? 'beatass.html' : decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
  const TYPES = { '.html':'text/html', '.mp3':'audio/mpeg', '.png':'image/png', '.svg':'image/svg+xml',
                  '.css':'text/css', '.js':'text/javascript', '.xml':'application/xml', '.txt':'text/plain' };
  let body = null;
  for(const base of [ROOT, path.join(ROOT,'public')]){
    try{ body = fs.readFileSync(path.join(base, rel)); break; }catch{}
  }
  if(body === null){ s.writeHead(404); s.end(); return; }
  s.writeHead(200,{'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream'});
  s.end(body);
});
await new Promise(r=>srv.listen(8894,r));
fs.mkdirSync(ROOT+'/shots',{recursive:true});
const b=await chromium.launch();
const errs=[];

// ---- sizes to prove "no scroll" ----
const sizes = [
  ['desktop', 1440, 900], ['laptop', 1280, 720], ['small-laptop', 1180, 640],
  ['tablet', 820, 1180], ['iphone', 390, 844], ['android-small', 360, 640], ['iphone-se', 375, 667]
];
for(const [name,w,h] of sizes){
  const p = await b.newPage({viewport:{width:w,height:h}, isMobile:w<600, hasTouch:w<600});
  p.on('pageerror',e=>errs.push(name+' PE: '+e.message));
  await p.goto('http://localhost:8894/',{waitUntil:'networkidle'});
  await p.waitForTimeout(700);
  /* Page-level scroll is NOT the whole story: on phones the column between the
     header and the send bar is its own scroll box, so content can be squashed
     out of reach while document height stays exactly one screen and this test
     reports a clean pass. That is how the message box once ended up sitting
     under the send bar, unreachable, with every size "passing". So scroll that
     inner box to its end first, then check the things that must be reachable
     really are. */
  const m = await p.evaluate(()=>{
    const sc = document.querySelector('.scroller');
    sc.scrollTop = sc.scrollHeight;
    return new Promise(res => requestAnimationFrame(()=>{
      const box = s => { const r = document.querySelector(s).getBoundingClientRect();
                         return {top:Math.round(r.top), bottom:Math.round(r.bottom)}; };
      const bar = box('.sendbar'), msg = box('.confess'), legal = box('.legal'), btn = box('#go');
      res({
        docH: document.documentElement.scrollHeight,
        winH: window.innerHeight,
        canScrollY: document.documentElement.scrollHeight > window.innerHeight + 1,
        canScrollX: document.documentElement.scrollWidth  > window.innerWidth  + 1,
        canvas: (()=>{const r=document.querySelector('#doll').getBoundingClientRect();
          return {w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)};})(),
        btnBottom: Math.round(btn.bottom),
        msgReachable: msg.bottom <= bar.top + 1,
        legalBelowButton: legal.top >= btn.bottom - 1,
        legalOnScreen: legal.top >= 0 && legal.bottom <= window.innerHeight + 1
      });
    }));
  });
  console.log(name.padEnd(14), w+'x'+h, '| scrollY:', m.canScrollY, '| scrollX:', m.canScrollX,
              '| doc', m.docH, 'vs win', m.winH, '| canvas', m.canvas.w+'px', '| btn bottom', m.btnBottom,
              '| msg reachable:', m.msgReachable, '| legal under btn:', m.legalBelowButton,
              '| legal on screen:', m.legalOnScreen);
  if(!m.msgReachable)     errs.push(name+': the message box cannot be scrolled clear of the send bar');
  if(!m.legalBelowButton) errs.push(name+': the legal row is not below the send button');
  if(!m.legalOnScreen)    errs.push(name+': the legal row is off screen');
  await p.screenshot({path:`${ROOT}/shots/v3-${name}.png`});
  await p.close();
}

// ---- full flow on desktop ----
const p = await b.newPage({viewport:{width:1280,height:800}});
p.on('pageerror',e=>errs.push('PE: '+e.message));
// the 429 below is one we cause on purpose, so the browser logging it isn't a fault
p.on('console',m=>{if(m.type()==='error' && !/\b429\b/.test(m.text()))errs.push('CE: '+m.text())});
await p.goto('http://localhost:8894/',{waitUntil:'networkidle'});
await p.waitForTimeout(600);

await p.click('#go');
console.log('empty form blocked (no overlay):', !(await p.isVisible('#ov-preview.on')));
console.log('errors shown:', await p.isVisible('#f-name.bad'), await p.isVisible('#f-email.bad'));

await p.fill('#i-name','Priya'); await p.fill('#i-email','priya@example.com');
await p.click('.chip[data-tone="grudge"]'); await p.waitForTimeout(200);
await p.fill('#i-msg',"You told everyone what I said in confidence. I smiled at you the next day anyway. I've been carrying that around for three years and you have no idea.");
// the doll is optional: a valid form previews immediately, words-only, no clip
await p.click('#go');
await p.waitForTimeout(300);
const noDollOpen = await p.isVisible('#ov-preview.on');
const noDollClip = await p.evaluate(()=>document.querySelector('#ov-preview .gifwrap').hidden);
console.log('previews without touching the doll:', noDollOpen, '| clip hidden:', noDollClip);
if(!noDollOpen) errs.push('preview did not open without touching the doll');
if(noDollOpen && !noDollClip) errs.push('untouched preview still shows a clip');
await p.click('#btn-back'); await p.waitForTimeout(250);

const box=await p.locator('#doll').boundingBox(); const at=(x,y)=>({x:box.x+box.width*x,y:box.y+box.height*y});
for(const c of [[0.42,0.3],[0.58,0.4],[0.44,0.5],[0.6,0.32]]){const q=at(...c);await p.mouse.click(q.x,q.y);await p.waitForTimeout(170);}
await p.click('.tool[data-tool="pin"]');
for(const c of [[0.5,0.27],[0.47,0.5]]){const q=at(...c);await p.mouse.click(q.x,q.y);await p.waitForTimeout(150);}
await p.click('.tool[data-tool="fire"]'); await p.waitForTimeout(2000);
await p.screenshot({path:ROOT+'/shots/v3-playing.png'});
await p.waitForTimeout(2600);

await p.click('#go');
await p.waitForFunction(()=>document.querySelector('#ov-preview').classList.contains('on'),null,{timeout:60000});
await p.waitForTimeout(400);
// the optional reply-to address lives in the preview, next to the send button
await p.fill('#i-sender','me@example.com');
const sig=await p.evaluate(async()=>{const r=await fetch(document.querySelector('#p-gif').src);const bl=await r.blob();
  const u=new Uint8Array(await bl.slice(0,6).arrayBuffer());return String.fromCharCode(...u)+' '+Math.round(bl.size/1024)+'KB';});
console.log('gif in preview:', sig);
const ovFits = await p.evaluate(()=>{const c=document.querySelector('#ov-preview .card').getBoundingClientRect();
  return {top:Math.round(c.top), bottom:Math.round(c.bottom), win:window.innerHeight};});
console.log('preview card fits:', JSON.stringify(ovFits));
await p.screenshot({path:ROOT+'/shots/v3-preview.png'});
const b64=await p.evaluate(async()=>{const r=await fetch(document.querySelector('#p-gif').src);const u=new Uint8Array(await r.arrayBuffer());let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s)});
fs.writeFileSync(ROOT+'/sample.gif',Buffer.from(b64,'base64'));
// ---- the video export: Instagram and Snapchat reject GIFs, so this must be a real MP4 ----
const vid = await p.evaluate(async () => {
  const can = typeof MediaRecorder !== 'undefined' &&
    ['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=h264','video/mp4']
      .some(m => MediaRecorder.isTypeSupported(m));
  if (!can) return {supported:false};
  if (!window.__state || !window.__state.videoBlob) return {supported:true, made:false};
  const b = window.__state.videoBlob;
  const u = new Uint8Array(await b.slice(0,12).arrayBuffer());
  // a real MP4 has 'ftyp' at byte offset 4
  return {supported:true, made:true, kb:Math.round(b.size/1024), type:b.type,
          ftyp:String.fromCharCode(...u.slice(4,8))};
});
console.log('video export:', JSON.stringify(vid));
if (vid.supported && vid.made && vid.ftyp !== 'ftyp') errs.push('video is not a valid MP4');
if (vid.supported && !vid.made) errs.push('browser supports MP4 but no video was produced');

/* ---- the send. The first attempt is refused by the API: the app must say so
       in plain words and must NOT claim the message is gone. ---- */
await p.click('button:has-text("Send it")'); await p.waitForTimeout(500);
const refusedMsg = await p.textContent('#send-err');
const liedAboutSending = await p.isVisible('#ov-sent.on');
console.log('API refused →', JSON.stringify(refusedMsg), '| still on the preview:', !liedAboutSending);
if(liedAboutSending) errs.push('claimed "It\'s gone" after the API refused the send');
if(!/enough for one hour/.test(refusedMsg||'')) errs.push("the API's own error text was not shown");
await p.screenshot({path:ROOT+'/shots/v3-send-error.png'});

// second attempt: the API accepts it
await p.click('button:has-text("Send it")'); await p.waitForTimeout(600);
console.log('sent overlay:', await p.isVisible('#ov-sent.on'));
if(!(await p.isVisible('#ov-sent.on'))) errs.push('the sent screen never opened after a successful send');

// prove the POST carried everything the Worker reads out of it
const want = ['name="name"','name="email"','name="message"','name="stats"','name="caption"','name="senderEmail"','name="gif"'];
if(vid.made) want.push('name="mp4"');
const missing = want.filter(f => !sent.body.includes(f));
console.log('POST /api/send:', sent.count, 'calls |', Math.round(sent.body.length/1024)+'KB |',
  missing.length ? 'MISSING '+missing.join(', ') : 'all fields present',
  '| recipient carried:', sent.body.includes('priya@example.com'));
if(missing.length) errs.push('fields missing from the POST body: '+missing.join(', '));
if(!sent.body.includes('priya@example.com')) errs.push('the recipient address never reached the API');
if(!sent.body.includes('me@example.com')) errs.push('the sender reply-to address never reached the API');
/* Consent defaults to NO. Nobody ticked the share box on this send, so the
   field must be absent - a message nobody agreed to share is never postable. */
console.log('share consent default:', sent.body.includes('name="shareOk"') ? 'LEAKED A YES' : 'no (correct)');
if(sent.body.includes('name="shareOk"')) errs.push('an unticked share box still sent consent to the API');
if(!/^multipart\/form-data/.test(sent.type)) errs.push('the POST was not multipart/form-data');
if(!sent.body.includes('GIF89a')) errs.push('no real GIF bytes in the POST body');
await p.screenshot({path:ROOT+'/shots/v3-sent.png'});
await p.click('button:has-text("Send another")'); await p.waitForTimeout(400);
console.log('reset ok:', (await p.inputValue('#i-name'))==='' , '| overlay closed:', !(await p.isVisible('#ov-sent.on')));

/* ---- handle-only: no email, an Instagram handle instead. The doll stays
       untouched, so this also proves the words-only path posts cleanly. ---- */
await p.fill('#i-name','Dev'); await p.fill('#i-handle','@Some.Person_99');
await p.fill('#i-msg','no email this time, find them on instagram');
await p.click('#go'); await p.waitForTimeout(400);
const hOpen = await p.isVisible('#ov-preview.on');
const hTo = hOpen ? await p.textContent('#p-to') : '';
// the reset must have cleared the previous send's consent, not carried it over
const shareCarried = await p.isChecked('#i-share');
if(shareCarried) errs.push('the share box stayed ticked after a reset - consent must be per message');
await p.check('#i-share');                       // this time the sender says yes
await p.click('button:has-text("Send it")'); await p.waitForTimeout(600);
const shareSent = sent.body.includes('name="shareOk"') && /name="shareOk"[\s\S]{0,40}?1/.test(sent.body);
console.log('share consent when ticked:', shareSent ? 'yes, carried' : 'NEVER REACHED THE API');
if(!shareSent) errs.push('a ticked share box did not reach the API');
const hLine = await p.textContent('#sent-line').catch(()=> '');
const hasHandle = sent.body.includes('name="handle"') && sent.body.includes('some.person_99');
const noEmailField = !sent.body.includes('name="email"');
console.log('handle-only send:', hOpen, '| to shows:', JSON.stringify(hTo),
  '| handle carried:', hasHandle, '| email omitted:', noEmailField,
  '| honest copy:', /Instagram/.test(hLine));
if(!hOpen) errs.push('handle-only preview did not open');
if(hOpen && hTo !== '@some.person_99') errs.push('preview "to" line did not show the handle');
if(!hasHandle) errs.push('the handle never reached the API');
if(!noEmailField) errs.push('an email field was posted on a handle-only send');
if(!/Instagram/.test(hLine)) errs.push('the sent screen did not say the message goes to Instagram');
await p.click('button:has-text("Send another")').catch(()=>{});
await p.waitForTimeout(300);

/* ---- whatsapp-only: no email, no handle, a number typed the messy way.
       Proves the +91 is added for them, the spaces are cleaned off, and the
       API is handed the one shape the database stores. ---- */
await p.fill('#i-name','Anjali'); await p.fill('#i-wa','098765 43210');
await p.fill('#i-msg','no email, no instagram, just whatsapp');
await p.click('#go'); await p.waitForTimeout(400);
const wOpen = await p.isVisible('#ov-preview.on');
const wTo = wOpen ? await p.textContent('#p-to') : '';
await p.click('button:has-text("Send it")'); await p.waitForTimeout(600);
const wLine = await p.textContent('#sent-line').catch(()=> '');
const hasWa = sent.body.includes('name="whatsapp"') && sent.body.includes('+919876543210');
const waNoEmail = !sent.body.includes('name="email"') && !sent.body.includes('name="handle"');
console.log('whatsapp-only send:', wOpen, '| to shows:', JSON.stringify(wTo),
  '| number normalised:', hasWa, '| other channels omitted:', waNoEmail,
  '| honest copy:', /WhatsApp/.test(wLine));
if(!wOpen) errs.push('whatsapp-only preview did not open');
if(wOpen && wTo !== '+919876543210') errs.push('preview "to" line did not show the whatsapp number');
if(!hasWa) errs.push('the whatsapp number never reached the API in +91 form');
if(!waNoEmail) errs.push('an email or handle field was posted on a whatsapp-only send');
if(!/WhatsApp/.test(wLine)) errs.push('the sent screen did not say the message goes to WhatsApp');
await p.click('button:has-text("Send another")').catch(()=>{});
await p.waitForTimeout(300);

/* A number that cannot be an Indian mobile must stop the send, not travel to
   the server and come back as an error. */
await p.fill('#i-name','Nope'); await p.fill('#i-wa','12345');
await p.fill('#i-msg','this number is not a real one');
await p.click('#go'); await p.waitForTimeout(400);
const badWaBlocked = !(await p.isVisible('#ov-preview.on'));
const badWaFlagged = await p.locator('#f-wa').evaluate(el => el.classList.contains('bad'));
console.log('bad whatsapp number:', badWaBlocked ? 'blocked (correct)' : 'LET THROUGH',
  '| field flagged:', badWaFlagged);
if(!badWaBlocked) errs.push('a bad whatsapp number still opened the preview');
if(!badWaFlagged) errs.push('a bad whatsapp number did not turn the field red');
await p.fill('#i-wa',''); await p.fill('#i-name',''); await p.fill('#i-msg','');

// mobile flow + overlay fit
const m2 = await b.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
await m2.goto('http://localhost:8894/',{waitUntil:'networkidle'}); await m2.waitForTimeout(600);
await m2.fill('#i-name','Priya'); await m2.fill('#i-email','p@e.com'); await m2.fill('#i-msg','you know what you did');
const mb=await m2.locator('#doll').boundingBox();
for(const c of [[0.45,0.35],[0.55,0.45]]){await m2.tap({position:{x:0,y:0}}).catch(()=>{});}
await m2.mouse.click(mb.x+mb.width*0.45, mb.y+mb.height*0.35);
await m2.mouse.click(mb.x+mb.width*0.55, mb.y+mb.height*0.45);
await m2.screenshot({path:ROOT+'/shots/v3-mobile-playing.png'});
await m2.waitForTimeout(5200);
await m2.click('#go');
await m2.waitForFunction(()=>document.querySelector('#ov-preview').classList.contains('on'),null,{timeout:60000});
await m2.waitForTimeout(400);
const movFits = await m2.evaluate(()=>{const c=document.querySelector('#ov-preview .card').getBoundingClientRect();
  return {top:Math.round(c.top),bottom:Math.round(c.bottom),win:window.innerHeight,
          pageScroll:document.documentElement.scrollHeight>window.innerHeight+1};});
console.log('mobile preview:', JSON.stringify(movFits));
/* The send button and the consent box both live at the bottom of this card. If
   the card runs off the screen they are below the fold, and the last thing
   anyone sees before sending is cut in half. Measured, not eyeballed. */
if(movFits.bottom > movFits.win) errs.push(`the preview card runs ${movFits.bottom-movFits.win}px off the bottom of a phone screen`);
if(movFits.top < 0) errs.push(`the preview card runs ${-movFits.top}px off the top of a phone screen`);
await m2.screenshot({path:ROOT+'/shots/v3-mobile-preview.png'});

console.log('ERRORS:', errs.length?errs:'none');
await b.close(); srv.close();
/* Exit non-zero on any finding so a real regression FAILS `npm test`, instead
   of printing to stdout while the suite still reports success - which is exactly
   what happened when a layout change pushed the preview 2px off a phone and the
   chain sailed on to the next test. A check that cannot fail is not a check. */
process.exit(errs.length ? 1 : 0);
