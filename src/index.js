/**
 * beatass — the API.
 *
 * Four jobs, and nothing else:
 *   POST /api/send   take a confession + its GIF/MP4, store them, email it
 *   GET  /media/:id  serve the GIF or MP4 out of R2
 *   GET  /block      permanently stop mail to an address (one click, from the email)
 *   GET  /report     flag a message so it can be looked at
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
const RATE_LIMIT = 5;              // sends
const RATE_WINDOW = 60 * 60;       // per hour, per IP

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
function emailHtml({ name, body, stats, caption, gifUrl, pageUrl, blockUrl, reportUrl }) {
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
            <td class="msg" style="padding:28px 26px;font-family:${SANS};font-size:22px;line-height:1.62;font-weight:700;color:${INK};white-space:pre-wrap;word-break:break-word">${esc(body)}</td>
          </tr>
        </table>

        ${gifUrl ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
          <tr><td align="center" style="padding:0">
            <a href="${pageUrl}" style="text-decoration:none"><img src="${gifUrl}" alt="What they did to the doll" width="300" class="doll" style="display:block;max-width:100%;border:2px solid ${INK};border-radius:9px 12px 8px 11px"></a>
          </td></tr>
          ${line ? `<tr><td align="center" style="padding:11px 0 0;font-family:${SANS};font-size:14px;color:${RED}">${line}</td></tr>` : ''}
        </table>` : (line ? `<p style="margin:18px 0 0;text-align:center;font-family:${SANS};font-size:14px;color:${RED}">${line}</p>` : '')}

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

/* Exported so tools/email-preview.mjs can render the real thing to a file. The
   whole point is that what you look at is the same function the Worker sends,
   not a copy that drifts. Unused by the Worker itself. */
export { emailHtml };

export default {
  async fetch(request, env) {
    /* Anything that escapes below used to reach the visitor as Cloudflare's bare
       "error code: 1101" with nothing in the response and nothing readable in
       the logs. One catch turns every such case into a real answer. */
    try {
      return await handle(request, env);
    } catch (err) {
      console.error('unhandled', err && err.stack || String(err));
      return json({ error: 'Something broke on our side.', ref: 'unhandled' }, 500);
    }
  }
};

async function handle(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const site = env.SITE_URL || url.origin;

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
      const t = url.searchParams.get('t') || '';
      if (!okEmail(email) || !sameToken(t, await token(env.BLOCK_SECRET, email)))
        return notice('That link has expired', 'Reply to the email instead and we will sort it out.');

      if (request.method !== 'POST')
        return confirm(
          'Block this address?',
          `Nobody will be able to use beatass.com to send anything to ${esc(email)} again. This cannot be undone.`,
          'Yes, block it forever',
          `/block?e=${encodeURIComponent(email)}&t=${encodeURIComponent(t)}`
        );

      await env.DB.prepare('INSERT OR IGNORE INTO blocklist (email, created_at) VALUES (?, ?)')
        .bind(email, Math.floor(Date.now() / 1000))
        .run();
      return notice('Done — you will never hear from us again.',
        'That address is blocked permanently. Nobody can use beatass.com to contact you.');
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

      if (!name || name.length > MAX_NAME) return json({ error: 'That name looks wrong.' }, 400);
      if (!okEmail(email)) return json({ error: "That's not an email address." }, 400);
      if (body.length < 3 || body.length > MAX_BODY)
        return json({ error: 'Say a little more than that.' }, 400);

      // never send to somebody who has already told us to stop
      const blocked = await env.DB.prepare('SELECT 1 FROM blocklist WHERE email = ?')
        .bind(email)
        .first();
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
        `INSERT INTO messages (id, to_email, to_name, body, stats, has_gif, has_mp4, created_at, sender_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(mid, email, name, body, stats, gif && gif.size ? 1 : 0, mp4 && mp4.size ? 1 : 0,
              Math.floor(Date.now() / 1000), ipHash)
        .run();

      const blockUrl = `${site}/block?e=${encodeURIComponent(email)}&t=${await token(env.BLOCK_SECRET, email)}`;
      const reportUrl = `${site}/report?id=${mid}&t=${await token(env.BLOCK_SECRET, 'r:' + mid)}`;
      const gifUrl = gif && gif.size ? `${site}/media/${mid}.gif` : '';

      /* A key gets here by being copied, and a copied secret picks up whitespace
         — a trailing newline, or a line break in the middle if the box it was
         copied from wrapped. Any of those is illegal in a header value and the
         request throws before it is ever sent, which reads as a total outage
         rather than a bad key. A Resend key is "re_" plus letters, digits and
         underscores and never contains whitespace, so removing all of it can
         only ever repair the paste. */
      const key = String(env.RESEND_API_KEY || '').replace(/\s+/g, '');
      if (!/^re_[A-Za-z0-9_]+$/.test(key)) {
        // shape only — length and prefix say what is wrong without leaking it
        console.error('resend: key does not look like a Resend key', 'len=' + key.length,
                      'starts=' + key.slice(0, 3));
        return json({ error: "We couldn't deliver that. Try again in a minute.", ref: 'key_shape' }, 502);
      }

      let res;
      try {
        res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + key,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          // A reply must reach a human. It reaches us, not the sender — the
          // footer says so, because a reply that quietly vanishes into an
          // anonymous void is the moment somebody stops trusting this.
          reply_to: env.MAIL_REPLY_TO,
          to: [email],
          subject: `${name}, someone finally said it`,
          html: emailHtml({ name, body, stats, caption, gifUrl, pageUrl: site, blockUrl, reportUrl }),
          text: `Hi ${name}, somebody used beatass.com to say something to you. They chose to stay anonymous.\n\n"${body}"\n\nReplying to this email reaches us, not them. To say something back, send your own — free, anonymous, no sign-up:\n${site}\n\nBlock your address forever: ${blockUrl}\nReport this: ${reportUrl}`,
          // one-click unsubscribe: mail providers treat this as a strong
          // positive signal, and it keeps us out of the spam folder
          headers: { 'List-Unsubscribe': `<${blockUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        })
        });
      } catch (err) {
        console.error('resend threw', err && err.stack || String(err));
        return json({ error: "We couldn't deliver that. Try again in a minute.", ref: 'resend_threw' }, 502);
      }

      if (!res.ok) {
        const detail = await res.text();
        console.error('resend failed', res.status, detail);
        // the status is safe to surface; the body is not, it can echo the key
        return json({ error: "We couldn't deliver that. Try again in a minute.", ref: 'resend_' + res.status }, 502);
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
