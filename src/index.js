import PostalMime from 'postal-mime';

/**
 * beatass — the API.
 *
 * Six jobs, and nothing else:
 *   POST /api/send   take a confession + its GIF/MP4, store them, email it
 *   GET  /media/:id  serve the GIF or MP4 out of R2
 *   GET  /block      permanently stop mail to an address (one click, from the email)
 *   GET  /report     flag a message so it can be looked at
 *   GET/POST /reply  the recipient answers; we relay it to the sender's stored address
 *   email()          inbound mail to reply+<id>@ is relayed between the two parties
 *
 * Everything else on the domain is a static file, served before this runs.
 *
 * The abuse controls here are not decoration. This is anonymous mail to people
 * who did not opt in; without a working block link, a report route, and a rate
 * limit, the domain gets blocklisted and every email stops arriving — including
 * the wanted ones.
 */

const MAX_GIF = 3 * 1024 * 1024;   //  3 MB — comfortably above the ~670 KB we make
const MAX_MP4 = 12 * 1024 * 1024;  // 12 MB — a 4.8s 1080x1920 clip lands near 260 KB
const MAX_BODY = 600;
const MAX_NAME = 60;
const MAX_REPLY = 1000;
const RATE_LIMIT = 5;              // sends
const RATE_WINDOW = 60 * 60;       // per hour, per IP
const RELAY_LIMIT = 20;            // relayed mail-app replies (Sanjay's ceiling, 2026-08-02)
const RELAY_WINDOW = 60 * 60 * 24; // per writer, per day

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });

const okEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

/* ---------- small crypto helpers ---------- */

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Signs the block/report links so nobody can block an address that isn't theirs. */
const token = (secret, value) => hmac(secret, value).then((h) => h.slice(0, 32));

/** Constant-time compare, so a token can't be guessed one character at a time. */
function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** We never store a raw IP — only a salted hash, enough to rate-limit and to
 *  investigate a report, not enough to identify anybody. */
const hashIp = (secret, ip) => hmac(secret, 'ip:' + ip).then((h) => h.slice(0, 24));

/** The address a mail-app reply lands on. The +id part routes it back to this
 *  Worker, which is how a reply finds its way to the right stored sender. */
const replyAddr = (env, mid) => 'reply+' + mid + '@' + String(env.MAIL_REPLY_TO).split('@').pop();

