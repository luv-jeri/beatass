/* beatass bug reporter — capture, side sheet, submit.
 *
 * Loaded ONLY when somebody presses "Report a problem". Nobody who never
 * presses it pays a byte for it. That is why this is a separate file and not
 * baked into the page like the fonts and the GIF encoder.
 *
 * The whole design of this file is one rule:
 *
 *     NOTHING A PERSON TYPED, AND NOTHING THAT UNLOCKS A MESSAGE,
 *     EVER LEAVES THE BROWSER.
 *
 * Said precisely, because the precise version is the one that can be tested:
 * every capture point sanitises on the way IN, so the buffers this file keeps
 * never hold a confession, a recipient, or a ?t= token. It does NOT claim the
 * text is absent from the tab's memory — the confession is sitting in a
 * textarea by definition, and the inline stub in the page holds the last few
 * raw error strings until this file loads and scrubs them. What is guaranteed
 * is the boundary: nothing private crosses it. Two tests hold that line —
 * test-privacy.mjs on the functions, test-browser.mjs on the actual bytes
 * leaving a real browser.
 *
 * The confession, the recipient's email, and the ?t= token in a /m address are
 * the three things this site exists to protect.
 *
 * The design (ring buffer, byte ceiling, the order things get dropped in when
 * the bundle is too big, the bundle shape) is lifted from the tested
 * @gno/bug-capture package in the Tool Factory. The capture points are NOT —
 * six of them are wrong for this product and one leaks a view token.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/bug';
  var MAX_BUNDLE = 512 * 1024;   /* same ceiling the Tool Factory package uses */
  var LOG_CAP = 120;
  var NET_CAP = 80;
  var STEP_CAP = 60;
  var WINDOW_MS = 60 * 1000;     /* the "last minute" — a timeline, not a recording */

  /* ---------- what this page is, and therefore what may be captured ----------
     /m renders somebody's private confession and its address carries the token
     that unlocks it. /admin renders EVERY message in the database. Neither may
     ever be captured, so on those two pages the reporter is not offered at all
     and this module refuses to arm. */
  function pageKind() {
    var p = location.pathname;
    if (p === '/m') return 'private';
    if (p.indexOf('/admin') === 0) return 'admin';
    return 'app';
  }
  var KIND = pageKind();
  var ALLOWED = KIND === 'app';

  /* ---------- redaction, applied at capture time ----------
     Deliberately greedy. A false positive costs us a slightly less readable log
     line. A false negative costs somebody their anonymity. */
  var RULES = [
    [/[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,255}\.[a-z]{2,24}/gi, '[email]'],
    [/\+?91[\s-]?[6-9]\d{9}\b/g, '[phone]'],           /* +91XXXXXXXXXX, the stored shape */
    [/\b[6-9]\d{9}\b/g, '[phone]'],                    /* a bare Indian mobile */
    [/\b[a-f0-9]{32,}\b/gi, '[token]'],                /* HMAC tokens */
    [/\b[a-f0-9]{16}\b/gi, '[id]'],                    /* message ids */
    [/@[a-z0-9._]{2,30}\b/gi, '[handle]']              /* instagram handles */
  ];

  /* The fields on this page that hold something private. Their live values are
     scrubbed out of every captured string by exact match.

     This exists because pattern matching alone is not enough and the in-browser
     canary test proved it. An address or a phone number has a shape you can
     write a regular expression for. A confession does not - it is ordinary
     prose, and the moment any code does console.error('failed: ' + message) the
     whole thing lands in a log line that no pattern would ever catch.

     So we do not try to RECOGNISE the secret. We already know exactly what it
     is: it is whatever is sitting in these five boxes right now. */
  var SECRET_FIELDS = ['#i-msg', '#i-email', '#i-handle', '#i-wa', '#i-sender', '#i-name'];

  function secrets() {
    var out = [];
    try {
      for (var i = 0; i < SECRET_FIELDS.length; i++) {
        var f = document.querySelector(SECRET_FIELDS[i]);
        var v = f && f.value != null ? String(f.value).trim() : '';
        /* Below 3 characters it is not identifying, and replacing a 1-character
           string would shred every log line we have. */
        if (v.length >= 3) out.push(v);
      }
    } catch (e) { /* if the page shape changed, fall through to the patterns */ }
    return out;
  }

  function clean(s) {
    s = String(s == null ? '' : s);
    /* what the person actually typed goes first - it is the thing that matters
       most and the thing no pattern can find. split/join is a literal replace,
       so nothing here needs regex escaping. */
    var typed = secrets();
    for (var j = 0; j < typed.length; j++) s = s.split(typed[j]).join('[typed]');
    for (var i = 0; i < RULES.length; i++) s = s.replace(RULES[i][0], RULES[i][1]);
    return s;
  }

  /* A URL becomes the SHAPE of a URL. Never the query string — that is where
     ?t= lives — and never a real id, so /media/a1b2....gif becomes /media/:id. */
  function route(u) {
    var path;
    try { path = new URL(u, location.origin).pathname; } catch (e) { return '[bad-url]'; }
    return path
      .replace(/\/[a-f0-9]{16}\.(gif|mp4)$/i, '/:id.$1')
      .replace(/\/[a-f0-9]{16}\b/gi, '/:id');
  }

  /* ---------- the buffers ---------- */
  var logs = [], nets = [], steps = [];
  var armed = false;

  function trim(arr, cap) {
    var cut = Date.now() - WINDOW_MS;
    while (arr.length && arr[0].ts < cut) arr.shift();
    while (arr.length > cap) arr.shift();
  }

  function serialise(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a instanceof Error) { out.push(a.name + ': ' + a.message); continue; }
      if (typeof a === 'string') { out.push(a); continue; }
      try { out.push(JSON.stringify(a)); } catch (e) { out.push(String(a)); }
    }
    return out.join(' ');
  }

  function arm() {
    if (armed || !ALLOWED) return;
    armed = true;

    /* Adopt whatever the inline stub in the page caught before this file
       existed. That is usually the interesting part: the error someone is
       reporting happened before they went looking for the report button.
       It gets cleaned on the way in, exactly like everything else. */
    try {
      var early = window.__brEarly;
      if (early && early.length) {
        for (var j = 0; j < early.length; j++) {
          logs.push({ level: early[j].level, text: clean(early[j].text).slice(0, 500), ts: early[j].ts });
        }
        trim(logs, LOG_CAP);
      }
    } catch (e) { /* never let history-taking break the present */ }

    /* console.error and console.warn only. console.log on this page prints
       working state we have no reason to see. */
    ['error', 'warn'].forEach(function (level) {
      var original = console[level].bind(console);
      console[level] = function () {
        try {
          logs.push({ level: level, text: clean(serialise(arguments)).slice(0, 500), ts: Date.now() });
          trim(logs, LOG_CAP);
        } catch (e) { /* logging must never break the page */ }
        original.apply(null, arguments);
      };
    });

    window.addEventListener('error', function (e) {
      logs.push({ level: 'error', text: clean(e.message) + ' @ ' + route(e.filename || '') + ':' + e.lineno, ts: Date.now() });
      trim(logs, LOG_CAP);
    });
    window.addEventListener('unhandledrejection', function (e) {
      logs.push({ level: 'error', text: 'unhandled promise: ' + clean(e.reason && e.reason.message || e.reason), ts: Date.now() });
      trim(logs, LOG_CAP);
    });

    /* Network: the shape of the call and how it went. Never a body, never a
       header, never a query string. */
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input, init) {
        var start = Date.now();
        var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        function note(status) {
          nets.push({ method: method, route: route(url), status: status, ms: Date.now() - start, ts: Date.now() });
          trim(nets, NET_CAP);
        }
        return origFetch.apply(this, arguments).then(
          function (res) { note(res.status); return res; },
          function (err) { note(0); throw err; }
        );
      };
    }

    /* The step trail: WHICH control was used, never what was in it. */
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest && e.target.closest('button,a,[role="button"],input,textarea,select');
      if (!el) return;
      steps.push({ what: describe(el).label, ts: Date.now() });
      trim(steps, STEP_CAP);
    }, true);
  }

  /* ---------- describing an element without quoting it ----------
     The Tool Factory version returns textContent here. On this page the text
     content of the box next to the message IS the message, so it never leaves.
     A shape, a role and a size are enough to find the thing in the source. */
  function describe(el) {
    var tag = (el.tagName || '').toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var kind = tag === 'button' ? 'Button'
      : tag === 'a' ? 'Link'
      : (tag === 'input' || tag === 'textarea' || tag === 'select') ? 'Field'
      : tag === 'img' || tag === 'svg' ? 'Image'
      : /^h[1-6]$/.test(tag) ? 'Heading'
      : tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : 'Element';
    /* aria-label, data-label and id are author-written short names, safe to
       quote and useful in a stack trace. A placeholder is author-written too,
       but on THIS page the message box's placeholder is an example confession
       ("I've been holding this in for two years..."), so a report would carry
       something that reads exactly like a captured secret and would send
       triage chasing a leak that never happened. The id is better evidence
       anyway. The canary test caught this on its first run. */
    var name = el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('data-label')) || '';
    if (!name && id) name = id;
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    return {
      selector: id || (tag + (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '')),
      label: name ? kind + ' · ' + clean(name).slice(0, 40) : kind,
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    };
  }

  /* ---------- environment ---------- */
  function env() {
    var m = null;
    /* Chrome only, and deliberately coarse: a bucket in MB, never a heap dump. */
    if (window.performance && performance.memory) {
      m = Math.round(performance.memory.usedJSHeapSize / 1048576);
      m = m < 32 ? '<32MB' : m < 128 ? '32-128MB' : m < 512 ? '128-512MB' : '>512MB';
    }
    return {
      ua: navigator.userAgent,
      viewport: { w: innerWidth, h: innerHeight },
      dpr: devicePixelRatio || 1,
      lang: navigator.language || '',
      online: navigator.onLine,
      memory: m,
      /* Whether a reset would plausibly help — the "is it just cache?" verdict
         needs this. A boolean, not the contents of anything. */
      hasStorage: (function () {
        try { return !!(localStorage.length || sessionStorage.length); } catch (e) { return null; }
      })(),
      /* Never the names, never the values. Just: is there any cookie at all. */
      hasCookies: document.cookie.length > 0
    };
  }

  /* ---------- the bundle, and what gets dropped when it is too big ---------- */
  function size(o) { return new TextEncoder().encode(JSON.stringify(o)).length; }

  function build(input) {
    var b = {
      schema: 1,
      ts: Date.now(),
      kind: input.kind,
      note: clean(input.note).slice(0, 4000),
      replyEmail: input.replyEmail,          /* they typed it on purpose, so it stays */
      page: { route: route(location.href), title: document.title, kindOfPage: KIND },
      env: env(),
      elements: input.elements,
      logs: logs.slice(),
      network: nets.slice(),
      steps: steps.slice(),
      screenshots: input.screenshots.length
    };
    if (size(b) <= MAX_BUNDLE) return b;
    b.truncated = true;
    while (size(b) > MAX_BUNDLE && b.logs.length > 5) b.logs.shift();
    while (size(b) > MAX_BUNDLE && b.network.length > 5) b.network.shift();
    while (size(b) > MAX_BUNDLE && b.steps.length > 5) b.steps.shift();
    if (size(b) > MAX_BUNDLE) { b.logs = []; b.network = []; b.steps = []; }
    return b;
  }

  /* How much evidence one report may carry. Sanjay's ceilings, 2026-08-15.
     Past these numbers a report stops being evidence and starts being a
     payload, and the person filing it has long since made their point. */
  var MAX_SHOTS = 5;
  var MAX_ELEMENTS = 20;

  /* ---------- the element picker ---------- */
  var picking = false, shooting = false;
  function pick(onDone) {
    if (picking) return;
    picking = true;
    var box = document.createElement('div');
    box.className = 'br-hilite';
    document.body.appendChild(box);
    function move(e) {
      var el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el.closest('.br-sheet') || el === box) return;
      var r = el.getBoundingClientRect();
      box.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
      box.dataset.el = '1';
      box._el = el;
    }
    function done(e) {
      e.preventDefault(); e.stopPropagation();
      var el = box._el;
      stop();
      if (el) onDone(describe(el));
    }
    function key(e) { if (e.key === 'Escape') { stop(); onDone(null); } }
    function stop() {
      picking = false;
      box.remove();
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', done, true);
      document.removeEventListener('keydown', key, true);
      document.documentElement.classList.remove('br-picking');
    }
    document.documentElement.classList.add('br-picking');
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', done, true);
    document.addEventListener('keydown', key, true);
  }

  /* ---------- screenshot mode ----------
     Drag a box around what is broken, or take the whole screen.

     The dangerous part is that a screenshot turns everything on the page into
     pixels, and no amount of text redaction can reach into an image. So the
     order below is not negotiable:

       1. tear down our own toolbar, so it is not in the picture
       2. put data-capturing on <html> - the stylesheet masks every private
          field the moment that lands
       3. let the browser paint, THEN rasterise
       4. take the attribute off again

     Step 3 matters. Rasterising in the same frame the attribute is set can
     photograph the page as it was before the mask applied. */
  function shoot(onDone) {
    if (shooting) return;
    shooting = true;

    var html = document.documentElement;
    html.classList.add('br-shoot');

    var bar = el('<div class="br-bar"><span>Drag a box around what is wrong</span>' +
      '<button type="button" class="go" data-a="all">Whole screen</button>' +
      '<button type="button" data-a="no">Cancel</button></div>');
    var rect = el('<div class="br-rect" style="display:none"></div>');
    document.body.appendChild(bar);
    document.body.appendChild(rect);

    var start = null, box = null;
    var ours = function (t) { return t && t.closest && t.closest('.br-bar'); };

    function down(e) {
      if (ours(e.target)) return;
      e.preventDefault();
      start = { x: e.clientX, y: e.clientY };
      rect.style.display = 'block';
    }
    function move(e) {
      if (!start) return;
      box = {
        x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY),
        w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y)
      };
      rect.style.cssText = 'left:' + box.x + 'px;top:' + box.y + 'px;width:' + box.w + 'px;height:' + box.h + 'px';
    }
    function up() {
      if (!start) return;
      start = null;
      if (box && box.w > 8 && box.h > 8) capture(box);
      else { rect.style.display = 'none'; box = null; }
    }
    function key(e) { if (e.key === 'Escape') { teardown(); onDone(null); } }

    bar.addEventListener('click', function (e) {
      var a = e.target.closest('button') && e.target.closest('button').dataset.a;
      if (a === 'all') capture({ x: 0, y: 0, w: innerWidth, h: innerHeight });
      if (a === 'no') { teardown(); onDone(null); }
    });

    function teardown() {
      shooting = false;
      html.classList.remove('br-shoot');
      bar.remove(); rect.remove();
      document.removeEventListener('mousedown', down, true);
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      document.removeEventListener('keydown', key, true);
    }

    function capture(area) {
      teardown();
      var busy = el('<div class="br-busy">Taking the picture...</div>');
      document.body.appendChild(busy);
      html.setAttribute('data-capturing', '');

      /* two frames, so the mask is definitely painted before we photograph */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          var lib = window.__shotLib;
          if (!lib || !lib.domToCanvas) {
            html.removeAttribute('data-capturing'); busy.remove();
            onDone(null, 'The screenshot tool did not load. Reload the page and try again.');
            return;
          }
          lib.domToCanvas(document.body, { scale: 1, backgroundColor: null })
            .then(function (full) {
              var dpr = full.width / Math.max(1, document.body.scrollWidth);
              var out = document.createElement('canvas');
              out.width = Math.max(1, Math.round(area.w * dpr));
              out.height = Math.max(1, Math.round(area.h * dpr));
              out.getContext('2d').drawImage(
                full,
                Math.round((area.x + scrollX) * dpr), Math.round((area.y + scrollY) * dpr),
                out.width, out.height, 0, 0, out.width, out.height
              );
              out.toBlob(function (blob) {
                html.removeAttribute('data-capturing'); busy.remove();
                onDone(blob);
              }, 'image/png');
            })
            .catch(function (err) {
              html.removeAttribute('data-capturing'); busy.remove();
              console.warn('screenshot failed', err);
              onDone(null, 'That screenshot did not work. You can still send the report without it.');
            });
        });
      });
    }

    document.addEventListener('mousedown', down, true);
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
    document.addEventListener('keydown', key, true);
  }

  /* ---------- submit ---------- */
  function submit(input) {
    var bundle = build(input);
    var fd = new FormData();
    fd.append('bundle', new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
    input.screenshots.forEach(function (s, i) { fd.append('shot-' + i, s, 'shot-' + i + '.png'); });
    return fetch(ENDPOINT, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.error || 'That did not go through.');
        return data;
      });
    });
  }

  /* ---------- the side sheet ----------
     Built in JS rather than sitting in template.html, because the page must
     not carry markup for a panel almost nobody opens. */

  var ICON = {
    pick: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l4.4 11 1.9-4.4L12.7 6.6z"/></svg>',
    shot: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1.6" y="3.6" width="12.8" height="9.4" rx="1.6"/><circle cx="8" cy="8.3" r="2.6"/><path d="M5.6 3.6l1-1.6h2.8l1 1.6"/></svg>',
    bug: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.4 5.2a2.6 2.6 0 015.2 0"/><rect x="4.6" y="5.2" width="6.8" height="7.4" rx="3.4"/><path d="M4.6 7.6H2m12 0h-2.6M4.6 10.6H2.4m11.2 0h-2.2M6 13l-1.2 1.6M10 13l1.2 1.6"/></svg>'
  };

  var sheet, scrim, state;

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function chips() {
    var ul = sheet.querySelector('.br-chips');
    ul.innerHTML = '';
    state.elements.forEach(function (e, i) {
      var li = el('<li>' + esc(e.label) + ' <button type="button" aria-label="Remove">&times;</button></li>');
      li.querySelector('button').onclick = function () { state.elements.splice(i, 1); chips(); };
      ul.appendChild(li);
    });
    /* Pictures get shown, not just counted. Somebody who has just dragged a box
       round part of their screen wants to know they caught the right part, and
       on this product they also deserve to SEE that the private fields came out
       masked before they agree to send it. A chip reading "picture 1" asks them
       to take that on trust. */
    state.shotUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    state.shotUrls = [];
    state.screenshots.forEach(function (s, i) {
      var url = URL.createObjectURL(s);
      state.shotUrls.push(url);
      var li = el(
        '<li class="br-shotchip">' +
        '<img src="' + url + '" alt="Picture ' + (i + 1) + ' of what you are reporting">' +
        '<span>' + Math.max(1, Math.round(s.size / 1024)) + ' KB</span>' +
        '<button type="button" aria-label="Remove this picture">&times;</button>' +
        '</li>'
      );
      /* click the picture to see it full size */
      li.querySelector('img').onclick = function () { zoom(url); };
      li.querySelector('button').onclick = function () {
        state.screenshots.splice(i, 1); chips();
      };
      ul.appendChild(li);
    });
    /* the buttons say when they are full, rather than failing on click */
    var pickBtn = sheet.querySelector('[data-act="pick"]');
    var shotBtn = sheet.querySelector('[data-act="shot"]');
    if (pickBtn) pickBtn.disabled = state.elements.length >= MAX_ELEMENTS;
    if (shotBtn) shotBtn.disabled = state.screenshots.length >= MAX_SHOTS;
  }

  /* Full-size look at a picture before sending it. Deliberately a plain
     overlay inside our own sheet rather than a new tab: a new tab would be a
     second place the image exists, and this one disappears with the sheet. */
  function zoom(url) {
    var v = el('<div class="br-zoom"><img src="' + url + '" alt="The picture you are about to send">' +
      '<p>Tap anywhere to close. This is exactly what gets sent.</p></div>');
    v.onclick = function () { v.remove(); };
    document.body.appendChild(v);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function say(text, bad) {
    var m = sheet.querySelector('.br-msg');
    m.textContent = text || '';
    m.className = 'br-msg' + (bad ? ' bad' : '');
  }

  function build_sheet() {
    scrim = el('<div class="br-scrim"></div>');
    sheet = el(
      '<aside class="br-sheet" role="dialog" aria-modal="true" aria-label="Report a problem">' +
      '<div class="br-head"><div>' +
      '<h2>What went wrong?</h2>' +
      '<p>Or tell us what is missing. Either helps.</p>' +
      '</div><button class="br-x" type="button" aria-label="Close">&times;</button></div>' +
      '<div class="br-body">' +
      '<div class="br-field"><label for="br-kind">Which is it</label>' +
      '<select id="br-kind">' +
      '<option value="bug">Something is broken</option>' +
      '<option value="doll">The doll or the drawing misbehaved</option>' +
      '<option value="send">It would not send</option>' +
      '<option value="look">Something looks wrong on my screen</option>' +
      '<option value="wording">A typo or confusing wording</option>' +
      '<option value="feature">I wish it could do something else</option>' +
      '</select></div>' +
      '<div class="br-field"><label for="br-note">Tell us in your own words</label>' +
      '<textarea id="br-note" maxlength="4000" placeholder="I pressed send and nothing happened..."></textarea>' +
      '<p class="br-hint">What you expected, and what happened instead.</p></div>' +
      '<div class="br-field"><label>Show us where</label>' +
      '<div class="br-tools">' +
      '<button class="br-tool" type="button" data-act="pick">' + ICON.pick + 'Point at it</button>' +
      '<button class="br-tool" type="button" data-act="shot">' + ICON.shot + 'Take a picture</button>' +
      '</div><ul class="br-chips"></ul></div>' +
      '<div class="br-field"><label for="br-mail">Your email, if you want an answer</label>' +
      '<input id="br-mail" type="email" placeholder="you@example.com" autocomplete="off">' +
      '<p class="br-hint">Only used to reply about this report. Leave it empty to stay anonymous.</p></div>' +
      '<div class="br-promise">' +
      'What we send with this: which buttons you pressed, any errors the page printed, ' +
      'how our own requests went, and your browser and screen size.<br><br>' +
      '<b>Never your confession. Never who you were writing to. Never a link that opens a message.</b> ' +
      'Those are stripped before anything is stored, not after.' +
      '</div>' +
      '</div>' +
      '<div class="br-foot">' +
      '<button class="br-send" type="button">Send report</button>' +
      '<button class="br-cancel" type="button">Cancel</button>' +
      '<span class="br-msg"></span>' +
      '</div></aside>'
    );
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);

    scrim.onclick = close;
    sheet.querySelector('.br-x').onclick = close;
    sheet.querySelector('.br-cancel').onclick = close;
    sheet.querySelector('.br-send').onclick = send;

    sheet.querySelector('[data-act="pick"]').onclick = function () {
      if (state.elements.length >= MAX_ELEMENTS) {
        say('That is ' + MAX_ELEMENTS + ' things already - plenty to go on.', true);
        return;
      }
      say('Click the thing that is wrong. Escape to stop.');
      close(true);
      pick(function (d) {
        open();
        if (!d) { say(''); return; }
        state.elements.push(d);
        chips();
        say(state.elements.length >= MAX_ELEMENTS
          ? 'Got it. That is the last one we can take.'
          : 'Got it. Point at another if you like.');
      });
    };

    sheet.querySelector('[data-act="shot"]').onclick = function () {
      if (state.screenshots.length >= MAX_SHOTS) {
        say('That is ' + MAX_SHOTS + ' pictures already.', true);
        return;
      }
      say('');
      close(true);
      shoot(function (blob, err) {
        open();
        if (err) { say(err, true); return; }
        if (!blob) { say(''); return; }
        state.screenshots.push(blob);
        chips();
        say(state.screenshots.length >= MAX_SHOTS
          ? 'Added. That is the last picture we can take.'
          : 'Added. You can take another.');
      });
    };
    sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  function open() {
    if (!ALLOWED) return;
    if (!sheet) { build_sheet(); state = { elements: [], screenshots: [], shotUrls: [] }; }
    scrim.classList.add('on');
    sheet.classList.add('on');
    var f = sheet.querySelector('#br-note');
    if (f) setTimeout(function () { f.focus(); }, 60);
  }

  function close(keepState) {
    if (!sheet) return;
    scrim.classList.remove('on');
    sheet.classList.remove('on');
    if (!keepState) say('');
  }

  function send() {
    var btn = sheet.querySelector('.br-send');
    var note = sheet.querySelector('#br-note').value.trim();
    if (note.length < 5) { say('Tell us a little more.', true); return; }
    var mail = sheet.querySelector('#br-mail').value.trim();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { say('That email looks wrong.', true); return; }

    btn.disabled = true; say('Sending...');
    submit({
      kind: sheet.querySelector('#br-kind').value,
      note: note,
      replyEmail: mail,
      elements: state.elements.slice(0, MAX_ELEMENTS),
      screenshots: state.screenshots.slice(0, MAX_SHOTS)
    }).then(function (data) {
      state.shotUrls.forEach(function (u) { URL.revokeObjectURL(u); });
      state.shotUrls = [];
      sheet.querySelector('.br-body').innerHTML =
        '<div class="br-done"><h3>Thank you - we have it.</h3>' +
        '<p>Someone looks at every one of these.' +
        (mail ? ' We will email you what we find.' : '') + '</p>' +
        '<p>Your reference: <span class="br-ref">' + esc(data.id || '') + '</span></p></div>';
      sheet.querySelector('.br-foot').innerHTML = '<button class="br-cancel" type="button">Close</button>';
      sheet.querySelector('.br-cancel').onclick = close;
    }).catch(function (err) {
      btn.disabled = false;
      say(err && err.name === 'TimeoutError'
        ? 'That took too long. Try again in a minute.'
        : (err && err.message) || 'That did not go through.', true);
    });
  }

  /* the button that starts all of it */
  function mount() {
    if (!ALLOWED || document.querySelector('.br-open')) return;
    var b = el('<button class="br-open" type="button">' + ICON.bug + 'Report a problem</button>');
    b.onclick = open;
    document.body.appendChild(b);
  }

  window.BugReport = {
    arm: arm,
    mount: mount,
    open: open,
    allowed: ALLOWED,
    pageKind: KIND,
    pick: pick,
    shoot: shoot,
    submit: submit,
    describe: describe,
    /* exposed so the test can prove the rules hold */
    _clean: clean,
    _route: route,
    _build: build,
    _buffers: function () { return { logs: logs, nets: nets, steps: steps }; }
  };

  arm();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
