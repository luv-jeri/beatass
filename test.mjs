import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const srv=http.createServer((q,s)=>{try{s.writeHead(200,{'Content-Type':'text/html'});s.end(fs.readFileSync(path.join(ROOT,q.url==='/'?'beatass.html':q.url.split('?')[0])))}catch{s.writeHead(404);s.end()}});
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
  const m = await p.evaluate(()=>({
    docH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
    canScrollY: document.documentElement.scrollHeight > window.innerHeight + 1,
    canScrollX: document.documentElement.scrollWidth  > window.innerWidth  + 1,
    canvas: (()=>{const r=document.querySelector('#doll').getBoundingClientRect();
      return {w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom)};})(),
    btnBottom: Math.round(document.querySelector('#go').getBoundingClientRect().bottom)
  }));
  console.log(name.padEnd(14), w+'x'+h, '| scrollY:', m.canScrollY, '| scrollX:', m.canScrollX,
              '| doc', m.docH, 'vs win', m.winH, '| canvas', m.canvas.w+'px', '| btn bottom', m.btnBottom);
  await p.screenshot({path:`${ROOT}/shots/v3-${name}.png`});
  await p.close();
}

// ---- full flow on desktop ----
const p = await b.newPage({viewport:{width:1280,height:800}});
p.on('pageerror',e=>errs.push('PE: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CE: '+m.text())});
await p.goto('http://localhost:8894/',{waitUntil:'networkidle'});
await p.waitForTimeout(600);

await p.click('#go');
console.log('empty form blocked (no overlay):', !(await p.isVisible('#ov-preview.on')));
console.log('errors shown:', await p.isVisible('#f-name.bad'), await p.isVisible('#f-email.bad'));

await p.fill('#i-name','Priya'); await p.fill('#i-email','priya@example.com');
await p.click('.chip[data-tone="grudge"]'); await p.waitForTimeout(200);
await p.fill('#i-msg',"You told everyone what I said in confidence. I smiled at you the next day anyway. I've been carrying that around for three years and you have no idea.");
await p.click('#go');
await p.waitForTimeout(300);
console.log('blocked until doll touched:', !(await p.isVisible('#ov-preview.on')), '| hint:', await p.textContent('#hint'));

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

await p.click('button:has-text("Send it")'); await p.waitForTimeout(500);
console.log('sent overlay:', await p.isVisible('#ov-sent.on'));
await p.screenshot({path:ROOT+'/shots/v3-sent.png'});
await p.click('button:has-text("Send another")'); await p.waitForTimeout(400);
console.log('reset ok:', (await p.inputValue('#i-name'))==='' , '| overlay closed:', !(await p.isVisible('#ov-sent.on')));

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
await m2.screenshot({path:ROOT+'/shots/v3-mobile-preview.png'});

console.log('ERRORS:', errs.length?errs:'none');
await b.close(); srv.close();