const id16 = () =>
  [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

/* ---------- the email ----------
   Plain, white, and boring on purpose. It is pretending to be a normal
   message, and every hand-drawn flourish we add here costs deliverability. */
function emailHtml({ name, body, stats, caption, gifUrl, pageUrl, blockUrl, reportUrl, replyUrl }) {
  /* The front end sends the finished caption because it is the only side that
     knows whether the visit was loving or a beating. Falling back to the stats
     keeps older clients working, and an empty caption is fine. */
  const line = caption
    ? esc(caption)
    : (stats ? `…and this is what they did to you. (${esc(stats)})` : '');
  /* Built out of tables and inline styles because that is the only layout every
     mail client agrees on — Gmail strips <style> blocks, Outlook renders with
     Word. The page's own fonts cannot come along (a mail client will not load a
     web font), so the look is carried by what does survive: the cream paper, the
     red margin rule down the left, blue ink for words and red pen for marks.
     No background-image either; Outlook drops it, and a design that collapses to
     a white void in one client is not a design. */
  const PAPER = '#fbf7ea', PAPER2 = '#fffdf5', INK = '#26356e',
        SOFT = '#5b6a9c', FAINT = '#93a0c2', RED = '#cf3a2d', MARGIN = '#e3a8a2',
        HL = '#ffe873';
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

  // Let the recipient broadcast it. Email can't do a native share sheet, so
  // these are plain links; "Open & share the clip" hands off to the /m page,
  // which has the real Share button. The sender is never named in any of it.
  const shareText = "someone said the thing they'd never say about me \u{1F440} beatass.com";
  const xShare = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent('https://beatass.com');
  const waShare = 'https://wa.me/?text=' + encodeURIComponent(shareText + ' https://beatass.com');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>Somebody wanted you to see this</title>
<style>
/* Gmail strips this block, which is why every rule above is also inline. What
   survives here is the phone case: Apple Mail, Outlook mobile and Gmail's iOS
   app all keep media queries, and those are where most of these get opened.
   Below 480px the padding halves and the type steps down, because 26px of
   padding either side of a 320px screen leaves the message in a gutter. */
@media only screen and (max-width:480px){
  .wrap{padding:10px 6px !important}
  .pad{padding:2px 14px 18px !important}
  .msg{padding:20px 16px !important;font-size:19px !important}
  .greet{font-size:15px !important}
  .cta{font-size:17px !important;padding:14px 24px !important}
  .doll{width:100% !important;max-width:260px !important}
}
/* Some clients force a dark background under us. Keep the paper cream rather
   than letting blue ink land on near-black. */
@media (prefers-color-scheme:dark){
  .sheet{background:#fbf7ea !important}
  .msg{background:#fffdf5 !important;color:#26356e !important}
}
</style></head>
<body style="margin:0;padding:0;background:#e8e0cc;">
<!-- what shows in the inbox list before anything is opened -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(body).slice(0, 90)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="wrap" style="background:#e8e0cc;padding:22px 10px">
<tr><td align="center">

<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="sheet" style="width:100%;max-width:560px;background:${PAPER};border:2px solid ${INK};border-radius:14px 10px 16px 9px">

  <!-- the red margin rule, the way it runs down the page on the site -->
  <tr><td style="padding:0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="10" style="width:10px;background:${MARGIN};border-radius:12px 0 0 8px">&nbsp;</td>
      <td style="padding:0">

        <!-- The handwriting, as a picture. A mail client will not load a web
             font, so the one thing that makes this product look like itself has
             to arrive as pixels or not at all. Drawn at 2x by
             tools/make-email-header.mjs from the same doll the site uses. -->
        <a href="${pageUrl}" style="text-decoration:none"><img src="${pageUrl}/email-header.png" alt="beatass — say the thing you'd never say" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0"></a>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="pad" style="padding:4px 26px 22px">

        <!-- highlighter on the domain, as the site marks a word worth keeping.
             A flat background rather than a gradient: Outlook drops gradients. -->
        <p class="greet" style="margin:0 0 22px;font-family:${SANS};font-size:16px;line-height:1.7;color:${SOFT}">Hi ${esc(name)}, someone used <a href="${pageUrl}" style="background:${HL};color:${INK};font-weight:700;text-decoration:underline;padding:2px 5px;border-radius:4px 6px 3px 5px">beatass.com</a> to say something to you. They chose to stay anonymous.</p>

        <!-- The message is the whole reason this email exists, so it gets to be
             the loudest thing in it. Everything above and below is deliberately
             quieter than this block. -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER2};border:3px solid ${INK};border-radius:14px 10px 16px 9px">
          <tr>
            <td width="11" style="width:11px;background:${RED};border-radius:11px 0 0 7px">&nbsp;</td>
            <td class="msg" style="padding:28px 26px;font-family:${SANS};font-size:22px;line-height:1.62;font-weight:700;color:${INK};white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;word-break:break-word">${esc(body)}</td>
          </tr>
        </table>

        ${gifUrl ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
          <tr><td align="center" style="padding:0">
            <a href="${pageUrl}" style="text-decoration:none"><img src="${gifUrl}" alt="What they did to the doll" width="300" class="doll" style="display:block;max-width:100%;border:2px solid ${INK};border-radius:9px 12px 8px 11px"></a>
          </td></tr>
          ${line ? `<tr><td align="center" style="padding:11px 0 0;font-family:${SANS};font-size:14px;color:${RED}">${line}</td></tr>` : ''}
        </table>` : (line ? `<p style="margin:18px 0 0;text-align:center;font-family:${SANS};font-size:14px;color:${RED}">${line}</p>` : '')}

${replyUrl ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px">
          <tr><td align="center" style="padding:22px 0 0;border-top:2px dotted ${FAINT}">
            <p style="margin:0 0 4px;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK};font-weight:700">Want to answer them?</p>
            <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.5;color:${SOFT}">Whoever sent this left a way to hear back.<br>Hit reply, or use the button. They stay anonymous either way.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
              <td align="center" style="background:${RED};border-radius:10px 13px 9px 12px">
                <a href="${replyUrl}" class="cta" style="display:inline-block;color:#ffffff;font-family:${SANS};font-size:18px;font-weight:700;text-decoration:none;padding:15px 34px">Reply to them</a>
              </td>
            </tr></table>
            <p style="margin:12px 0 0;font-family:${SANS};font-size:12px;color:${FAINT}"><a href="${pageUrl}" style="color:${SOFT}">or send a fresh one of your own</a></p>
          </td></tr>
        </table>` : `
        <!-- The one thing people asked for and could not find: how to send one
             back. Reply goes to us, not to them, so a button is the only honest
             answer to "how do I respond to this?" -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px">
          <tr><td align="center" style="padding:22px 0 0;border-top:2px dotted ${FAINT}">
            <p style="margin:0 0 4px;font-family:${SANS};font-size:15px;line-height:1.5;color:${INK};font-weight:700">Want to say something back?</p>
            <!-- Nothing here can say "him" or "her". The whole point is that the
                 person reading this does not know who sent it, and guessing
                 wrong is the one thing that would break the spell. -->
            <p style="margin:0 0 16px;font-family:${SANS};font-size:14px;line-height:1.5;color:${SOFT}">Hitting reply reaches us, not them.<br>Send one of your own instead:</p>
            <!-- a table around the button so Outlook gives it real edges -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr>
              <td align="center" style="background:${RED};border-radius:10px 13px 9px 12px">
                <a href="${pageUrl}" class="cta" style="display:inline-block;color:#ffffff;font-family:${SANS};font-size:18px;font-weight:700;text-decoration:none;padding:15px 34px">Send one back</a>
              </td>
            </tr></table>
            <p style="margin:12px 0 0;font-family:${SANS};font-size:12px;color:${FAINT}">Free. Anonymous. No sign-up. Ten seconds.</p>
          </td></tr>
        </table>`}

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px">
          <tr><td align="center" style="padding:18px 0 0;border-top:2px dotted ${FAINT}">
            <p style="margin:0 0 10px;font-family:${SANS};font-size:14px;line-height:1.5;color:${SOFT}">Someone put you on the doll. Want everyone to know?</p>
            <p style="margin:0;font-family:${SANS};font-size:14px"><a href="${xShare}" style="color:${RED};font-weight:700;text-decoration:none">Post on X</a> &nbsp;&middot;&nbsp; <a href="${waShare}" style="color:${RED};font-weight:700;text-decoration:none">WhatsApp</a> &nbsp;&middot;&nbsp; <a href="${pageUrl}" style="color:${RED};font-weight:700;text-decoration:none">Open &amp; share the clip</a></p>
          </td></tr>
        </table>

        <p style="margin:28px 0 6px;font-family:${SANS};font-size:12px;line-height:1.5;color:${FAINT};border-top:1px solid ${FAINT};padding-top:16px">You're getting this because someone entered your address on beatass.com. We never share who sent it, and we never will.</p>
        <p style="margin:0;font-family:${SANS};font-size:12px;color:${FAINT}"><a href="${reportUrl}" style="color:${SOFT}">Report this</a> &nbsp;&middot;&nbsp; <a href="${blockUrl}" style="color:${SOFT}">Block my address forever</a></p>

        </td></tr></table>
      </td>
    </tr></table>
  </td></tr>
</table>

</td></tr></table>
</body></html>`;
}

/* The "view your message" page. When a confession is delivered by Instagram
   DM or comment (not email), that message links here with a tokened URL. Shows
   the same confession an email would: the words, the doll recording, and every
   safety control - report, block, and a reply box when the sender left a way to
   hear back. The sender's address never appears. noindex: never search-visible. */
function viewPage({ name, body, gifUrl, mp4Url, pageUrl, blockUrl, reportUrl, replyUrl }) {
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  // What the recipient can broadcast. The clip (video if we have it, else the
  // GIF) is the shareable artifact; the sender is never named in any of it.
  const clip = mp4Url || gifUrl;
  const share = JSON.stringify({
    text: "someone said the thing they'd never say about me \u{1F440} beatass.com",
    url: 'https://beatass.com',
    clip,
    page: pageUrl || 'https://beatass.com'
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light only">
<title>a message for you - beatass</title></head>
<body style="margin:0;padding:0;background:#e8e0cc;font-family:${SANS}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8e0cc;padding:26px 12px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#fbf7ea;border:2px solid #26356e;border-radius:14px 10px 16px 9px">
<tr><td style="padding:26px 28px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#93a0c2">delivered anonymously via beatass.com</p>
<h1 style="margin:0 0 16px;font-size:26px;color:#26356e">${esc(name)}, someone said it.</h1>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffdf5;border:3px solid #26356e;border-radius:14px 10px 16px 9px">
<tr><td width="11" style="width:11px;background:#cf3a2d;border-radius:11px 0 0 7px">&nbsp;</td>
<td style="padding:22px 20px;font-size:19px;line-height:1.6;font-weight:700;color:#26356e;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere">${esc(body)}</td></tr>
</table>
${gifUrl ? `<div style="margin:18px 0 0;text-align:center"><img src="${gifUrl}" alt="what they did to the doll" style="max-width:280px;width:100%;border:3px solid #26356e;border-radius:14px 10px 16px 9px"></div>` : ''}
<div style="margin:26px 0 0;text-align:center">
<p style="margin:0 0 12px;font-size:15px;color:#5b6a9c">someone put you on the doll. put it on blast so everyone knows.</p>
<button type="button" data-share style="display:inline-block;background:#cf3a2d;color:#fff;font-size:17px;font-weight:700;border:0;padding:13px 30px;border-radius:225px 18px 235px 16px/16px 245px 14px 230px;cursor:pointer">Share this</button>
<div style="margin:14px 0 0;font-size:14px;color:#5b6a9c">${clip ? `<a href="${clip}" download style="color:#5b6a9c;margin:0 8px">Save the clip</a>` : ''}<a href="#" data-copy style="color:#5b6a9c;margin:0 8px">Copy link</a></div>
<div data-fallback hidden style="margin:12px 0 0;font-size:14px;color:#93a0c2"><a data-x target="_blank" rel="noopener" style="color:#5b6a9c;margin:0 8px">Post on X</a><a data-wa target="_blank" rel="noopener" style="color:#5b6a9c;margin:0 8px">WhatsApp</a></div>
</div>
${replyUrl ? `<div style="margin:24px 0 0;text-align:center">
<p style="margin:0 0 12px;font-size:15px;color:#5b6a9c">they left a way to hear back. they stay anonymous either way.</p>
<a href="${replyUrl}" style="display:inline-block;background:#cf3a2d;color:#fff;font-size:17px;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:225px 18px 235px 16px/16px 245px 14px 230px">Reply to them</a>
</div>` : ''}
<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #cddaea;font-size:12px;line-height:1.6;color:#93a0c2">This is an automated message from beatass.com. We never reveal who sent it. <a href="${reportUrl}" style="color:#5b6a9c">Report this</a> &nbsp;&middot;&nbsp; <a href="${blockUrl}" style="color:#5b6a9c">Block my address forever</a></p>
</td></tr></table>
</td></tr></table>
<script>
(function(){
  var S = ${share};
  var btn = document.querySelector('[data-share]');
  var copy = document.querySelector('[data-copy]');
  var fb = document.querySelector('[data-fallback]');
  var x = document.querySelector('[data-x]');
  var wa = document.querySelector('[data-wa]');
  if (x) x.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(S.text) + '&url=' + encodeURIComponent(S.url);
  if (wa) wa.href = 'https://wa.me/?text=' + encodeURIComponent(S.text + ' ' + S.url);
  async function go(){
    try {
      if (S.clip && navigator.canShare) {
        var r = await fetch(S.clip); var b = await r.blob();
        var f = new File([b], S.clip.indexOf('.mp4') > -1 ? 'beatass.mp4' : 'beatass.gif', { type: b.type });
        if (navigator.canShare({ files: [f] })) { await navigator.share({ text: S.text, files: [f] }); return true; }
      }
      if (navigator.share) { await navigator.share({ title: 'beatass', text: S.text, url: S.url }); return true; }
    } catch (e) { if (e && e.name === 'AbortError') return true; }
    return false;
  }
  if (btn) btn.addEventListener('click', async function(){ if (!(await go()) && fb) fb.hidden = false; });
  if (copy) copy.addEventListener('click', function(e){
    e.preventDefault();
    if (navigator.clipboard) navigator.clipboard.writeText(S.page).then(function(){ copy.textContent = 'link copied'; }, function(){ if (fb) fb.hidden = false; });
    else if (fb) fb.hidden = false;
  });
})();
</script>
</body></html>`;
}

/* The relay email: somebody's actual words coming back. Same paper as the
   confession but quieter chrome - this one is a private letter, not an event. */
function relayHtml({ intro, body, footer, pageUrl }) {
  const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const note = footer || 'Reply to this email to answer. beatass.com is the go-between; the anonymous side stays anonymous.';
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>beatass</title></head>
<body style="margin:0;padding:0;background:#e8e0cc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e8e0cc;padding:22px 10px">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#fbf7ea;border:2px solid #26356e;border-radius:14px 10px 16px 9px">
<tr><td style="padding:24px 26px">
<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:1.6;color:#5b6a9c">${esc(intro)}</p>
${body ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffdf5;border:3px solid #26356e;border-radius:14px 10px 16px 9px">
<tr><td width="11" style="width:11px;background:#cf3a2d;border-radius:11px 0 0 7px">&nbsp;</td>
<td style="padding:24px 22px;font-family:${SANS};font-size:19px;line-height:1.6;font-weight:700;color:#26356e;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere">${esc(body)}</td></tr>
</table>` : ''}
<p style="margin:20px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:#93a0c2">${esc(note)} <a href="${pageUrl}" style="color:#5b6a9c">beatass.com</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/* A tiny styled page for the block/report confirmations, so the one moment
   somebody is annoyed with us doesn't also look broken. */
const notice = (title, line) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — beatass</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#fbf7ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#26356e;padding:24px">
<div style="max-width:420px;text-align:center">
<h1 style="font-size:26px;margin:0 0 10px">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5;color:#5b6a9c;margin:0">${esc(line)}</p>
</div>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  );

/* The same page, but with a button that does the thing. The button is the
   whole point: a link scanner follows links, it does not submit forms. */
const confirm = (title, line, label, action) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} — beatass</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#fbf7ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#26356e;padding:24px">
<div style="max-width:420px;text-align:center">
<h1 style="font-size:26px;margin:0 0 10px">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5;color:#5b6a9c;margin:0 0 22px">${line}</p>
<form method="POST" action="${esc(action)}">
<button type="submit" style="font:inherit;font-size:16px;padding:13px 26px;color:#fff;background:#cf3a2d;border:0;border-radius:225px 18px 235px 16px/16px 245px 14px 230px;cursor:pointer">${esc(label)}</button>
</form>
</div>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } }
  );

/* The reply box. Same one-job page as confirm(): a mail scanner following the
   GET sees a form; only a human presses send. */
const replyForm = (action) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Answer them - beatass</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#fbf7ea;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#26356e;padding:24px">
<div style="max-width:460px;width:100%">
<h1 style="font-size:24px;margin:0 0 8px">Answer them</h1>
<p style="font-size:15px;line-height:1.5;color:#5b6a9c;margin:0 0 18px">This goes straight back to whoever sent you that message. They stay anonymous; nothing about you is added either.</p>
<form method="POST" action="${esc(action)}">
<textarea name="reply" required maxlength="${MAX_REPLY}" rows="6" placeholder="Say it." style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;line-height:1.5;color:#26356e;background:#fffdf5;border:3px solid #26356e;border-radius:14px 10px 16px 9px;padding:14px"></textarea>
<button type="submit" style="margin-top:14px;font:inherit;font-size:16px;font-weight:700;padding:13px 26px;color:#fff;background:#cf3a2d;border:0;border-radius:225px 18px 235px 16px/16px 245px 14px 230px;cursor:pointer">Send the reply</button>
</form>
</div>`,
  { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } }
);

/* One place sends every email we send. A key gets here by being copied, and a
   copied secret picks up whitespace - a trailing newline, or a line break in
   the middle if the box it was copied from wrapped. Any of those is illegal in
   a header value and the request throws before it is ever sent, which reads as
   a total outage rather than a bad key. A Resend key is "re_" plus letters,
   digits and underscores and never contains whitespace, so removing all of it
   can only ever repair the paste. */
async function sendViaResend(env, payload) {
  const key = String(env.RESEND_API_KEY || '').replace(/\s+/g, '');
  if (!/^re_[A-Za-z0-9_]+$/.test(key)) {
    // shape only - length and prefix say what is wrong without leaking it
    console.error('resend: key does not look like a Resend key', 'len=' + key.length,
                  'starts=' + key.slice(0, 3));
    return { ok: false, ref: 'key_shape' };
  }
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error('resend threw', err && err.stack || String(err));
    return { ok: false, ref: 'resend_threw' };
  }
  if (!res.ok) {
    const detail = await res.text();
    console.error('resend failed', res.status, detail);
    // the status is safe to surface; the body is not, it can echo the key
    return { ok: false, ref: 'resend_' + res.status };
  }
  return { ok: true };
}

/* Exported so tools/email-preview.mjs can render the real thing to a file. The
   whole point is that what you look at is the same function the Worker sends,
   not a copy that drifts. Unused by the Worker itself. */
export { emailHtml };

/* ---------- admin dashboard ----------
   Password-gated, never indexed, fail-closed. One page that shows the product
   end to end - messages, channels, media, reports, and site visits - so the
   operator never has to open the database by hand. It reads D1 directly and
   writes nothing except the anonymous visit counter. Privacy is the whole
   promise of this product, so this door stays shut unless a secret opens it. */

function cookieVal(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

/* The cookie is <exp>.<sig>; sig is signed over the one admin email + its
   expiry with the same secret the block links use, so a cookie cannot be
   forged and lapses on its own after seven days. */
const adminSig = (env, exp) =>
  token(env.BLOCK_SECRET, 'admin:' + String(env.ADMIN_EMAIL).trim().toLowerCase() + ':' + exp);

/* Fail-closed: with no password set, nobody is admin - so the code is safe to
   deploy before the secret exists. Sanjay sets ADMIN_EMAIL + ADMIN_PASSWORD
   with `wrangler secret put` to open the door. */
async function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_EMAIL) return false;
  const raw = cookieVal(request, 'ba_admin');
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return false;
  const exp = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^\d+$/.test(exp) || parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
  return sameToken(sig, await adminSig(env, exp));
}

