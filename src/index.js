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
function emailHtml({ name, body, stats, gifUrl, pageUrl, blockUrl, reportUrl }) {
  const caption = stats ? `…and this is what they did to you. (${esc(stats)})` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c2333">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:10px;padding:22px 22px 18px">
  <p style="margin:0 0 14px;font-size:15px;line-height:1.5">Hi ${esc(name)}, somebody used beatass.com to tell you something. They chose to stay anonymous.</p>
  <div style="border-left:3px solid #cf3a2d;background:#faf9f6;padding:12px 14px;margin:0 0 16px;font-size:15px;line-height:1.55;white-space:pre-wrap;word-break:break-word">${esc(body)}</div>
  ${gifUrl ? `<div style="text-align:center;margin:0 0 6px"><a href="${pageUrl}"><img src="${gifUrl}" alt="What they did to the doll" width="260" style="max-width:100%;border:1px solid #ececec;border-radius:6px"></a></div>` : ''}
  ${caption ? `<p style="margin:0 0 16px;text-align:center;font-size:12px;color:#77809a">${caption}</p>` : ''}
  <p style="margin:0 0 4px;font-size:12px;color:#98a0b3;border-top:1px solid #ececec;padding-top:12px">You're getting this because someone entered your address on beatass.com. We never share who sent it, and we never will.</p>
  <p style="margin:0;font-size:12px;color:#98a0b3"><a href="${reportUrl}" style="color:#77809a">Report this</a> &middot; <a href="${blockUrl}" style="color:#77809a">Block my address forever</a></p>
</div></body></html>`;
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

export default {
  async fetch(request, env) {
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

    /* ---------- block: one click, permanent ---------- */
    if (path === '/block') {
      const email = (url.searchParams.get('e') || '').toLowerCase().trim();
      const t = url.searchParams.get('t') || '';
      if (!okEmail(email) || !sameToken(t, await token(env.BLOCK_SECRET, email)))
        return notice('That link has expired', 'Reply to the email instead and we will sort it out.');
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

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + env.RESEND_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          from: env.MAIL_FROM,
          to: [email],
          subject: `${name}, someone finally said it`,
          html: emailHtml({ name, body, stats, gifUrl, pageUrl: site, blockUrl, reportUrl }),
          text: `Hi ${name}, somebody used beatass.com to tell you something anonymously.\n\n"${body}"\n\nBlock your address forever: ${blockUrl}\nReport this: ${reportUrl}`,
          // one-click unsubscribe: mail providers treat this as a strong
          // positive signal, and it keeps us out of the spam folder
          headers: { 'List-Unsubscribe': `<${blockUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        })
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error('resend failed', res.status, detail);
        return json({ error: "We couldn't deliver that. Try again in a minute." }, 502);
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
};