/* A page view, counted without a cookie or a raw IP - only day + path +
   country. The table is created on first use because local wrangler cannot
   reach remote D1 to migrate it. Always runs under waitUntil, so a visitor
   never waits on it. */
async function logVisit(env, path, country) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS visits (day TEXT, path TEXT, country TEXT, n INTEGER, PRIMARY KEY (day, path, country))'
    ).run();
    await env.DB.prepare(
      'INSERT INTO visits (day, path, country, n) VALUES (?, ?, ?, 1) ' +
      'ON CONFLICT(day, path, country) DO UPDATE SET n = n + 1'
    ).bind(day, path, country).run();
  } catch (err) {
    console.error('visit log', err && err.stack || String(err));
  }
}

/* Everything the dashboard shows, in one gather. created_at is unix SECONDS
   (not an ISO string), so every window compares against strftime('%s', ...)
   cast to an integer - a text/date compare here would silently return nothing
   and every number would read as zero. */
/* Turns the search box + filter dropdowns into a safe parametrised WHERE. The
   search term is bound (never concatenated) and its LIKE wildcards are escaped,
   so a confession containing % or _ can't break the query. */
function adminWhere(query) {
  const where = [];
  const params = [];
  if (query.q) {
    const like = '%' + query.q.replace(/[%_\\]/g, '\\$&') + '%';
    where.push("(to_name LIKE ? ESCAPE '\\' OR to_email LIKE ? ESCAPE '\\' OR to_handle LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR sender_email LIKE ? ESCAPE '\\')");
    params.push(like, like, like, like, like);
  }
  if (query.channel === 'email') where.push("to_email <> ''");
  else if (query.channel === 'ig') where.push("(to_handle IS NOT NULL AND to_handle <> '')");
  else if (query.channel === 'both') where.push("(to_email <> '' AND to_handle IS NOT NULL AND to_handle <> '')");
  if (query.media === 'gif') where.push('has_gif = 1');
  else if (query.media === 'mp4') where.push('has_mp4 = 1');
  if (query.reported) where.push('reports > 0');
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

async function adminData(env, query) {
  query = query || {};
  // the visits table may not exist yet (no visit logged since deploy)
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS visits (day TEXT, path TEXT, country TEXT, n INTEGER, PRIMARY KEY (day, path, country))'
  ).run();

  const stats = await env.DB.prepare(
    `SELECT COUNT(*) total,
       SUM(CASE WHEN created_at >= CAST(strftime('%s','now','-1 day')  AS INTEGER) THEN 1 ELSE 0 END) d1,
       SUM(CASE WHEN created_at >= CAST(strftime('%s','now','-7 days')  AS INTEGER) THEN 1 ELSE 0 END) d7,
       SUM(CASE WHEN created_at >= CAST(strftime('%s','now','-30 days') AS INTEGER) THEN 1 ELSE 0 END) d30,
       COALESCE(SUM(has_gif),0) gifs,
       COALESCE(SUM(has_mp4),0) mp4s,
       COALESCE(SUM(reports),0) reports_total,
       SUM(CASE WHEN reports > 0 THEN 1 ELSE 0 END) reported_rows,
       SUM(CASE WHEN to_email <> '' THEN 1 ELSE 0 END) with_email,
       SUM(CASE WHEN to_handle IS NOT NULL AND to_handle <> '' THEN 1 ELSE 0 END) with_handle,
       SUM(CASE WHEN sender_email IS NOT NULL AND sender_email <> '' THEN 1 ELSE 0 END) with_reply
     FROM messages`
  ).first();

  const chart = await env.DB.prepare(
    `SELECT date(created_at,'unixepoch') d, COUNT(*) n FROM messages
     WHERE created_at >= CAST(strftime('%s','now','-13 days') AS INTEGER)
     GROUP BY d`
  ).all();

  const blocks = await env.DB.prepare('SELECT COUNT(*) c FROM blocklist').first();

  // the searchable, filterable, paged log. Stats above stay global; only this
  // table narrows to the query, so thousands of rows never load at once.
  const PAGE = 50;
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const { clause, params } = adminWhere(query);
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) c FROM messages ${clause}`).bind(...params).first();
  const total = (totalRow && totalRow.c) || 0;
  const rows = await env.DB.prepare(
    `SELECT id, to_name, to_email, to_handle, body, has_gif, has_mp4, reports, sender_email, sender_hash, created_at
     FROM messages ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    // ponytail: OFFSET paging is fine into the tens of thousands here; switch to
    // keyset (WHERE created_at < last) only if an admin ever pages that deep.
  ).bind(...params, PAGE, (page - 1) * PAGE).all();

  const vToday = await env.DB.prepare("SELECT COALESCE(SUM(n),0) n FROM visits WHERE day = date('now')").first();
  const vWeek  = await env.DB.prepare("SELECT COALESCE(SUM(n),0) n FROM visits WHERE day >= date('now','-6 days')").first();
  const vPaths = await env.DB.prepare("SELECT path, SUM(n) n FROM visits WHERE day >= date('now','-6 days') GROUP BY path ORDER BY n DESC LIMIT 5").all();
  const vCountries = await env.DB.prepare("SELECT country, SUM(n) n FROM visits WHERE day >= date('now','-6 days') GROUP BY country ORDER BY n DESC LIMIT 8").all();

  return {
    stats: stats || {},
    chart: chart.results || [],
    blocks: (blocks && blocks.c) || 0,
    table: { rows: rows.results || [], total, page, pageSize: PAGE, query },
    visits: {
      today: (vToday && vToday.n) || 0,
      week: (vWeek && vWeek.n) || 0,
      paths: vPaths.results || [],
      countries: vCountries.results || []
    }
  };
}

const ADMIN_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/* The login card. Same paper and ink as the site, so the door looks like it
   belongs to the house. Shown for GET, and re-shown with a message on a bad
   POST. Never indexed, never cached. */
function loginPage(errmsg, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light only">
<title>control room - beatass</title></head>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#e8e0cc;font-family:${ADMIN_SANS};color:#26356e;padding:24px">
<form method="POST" action="/admin/login" style="width:100%;max-width:360px;background:#fbf7ea;border:2px solid #26356e;border-radius:16px 11px 18px 10px;padding:26px 24px">
<h1 style="margin:0 0 4px;font-size:24px">beatass control room</h1>
<p style="margin:0 0 20px;font-size:14px;color:#5b6a9c">Admin only. Sign in to see everything.</p>
${errmsg ? `<p style="margin:0 0 16px;font-size:14px;color:#cf3a2d;font-weight:700">${esc(errmsg)}</p>` : ''}
<label style="display:block;font-size:13px;color:#5b6a9c;margin:0 0 5px">email</label>
<input name="email" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:#26356e;background:#fffdf5;border:2px solid #26356e;border-radius:10px 8px 11px 7px;padding:11px 12px;margin:0 0 14px">
<label style="display:block;font-size:13px;color:#5b6a9c;margin:0 0 5px">password</label>
<input name="password" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:#26356e;background:#fffdf5;border:2px solid #26356e;border-radius:10px 8px 11px 7px;padding:11px 12px;margin:0 0 20px">
<button type="submit" style="width:100%;font:inherit;font-size:16px;font-weight:700;padding:13px;color:#fff;background:#cf3a2d;border:0;border-radius:12px 9px 13px 8px;cursor:pointer">Sign in</button>
</form>
</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } }
  );
}

/* The dashboard itself. All output escaped; body text is shown so the operator
   can moderate, and that is the reason the page is password-gated. */
function adminPage(data) {
  const PAPER = '#fbf7ea', PAPER2 = '#fffdf5', INK = '#26356e',
        RED = '#cf3a2d', SOFT = '#5b6a9c', FAINT = '#93a0c2';
  const n = (x) => Number(x || 0).toLocaleString('en-US');
  const s = data.stats || {};

  // 14 calendar days, oldest -> newest, with gaps filled to zero
  const byDay = {};
  for (const r of data.chart) byDay[r.d] = r.n;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({ key, label: key.slice(5), num: byDay[key] || 0 });
  }
  const peak = Math.max(1, ...days.map((d) => d.num));
  const bars = days.map((d) =>
    `<div style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;text-align:center">
      <div style="font-size:11px;font-weight:700;color:${d.num ? INK : FAINT};margin:0 0 3px">${d.num}</div>
      <div title="${esc(d.key)}: ${d.num}" style="width:66%;height:${Math.round(d.num / peak * 100)}%;min-height:3px;background:${d.num ? RED : '#e3d9bd'};border-radius:6px 5px 3px 5px"></div>
      <div style="font-size:9px;color:${FAINT};margin:5px 0 0">${esc(d.label)}</div>
    </div>`
  ).join('');

  const card = (title, inner) =>
    `<div style="background:${PAPER2};border:2px solid ${INK};border-radius:16px 11px 18px 10px;padding:16px 18px">
      <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${FAINT};margin:0 0 10px">${esc(title)}</div>
      ${inner}</div>`;

  const stat = (label, value, sub) =>
    `<div style="background:${PAPER2};border:2px solid ${INK};border-radius:16px 11px 18px 10px;padding:16px 18px">
      <div style="font-size:34px;font-weight:800;line-height:1;color:${INK}">${value}</div>
      <div style="font-size:13px;color:${SOFT};margin:8px 0 0">${esc(label)}</div>
      ${sub ? `<div style="font-size:12px;color:${FAINT};margin:3px 0 0">${esc(sub)}</div>` : ''}
    </div>`;

  const rows = (list, empty) =>
    (list && list.length)
      ? list.map((r) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:14px;color:${INK}"><span style="color:${SOFT};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.k)}</span><span style="font-weight:700">${n(r.n)}</span></div>`).join('')
      : `<div style="font-size:13px;color:${FAINT}">${esc(empty)}</div>`;

  const t = data.table || { rows: [], total: 0, page: 1, pageSize: 50, query: {} };
  const tq = t.query || {};
  // build an /admin link that keeps the current search + filters, overriding
  // only what's passed (used by prev/next). '&' is escaped for a valid href.
  const qlink = (over) => {
    const p = new URLSearchParams();
    const m = Object.assign({ q: tq.q, channel: tq.channel, media: tq.media, reported: tq.reported, page: String(t.page) }, over);
    for (const k of ['q', 'channel', 'media', 'reported', 'page']) if (m[k]) p.set(k, m[k]);
    const str = p.toString();
    return '/admin' + (str ? '?' + esc(str) : '');
  };
  const sel = (name, val) => (tq[name] === val ? ' selected' : '');
  const totalPages = Math.max(1, Math.ceil((t.total || 0) / (t.pageSize || 50)));
  const offset = (t.page - 1) * t.pageSize;
  const showFrom = t.total ? offset + 1 : 0;
  const showTo = Math.min(offset + t.pageSize, t.total);
  const hasFilters = tq.q || tq.channel || tq.media || tq.reported;
  const inputCss = `font:inherit;font-size:14px;color:${INK};background:${PAPER2};border:2px solid ${INK};border-radius:9px 7px 10px 6px;padding:9px 10px`;

  const recentRows = (t.rows || []).map((r) => {
    const when = new Date(r.created_at * 1000).toISOString().slice(0, 16).replace('T', ' ');
    const chan = (r.to_email && r.to_handle) ? 'email + ig'
      : r.to_email ? 'email'
      : r.to_handle ? '@' + r.to_handle : '-';
    const dest = r.to_email ? r.to_email : (r.to_handle ? '@' + r.to_handle : '');
    const media = [r.has_gif ? 'GIF' : '', r.has_mp4 ? 'MP4' : ''].filter(Boolean).join(' ') || '-';
    const sender = r.sender_email ? esc(r.sender_email) : 'anonymous';
    const fp = r.sender_hash ? esc(String(r.sender_hash).slice(0, 8)) : '';
    return `<tr style="border-top:1px solid #e3d9bd">
      <td style="padding:8px 8px;color:${FAINT};white-space:nowrap;font-size:12px">${esc(when)}</td>
      <td style="padding:8px 8px;color:${INK}">${sender}${fp ? `<div style="font-size:11px;color:${FAINT}" title="same sender fingerprint">${fp}</div>` : ''}</td>
      <td style="padding:8px 8px;color:${INK}">${esc(r.to_name)}<div style="font-size:11px;color:${FAINT}">${esc(dest)}</div></td>
      <td style="padding:8px 8px;color:${SOFT};white-space:nowrap">${esc(chan)}</td>
      <td style="padding:8px 8px;color:${SOFT};white-space:nowrap">${esc(media)}</td>
      <td style="padding:8px 8px;text-align:center;font-weight:700;color:${r.reports ? RED : FAINT}">${n(r.reports)}</td>
      <td style="padding:8px 8px;color:${INK};max-width:340px">${esc(r.body)}</td>
    </tr>`;
  }).join('');

  const filterBar = `<form method="GET" action="/admin" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px">
    <input name="q" value="${esc(tq.q || '')}" placeholder="search from, to, handle, message..." style="${inputCss};flex:1;min-width:190px">
    <select name="channel" style="${inputCss}">
      <option value=""${sel('channel', '')}>any channel</option>
      <option value="email"${sel('channel', 'email')}>email</option>
      <option value="ig"${sel('channel', 'ig')}>instagram</option>
      <option value="both"${sel('channel', 'both')}>email + ig</option>
    </select>
    <select name="media" style="${inputCss}">
      <option value=""${sel('media', '')}>any media</option>
      <option value="gif"${sel('media', 'gif')}>has GIF</option>
      <option value="mp4"${sel('media', 'mp4')}>has MP4</option>
    </select>
    <label style="display:flex;align-items:center;gap:6px;font-size:14px;color:${SOFT};white-space:nowrap"><input type="checkbox" name="reported" value="1"${tq.reported ? ' checked' : ''}>reported only</label>
    <button type="submit" style="font:inherit;font-size:14px;font-weight:700;color:#fff;background:${INK};border:0;border-radius:10px 8px 11px 7px;padding:10px 18px;cursor:pointer">Search</button>
    ${hasFilters ? `<a href="/admin" style="font-size:14px;color:${RED};font-weight:700">clear</a>` : ''}
  </form>`;

  const pager = `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin:14px 2px 0;font-size:13px;color:${SOFT}">
    <span>${t.total ? `Showing ${n(showFrom)}-${n(showTo)} of ${n(t.total)}` : 'No matches'}</span>
    <span style="display:flex;gap:14px;align-items:center">
      ${t.page > 1 ? `<a href="${qlink({ page: String(t.page - 1) })}" style="color:${INK};font-weight:700">&larr; prev</a>` : `<span style="color:${FAINT}">&larr; prev</span>`}
      <span>page ${n(t.page)} / ${n(totalPages)}</span>
      ${t.page < totalPages ? `<a href="${qlink({ page: String(t.page + 1) })}" style="color:${INK};font-weight:700">next &rarr;</a>` : `<span style="color:${FAINT}">next &rarr;</span>`}
    </span>
  </div>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta name="color-scheme" content="light only">
<title>control room - beatass</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:${PAPER};font-family:${ADMIN_SANS};color:${INK}}
  .wrap{max-width:1040px;margin:0 auto;padding:26px 18px 60px}
  .grid{display:grid;gap:14px}
  .g4{grid-template-columns:repeat(4,1fr)}
  .g3{grid-template-columns:repeat(3,1fr)}
  .g2{grid-template-columns:repeat(2,1fr)}
  @media (max-width:820px){.g4{grid-template-columns:repeat(2,1fr)}.g3,.g2{grid-template-columns:1fr}}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;padding:8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${FAINT};font-weight:700}
</style></head>
<body>
<div class="wrap">
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin:0 0 6px">
    <h1 style="margin:0;font-size:28px">beatass control room</h1>
    <a href="/admin/logout" style="font-size:14px;color:${SOFT}">Sign out</a>
  </div>
  <p style="margin:0 0 22px;font-size:14px;color:${FAINT}">Everything the site knows, in one place. Only you can see this.</p>

  <div class="grid g4" style="margin:0 0 14px">
    ${stat('confessions, all time', n(s.total))}
    ${stat('last 24 hours', n(s.d1))}
    ${stat('last 7 days', n(s.d7))}
    ${stat('last 30 days', n(s.d30))}
  </div>

  ${card('confessions per day (last 14 days)',
    `<div style="display:flex;align-items:flex-end;gap:5px;height:170px">${bars}</div>`)}

  <div class="grid g3" style="margin:14px 0">
    ${card('how they were reached',
      `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">by email</span><span style="font-weight:700">${n(s.with_email)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">by instagram handle</span><span style="font-weight:700">${n(s.with_handle)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">left a reply address</span><span style="font-weight:700">${n(s.with_reply)}</span></div>`)}
    ${card('clips made',
      `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">GIFs</span><span style="font-weight:700">${n(s.gifs)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">MP4s</span><span style="font-weight:700">${n(s.mp4s)}</span></div>`)}
    ${card('safety',
      `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">messages reported</span><span style="font-weight:700;color:${s.reported_rows ? RED : INK}">${n(s.reported_rows)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">reports total</span><span style="font-weight:700">${n(s.reports_total)}</span></div>
       <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:15px"><span style="color:${SOFT}">addresses blocked</span><span style="font-weight:700">${n(data.blocks)}</span></div>`)}
  </div>

  <div class="grid g3" style="margin:14px 0">
    ${stat('site visits today', n(data.visits.today), 'homepage + message views')}
    ${stat('visits, last 7 days', n(data.visits.week), 'server-logged, no cookies')}
    ${card('top countries (7d)', rows((data.visits.countries || []).map((r) => ({ k: r.country || '??', n: r.n })), 'no visits logged yet'))}
  </div>

  ${card('all confessions',
    filterBar +
    `<div style="overflow-x:auto"><table>
      <thead><tr><th>when (UTC)</th><th>from</th><th>to</th><th>channel</th><th>media</th><th>reports</th><th>message</th></tr></thead>
      <tbody>${recentRows || `<tr><td colspan="7" style="padding:14px 8px;color:${FAINT}">${hasFilters ? 'No confessions match those filters.' : 'Nothing sent yet.'}</td></tr>`}</tbody>
    </table></div>` +
    pager)}

  <p style="margin:22px 0 0;font-size:12px;color:${FAINT}">Email opens and delivery, and live Instagram numbers, are not here yet - they live outside this database. Coming in a later pass; nothing above is estimated.</p>
</div>
</body></html>`;
}

export default {
  async fetch(request, env, ctx) {
    /* Anything that escapes below used to reach the visitor as Cloudflare's bare
       "error code: 1101" with nothing in the response and nothing readable in
       the logs. One catch turns every such case into a real answer. */
    try {
      return await handle(request, env, ctx);
    } catch (err) {
      console.error('unhandled', err && err.stack || String(err));
      return json({ error: 'Something broke on our side.', ref: 'unhandled' }, 500);
    }
  }
  ,

  /* Inbound mail. Email Routing hands us everything addressed to reply+<id>@
     (subaddressing matches it against the reply@ rule). We are the post
     office: look up the message, forward the words to the OTHER party, never
     let either address show to the other side. */
  async email(message, env) {
    try {
      const to = String(message.to || '').toLowerCase();
      const m = to.match(/^reply\+([a-f0-9]{16})@/);
      if (!m) { message.setReject('No such address'); return; }
      const mid = m[1];

      /* machine-generated mail (out-of-office, bounces) must never start a loop */
      const auto = String(message.headers.get('auto-submitted') || '').toLowerCase();
      if (auto && auto !== 'no') return;

      const row = await env.DB.prepare('SELECT sender_email, to_email FROM messages WHERE id = ?')
        .bind(mid).first();
      if (!row) { message.setReject('No such message'); return; }

      const from = String(message.from || '').toLowerCase();
      const pageUrl = env.SITE_URL || 'https://beatass.com';

      if (!row.sender_email) {
        /* The sender left no address. Answer the anonymity notice exactly once
           per message, so a frustrated double-reply doesn't get spammed back. */
        if (await env.RATE.get('an:' + mid)) return;
        await env.RATE.put('an:' + mid, '1', { expirationTtl: 60 * 60 * 24 * 30 });
        await sendViaResend(env, {
          from: env.MAIL_FROM,
          to: [from],
          subject: 'That sender chose to stay anonymous',
          html: relayHtml({
            intro: 'You replied to a beatass.com message, but whoever sent it left no way to be reached - not even by us. Your reply could not be delivered. That is a privacy promise, not a bug.',
            footer: 'Want to say something back anyway? Send one of your own from',
            pageUrl
          }),
          text: 'You replied to a beatass.com message, but whoever sent it left no way to be reached - not even by us. Your reply could not be delivered. That is a privacy promise, not a bug.\n\nWant to say something back anyway? Send one of your own: ' + pageUrl
        });
        return;
      }

      /* only the two people in this exchange may use the relay */
      if (from !== row.sender_email && from !== row.to_email) {
        message.setReject('Not part of this conversation');
        return;
      }
      const target = from === row.sender_email ? row.to_email : row.sender_email;

      /* A handle-only recipient has no inbox. If the sender writes back, there
         is nowhere to relay by email - they are reached on Instagram, not here.
         Say so once per message instead of silently dropping or crashing. */
      if (!target) {
        if (await env.RATE.get('nt:' + mid)) return;
        await env.RATE.put('nt:' + mid, '1', { expirationTtl: 60 * 60 * 24 * 30 });
        await sendViaResend(env, {
          from: env.MAIL_FROM,
          to: [from],
          subject: "We couldn't relay that",
          html: relayHtml({
            intro: 'The person you wrote to left an Instagram handle, not an email, so we have no inbox to deliver your reply to. They only see messages sent to them on Instagram.',
            footer: 'Want to send another? Start one from',
            pageUrl
          }),
          text: 'The person you wrote to left an Instagram handle, not an email, so we have no inbox to deliver your reply to. They only see messages on Instagram.\n\nStart another: ' + pageUrl
        });
        return;
      }

      // the block list is absolute, in every direction
      const blocked = await env.DB.prepare('SELECT 1 FROM blocklist WHERE email = ?')
        .bind(target).first();
      if (blocked) return;

      /* 20 relayed replies per writer per day. Past the ceiling: one honest
         notice, then silence until tomorrow - a quiet drop would read as the
         relay being broken, and a notice per drop would itself be a firehose.
         The key is a hash, so no raw address ever sits in KV. */
      const fromHash = (await hmac(env.BLOCK_SECRET, 'rd:' + from)).slice(0, 24);
      const usedToday = parseInt((await env.RATE.get('rd:' + fromHash)) || '0', 10);
      if (usedToday >= RELAY_LIMIT) {
        if (!(await env.RATE.get('rdn:' + fromHash))) {
          await env.RATE.put('rdn:' + fromHash, '1', { expirationTtl: RELAY_WINDOW });
          await sendViaResend(env, {
            from: env.MAIL_FROM,
            to: [from],
            subject: "That's enough for today",
            html: relayHtml({
              intro: 'You have hit the daily limit of ' + RELAY_LIMIT + ' relayed replies. Anything more you send today will not be delivered. The conversation reopens tomorrow.',
              footer: 'The limit keeps the relay from becoming a firehose. Tomorrow it resets, promise.',
              pageUrl
            }),
            text: 'You have hit the daily limit of ' + RELAY_LIMIT + ' relayed replies. Anything more you send today will not be delivered. The conversation reopens tomorrow.'
          });
        }
        return;
      }
      await env.RATE.put('rd:' + fromHash, String(usedToday + 1), { expirationTtl: RELAY_WINDOW });

      const parsed = await PostalMime.parse(message.raw);
      let text = (parsed.text || '').trim();
      if (!text && parsed.html)
        text = String(parsed.html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      text = text.slice(0, 5000);
      if (!text) return;

      await sendViaResend(env, {
        from: env.MAIL_FROM,
        reply_to: replyAddr(env, mid),
        to: [target],
        subject: 'They answered your beatass message',
        html: relayHtml({ intro: 'They read what you sent. This is what they said back:', body: text, pageUrl }),
        text: text + '\n\n-\nReply to this email to answer. beatass.com is the go-between; the anonymous side stays anonymous.'
      });
    } catch (err) {
      /* a throw here would bounce the mail with our stack trace in it */
      console.error('email handler', err && err.stack || String(err));
    }
  }
};

async function handle(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const site = env.SITE_URL || url.origin;

    /* Count real page views the Worker actually sees - the homepage and the
       message page. Static pages (about/privacy/terms) are served by Cloudflare
       before this Worker runs, so they never reach here; the dashboard says so
       rather than pretending to count them. No cookie, no raw IP, off the
       response path. */
    if ((path === '/' || path === '/m') && ctx && ctx.waitUntil)
      ctx.waitUntil(logVisit(env, path, request.cf?.country || '??'));

    /* ---------- admin dashboard (password-gated, never indexed) ----------
       Fail-closed: with no ADMIN_PASSWORD/ADMIN_EMAIL secret set, the login
       always rejects and /admin always bounces to it - so this is safe to ship
       before the secrets exist. */
    if (path === '/admin/login') {
      if (request.method === 'POST') {
        // brute-force guard: a public login gets a per-IP attempt ceiling
        const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
        const ipHash = await hashIp(env.BLOCK_SECRET, ip);
        const lk = 'al:' + ipHash;
        const tries = parseInt((await env.RATE.get(lk)) || '0', 10);
        if (tries >= 10) return loginPage('Too many attempts. Wait a few minutes.', 429);
        await env.RATE.put(lk, String(tries + 1), { expirationTtl: 15 * 60 });

        if (!env.ADMIN_PASSWORD || !env.ADMIN_EMAIL)
          return loginPage('Admin access is not set up yet.', 503);

        let form;
        try { form = await request.formData(); } catch { return loginPage('Something went wrong. Try again.', 400); }
        const email = String(form.get('email') || '').trim().toLowerCase();
        const pw = String(form.get('password') || '');
        // compare via HMAC so both sides are always equal-length and the
        // constant-time check can't leak the password's length through timing
        const emailOk = sameToken(
          await hmac(env.BLOCK_SECRET, 'ae:' + email),
          await hmac(env.BLOCK_SECRET, 'ae:' + String(env.ADMIN_EMAIL).trim().toLowerCase()));
        const pwOk = sameToken(
          await hmac(env.BLOCK_SECRET, 'ap:' + pw),
          await hmac(env.BLOCK_SECRET, 'ap:' + String(env.ADMIN_PASSWORD)));
        if (!emailOk || !pwOk) return loginPage('That email or password is wrong.', 401);

        const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
        const val = exp + '.' + await adminSig(env, exp);
        return new Response(null, { status: 302, headers: {
          location: '/admin',
          'set-cookie': `ba_admin=${val}; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=${7 * 24 * 60 * 60}`,
          'x-robots-tag': 'noindex'
        } });
      }
      return loginPage();
    }

    if (path === '/admin/logout')
      return new Response(null, { status: 302, headers: {
        location: '/admin/login',
        'set-cookie': 'ba_admin=; HttpOnly; Secure; SameSite=Lax; Path=/admin; Max-Age=0',
        'x-robots-tag': 'noindex'
      } });

    if (path === '/admin') {
      if (!(await requireAdmin(request, env)))
        return new Response(null, { status: 302, headers: { location: '/admin/login', 'x-robots-tag': 'noindex' } });
      const sp = url.searchParams;
      const query = {
        q: (sp.get('q') || '').trim().slice(0, 100),
        channel: sp.get('channel') || '',
        media: sp.get('media') || '',
        reported: sp.get('reported') ? '1' : '',
        page: sp.get('page') || '1'
      };
      const data = await adminData(env, query);
      return new Response(adminPage(data), { headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex',
        'cache-control': 'no-store'
      } });
    }

    /* ---------- media out of R2 ---------- */
    if (path.startsWith('/media/')) {
      const key = path.slice('/media/'.length);
      if (!/^[a-f0-9]{16}\.(gif|mp4)$/.test(key)) return new Response('Not found', { status: 404 });
      const obj = await env.MEDIA.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      return new Response(obj.body, {
        headers: {
          'content-type': key.endsWith('.gif') ? 'image/gif' : 'video/mp4',
          // these never change once written, so let everything cache them hard
          'cache-control': 'public, max-age=31536000, immutable',
          // somebody's confession must never turn up in an image search. This
          // header, rather than a robots.txt Disallow, because mail clients
          // fetch these through their own proxies and a Disallow risks the
          // image not rendering in the email at all.
          'x-robots-tag': 'noindex, noimageindex',
          'etag': obj.httpEtag
        }
      });
    }

    /* ---------- block: confirm, then permanent ----------
       These used to act on the GET. Corporate mail security (Defender
       SafeLinks, Proofpoint and friends) opens every link in an incoming
       message to check it is safe, BEFORE the human ever sees the email — so a
       GET that blocks would silently and permanently cut off a recipient who
       never clicked, with no unblock route by design. A scanner will not press
       a button, so the click opens a page and the button POSTs. */
    if (path === '/block') {
      const email = (url.searchParams.get('e') || '').toLowerCase().trim();
      const handleParam = (url.searchParams.get('h') || '').toLowerCase().trim().replace(/^@+/, '');
      const t = url.searchParams.get('t') || '';

      /* Block by email OR by Instagram handle. A handle is stored in the same
         blocklist column behind an "ig:" prefix - a real email can never look
         like that (it has no @), so the two namespaces can never collide. The
         token is signed over whatever we store, so a link can only ever block
         its own value. */
      const byHandle = !!handleParam;
      const blockVal = byHandle ? 'ig:' + handleParam : email;
      const shownVal = byHandle ? '@' + handleParam : email;
      const kind = byHandle ? 'account' : 'address';
      const idOk = byHandle ? /^[a-z0-9._]{1,30}$/.test(handleParam) : okEmail(email);
      if (!idOk || !sameToken(t, await token(env.BLOCK_SECRET, blockVal)))
        return notice('That link has expired', 'Reply to the message instead and we will sort it out.');

      if (request.method !== 'POST')
        return confirm(
          `Block this ${kind}?`,
          `Nobody will be able to use beatass.com to send anything to ${esc(shownVal)} again. This cannot be undone.`,
          'Yes, block it forever',
          byHandle
            ? `/block?h=${encodeURIComponent(handleParam)}&t=${encodeURIComponent(t)}`
            : `/block?e=${encodeURIComponent(email)}&t=${encodeURIComponent(t)}`
        );

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare('INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (?, ?)')
        .bind(blockVal, now)
        .run();

      /* "Never again" has to mean every channel, not just the clicked one. A
         recipient reached by email AND Instagram would otherwise block their
         inbox and keep getting DMs. So an email block also silences every
         handle that address's messages carried. (One-directional on purpose:
         a handle block sweeps only itself - senders type both fields, so a
         handle token must not be able to blocklist somebody's email.) */
      if (!byHandle) {
        const carried = await env.DB.prepare(
          'SELECT DISTINCT to_handle FROM messages WHERE to_email = ? AND to_handle IS NOT NULL'
        ).bind(email).all();
        for (const r of (carried.results || []))
          await env.DB.prepare('INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (?, ?)')
            .bind('ig:' + r.to_handle, now)
            .run();
      }
      return notice('Done - you will never hear from us again.',
        `That ${kind} is blocked permanently. Nobody can use beatass.com to contact you.`);
    }

    /* ---------- report ---------- */
    if (path === '/report') {
      const mid = url.searchParams.get('id') || '';
      const t = url.searchParams.get('t') || '';
      if (!/^[a-f0-9]{16}$/.test(mid) || !sameToken(t, await token(env.BLOCK_SECRET, 'r:' + mid)))
        return notice('That link has expired', 'Reply to the email instead and we will sort it out.');

      // same reason as /block: a link scanner must not be able to file a report
      if (request.method !== 'POST')
        return confirm(
          'Report this message?',
          'A person will read it and decide what to do. Reporting does not stop future messages on its own — use the block link for that.',
          'Yes, report it',
          `/report?id=${encodeURIComponent(mid)}&t=${encodeURIComponent(t)}`
        );

      await env.DB.prepare('UPDATE messages SET reports = reports + 1 WHERE id = ?').bind(mid).run();
      return notice('Reported. Thank you.',
        'A human will look at this message. If you also want to stop all future mail, use the block link in the email.');
    }

    /* ---------- reply: the recipient answers, we relay it ----------
       Only reachable through the tokened link in the email, and only useful
       when the sender left an address. The sender's address never appears in
       anything this route returns. */
    if (path === '/reply') {
      const mid = url.searchParams.get('id') || '';
      const t = url.searchParams.get('t') || '';
      if (!/^[a-f0-9]{16}$/.test(mid) || !sameToken(t, await token(env.BLOCK_SECRET, 'reply:' + mid)))
        return notice('That link has expired', 'Open the email again and use its reply button.');

      const row = await env.DB.prepare('SELECT sender_email FROM messages WHERE id = ?').bind(mid).first();
      if (!row)
        return notice('That link has expired', 'Open the email again and use its reply button.');
      if (!row.sender_email)
        return notice('This sender chose to stay anonymous',
          'They left no way to reach them, not even for us. That is a privacy promise, not a bug.');

      // the block list kills the reply path too - a blocked address gets NO mail
      const senderBlocked = await env.DB.prepare('SELECT 1 FROM blocklist WHERE email = ?')
        .bind(row.sender_email).first();
      if (senderBlocked)
        return notice('This address is closed',
          'The person behind that message asked never to receive mail from beatass.com. We are honouring that.');

      if (request.method !== 'POST')
        return replyForm(`/reply?id=${encodeURIComponent(mid)}&t=${encodeURIComponent(t)}`);

      // same ceiling as sending: a reply chain is still two strangers
      const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
      const ipHash = await hashIp(env.BLOCK_SECRET, ip);
      const rk = 'rp:' + ipHash;
      const used = parseInt((await env.RATE.get(rk)) || '0', 10);
      if (used >= RATE_LIMIT)
        return notice("That's enough for one hour", 'Come back later and try again.');
      await env.RATE.put(rk, String(used + 1), { expirationTtl: RATE_WINDOW });

      let form;
      try { form = await request.formData(); } catch { return notice('Something went wrong', 'Go back and try again.'); }
      const reply = String(form.get('reply') || '').trim();
      if (reply.length < 1 || reply.length > MAX_REPLY)
        return notice('Write the reply first', 'Go back, write it, then press send.');

      const sent = await sendViaResend(env, {
        from: env.MAIL_FROM,
        reply_to: replyAddr(env, mid),
        to: [row.sender_email],
        subject: 'They answered your beatass message',
        html: relayHtml({ intro: 'They read what you sent. This is what they said back:', body: reply, pageUrl: site }),
        text: reply + '\n\n-\nReply to this email to answer. beatass.com is the go-between; the anonymous side stays anonymous.'
      });
      if (!sent.ok) return notice("That didn't go through", 'Try again in a minute.');
      return notice('Sent', 'Your reply is on its way to whoever sent that message.');
    }

    /* ---------- view: the confession, for a recipient reached via Instagram ----------
       The DM/comment carries this tokened link. Shows the message + the doll
       recording + block + report + a reply box. The sender's address never
       appears in anything this route returns. */
    if (path === '/m') {
      const mid = url.searchParams.get('id') || '';
      const t = url.searchParams.get('t') || '';
      if (!/^[a-f0-9]{16}$/.test(mid) || !sameToken(t, await token(env.BLOCK_SECRET, 'view:' + mid)))
        return notice('That link has expired', 'Ask whoever sent it to share it again.');
      const row = await env.DB.prepare(
        'SELECT to_email, to_name, body, has_gif, has_mp4, sender_email, to_handle FROM messages WHERE id = ?'
      ).bind(mid).first();
      if (!row) return notice('That link has expired', 'Ask whoever sent it to share it again.');

      const gifUrl = row.has_gif ? `${site}/media/${mid}.gif` : '';
      const mp4Url = row.has_mp4 ? `${site}/media/${mid}.mp4` : '';
      const pageUrl = `${site}/m?id=${mid}&t=${t}`;
      // block by email when we have one, otherwise by the Instagram handle
      const blockUrl = row.to_email
        ? `${site}/block?e=${encodeURIComponent(row.to_email)}&t=${await token(env.BLOCK_SECRET, row.to_email)}`
        : row.to_handle
          ? `${site}/block?h=${encodeURIComponent(row.to_handle)}&t=${await token(env.BLOCK_SECRET, 'ig:' + row.to_handle)}`
          : '';
      const reportUrl = `${site}/report?id=${mid}&t=${await token(env.BLOCK_SECRET, 'r:' + mid)}`;
      const replyUrl = row.sender_email
        ? `${site}/reply?id=${mid}&t=${await token(env.BLOCK_SECRET, 'reply:' + mid)}`
        : '';
      return new Response(
        viewPage({ name: row.to_name, body: row.body, gifUrl, mp4Url, pageUrl, blockUrl, reportUrl, replyUrl }),
        { headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' } }
      );
    }

    /* ---------- send ---------- */
    if (path === '/api/send' && request.method === 'POST') {
      const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

      let form;
      try {
        form = await request.formData();
      } catch {
        return json({ error: 'Malformed request.' }, 400);
      }

      const name = String(form.get('name') || '').trim();
      const email = String(form.get('email') || '').trim().toLowerCase();
      const body = String(form.get('message') || '').trim();
      const stats = String(form.get('stats') || '').trim().slice(0, 80);
      // the finished caption line, decided by the front end (love vs beating)
      const caption = String(form.get('caption') || '').trim().slice(0, 120);
      // Optional: the sender's own address, only if they want to hear back.
      // It is stored and never shown to anyone - not in the email, not in any
      // API response. It is the reply relay's only routing table.
      const senderEmail = String(form.get('senderEmail') || '').trim().toLowerCase();
      // Optional: the recipient's Instagram handle, for delivery by DM/comment
      // when the sender knows the handle. Stored, never shown to anyone.
      const toHandle = String(form.get('handle') || '').trim().replace(/^@+/, '').toLowerCase().slice(0, 30);

      if (!name || name.length > MAX_NAME) return json({ error: 'That name looks wrong.' }, 400);
      if (email && !okEmail(email)) return json({ error: "That's not an email address." }, 400);
      if (body.length < 3 || body.length > MAX_BODY)
        return json({ error: 'Say a little more than that.' }, 400);
      if (senderEmail && !okEmail(senderEmail))
        return json({ error: 'Your own email looks wrong. Fix it or leave it empty.' }, 400);
      if (toHandle && !/^[a-z0-9._]{1,30}$/.test(toHandle))
        return json({ error: 'That Instagram handle looks wrong. Letters, numbers, dots and underscores only.' }, 400);
      // at least one way to reach them - an email (most reliable) or an Instagram handle
      if (!email && !toHandle)
        return json({ error: 'Add their email or their Instagram handle so we can deliver it.' }, 400);

      // never send to somebody who has already told us to stop - by email or handle
      const blockKeys = [];
      if (email) blockKeys.push(email);
      if (toHandle) blockKeys.push('ig:' + toHandle);
      const blocked = await env.DB.prepare(
        `SELECT 1 FROM blocklist WHERE email IN (${blockKeys.map(() => '?').join(',')})`
      ).bind(...blockKeys).first();
      if (blocked)
        return json({ error: 'That person has asked never to receive these. We are honouring that.' }, 403);

      // rate limit, per sender IP
      const ipHash = await hashIp(env.BLOCK_SECRET, ip);
      const rateKey = 'r:' + ipHash;
      const used = parseInt((await env.RATE.get(rateKey)) || '0', 10);
      if (used >= RATE_LIMIT)
        return json({ error: "That's enough for one hour. Come back later." }, 429);
      await env.RATE.put(rateKey, String(used + 1), { expirationTtl: RATE_WINDOW });

      const gif = form.get('gif');
      const mp4 = form.get('mp4');
      if (gif && gif.size > MAX_GIF) return json({ error: 'That GIF is too big.' }, 413);
      if (mp4 && mp4.size > MAX_MP4) return json({ error: 'That video is too big.' }, 413);

      const mid = id16();
      const puts = [];
      if (gif && gif.size)
        puts.push(env.MEDIA.put(mid + '.gif', gif.stream(), {
          httpMetadata: { contentType: 'image/gif' }
        }));
      if (mp4 && mp4.size)
        puts.push(env.MEDIA.put(mid + '.mp4', mp4.stream(), {
          httpMetadata: { contentType: 'video/mp4' }
        }));
      await Promise.all(puts);

      await env.DB.prepare(
        `INSERT INTO messages (id, to_email, to_name, body, stats, has_gif, has_mp4, created_at, sender_hash, sender_email, to_handle, view_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        // to_email is NOT NULL in the schema, so a handle-only message stores it
        // as '' (empty string). Every read treats '' as "no email" - it is falsy,
        // like the null we use for the newer sender_email / to_handle columns.
        //
        // view_token: when the recipient is reached on Instagram, the notifier
        // (tools/instagram/notify.mjs, runs on Sanjay's machine) needs the /m
        // link for this message. It can query D1 but cannot compute the token -
        // BLOCK_SECRET lives only in the Worker. So the token is minted here at
        // send time and stored beside the row. It grants exactly what the DM
        // will contain anyway: the right to view this one message.
        .bind(mid, email, name, body, stats, gif && gif.size ? 1 : 0, mp4 && mp4.size ? 1 : 0,
              Math.floor(Date.now() / 1000), ipHash, senderEmail || null, toHandle || null,
              toHandle ? await token(env.BLOCK_SECRET, 'view:' + mid) : null)
        .run();

      const gifUrl = gif && gif.size ? `${site}/media/${mid}.gif` : '';
      // The reply page link only exists when there is somebody to deliver to.
      const replyUrl = senderEmail
        ? `${site}/reply?id=${mid}&t=${await token(env.BLOCK_SECRET, 'reply:' + mid)}`
        : '';

      /* Email delivery happens only when they gave us an email address. A
         handle-only message is stored now and delivered on Instagram by the
         notifier (through the /m view page) - it sends no email here. */
      if (email) {
        const blockUrl = `${site}/block?e=${encodeURIComponent(email)}&t=${await token(env.BLOCK_SECRET, email)}`;
        const reportUrl = `${site}/report?id=${mid}&t=${await token(env.BLOCK_SECRET, 'r:' + mid)}`;

        const sent = await sendViaResend(env, {
          from: env.MAIL_FROM,
          // ALWAYS route replies through reply+<id>@ back to our email() handler,
          // whether or not the sender left an address. With an address it relays
          // to them; without one the handler answers the anonymity notice. If we
          // pointed no-address replies at a plain mailbox instead, that notice
          // branch would be dead code and a reply would vanish with no feedback -
          // which is exactly the "I replied and nothing happened" bug.
          reply_to: replyAddr(env, mid),
          to: [email],
          subject: `${name}, someone finally said it`,
          html: emailHtml({ name, body, stats, caption, gifUrl, pageUrl: site, blockUrl, reportUrl, replyUrl }),
          text: senderEmail
            ? `Hi ${name}, somebody used beatass.com to say something to you. They chose to stay anonymous.\n\n"${body}"\n\nThey left a way to hear back. Reply to this email and it reaches them (they stay anonymous), or write it here:\n${replyUrl}\n\nSend one of your own - free, anonymous, no sign-up:\n${site}\n\nBlock your address forever: ${blockUrl}\nReport this: ${reportUrl}`
            : `Hi ${name}, somebody used beatass.com to say something to you. They chose to stay anonymous.\n\n"${body}"\n\nThey stayed anonymous, so a reply can't reach them - hit reply and we'll tell you so, we won't leave you hanging. To say something back, send your own - free, anonymous, no sign-up:\n${site}\n\nBlock your address forever: ${blockUrl}\nReport this: ${reportUrl}`,
          // one-click unsubscribe: mail providers treat this as a strong
          // positive signal, and it keeps us out of the spam folder
          headers: { 'List-Unsubscribe': `<${blockUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        });
        if (!sent.ok)
          return json({ error: "We couldn't deliver that. Try again in a minute.", ref: sent.ref }, 502);
      }

      return json({ ok: true, id: mid });
    }

    /* Assets are configured with html_handling "none" so every file is served
       at exactly the name it has — no /privacy.html -> /privacy redirect, which
       would make every internal link and every sitemap entry cost a hop. The
       price of that is the root stops being mapped to index.html, so it lands
       here and we serve it ourselves. */
    if (url.pathname === '/') {
      const home = await env.ASSETS.fetch(new URL('/index.html', url.origin));
      return new Response(home.body, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
    }

    /* Everything else that isn't a static file. This is the only place the
       hand-drawn 404 page can actually be served from. */
    const missing = await env.ASSETS.fetch(new URL('/404.html', url.origin));
    return new Response(missing.body, {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
}
