# Admin dashboard — build spec (v1)

Sanjay directed it in chat ("build a dashboard to track all things end to end,
deploy it, admin password + email only, same design system"). This is the build
order. Everything lives in the Worker (`src/index.js`) so it can read D1 directly.

## Auth (fail-closed, security-sensitive — exposes private confessions)

- Secrets (NEVER in the repo — rule 5): `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
  Sanjay sets them himself; I never see the password:
    npx wrangler secret put ADMIN_EMAIL
    npx wrangler secret put ADMIN_PASSWORD
  (Local testing only: `.dev.vars`, which is gitignored. A committed `.env`
  does NOT reach production — Cloudflare stores secrets.)
- **Fail-closed:** if `ADMIN_PASSWORD` is unset/empty, every `/admin*` route
  denies. So deploying the code is safe before the secrets exist.
- Flow: `GET /admin/login` → styled form (email+password). `POST /admin/login`
  → constant-time compare against the secrets (reuse `sameToken`). On success set
  a signed cookie `ba_admin` = `<exp>.<sig>` where
  `sig = token(env.BLOCK_SECRET, 'admin:' + ADMIN_EMAIL + ':' + exp)` (reuse the
  existing `token()` helper), `HttpOnly; Secure; SameSite=Lax; Path=/admin`,
  ~7-day expiry. `GET /admin/logout` clears it.
- `requireAdmin(request, env)`: false if no `ADMIN_PASSWORD`; else parse cookie,
  recompute sig, `sameToken`, check `exp > now`. Any `/admin*` page: if not
  authed → 302 to `/admin/login`.
- `/admin*` responses carry `X-Robots-Tag: noindex` and no-store.

## New table: visits (privacy-safe, no IP, no cookie)

- `CREATE TABLE IF NOT EXISTS visits (day TEXT, path TEXT, country TEXT, n INTEGER,
  PRIMARY KEY (day, path, country))` — add to schema.sql AND create lazily in the
  Worker (local wrangler can't hit remote D1 here — 7403 — so the Worker must
  `CREATE TABLE IF NOT EXISTS` on first use).
- Log only real page views (`/`, `/m`, and the side pages) — NOT `/media/*`,
  `/api/*`, `/admin*`, `/cdn-cgi/*`. Upsert:
  `INSERT INTO visits ... VALUES (day, path, country, 1)
   ON CONFLICT(day,path,country) DO UPDATE SET n = n + 1`.
  `day = new Date().toISOString().slice(0,10)`, `country = request.cf?.country || '??'`.
  Run under `ctx.waitUntil` so it never slows the response. NOTE: fetch signature
  is currently `async fetch(request, env)` — add `ctx` and thread it into
  `handle(request, env, ctx)`.

## Dashboard `GET /admin` — data (all from D1)

- messages: total; today / 7d / 30d via `substr(created_at,1,10) >= date('now','-N days')`
  (date-only compares — created_at is ISO `...T...`, so never compare against
  datetime('now') which uses a space).
- per-day chart, last 14 days: `SELECT substr(created_at,1,10) d, COUNT(*) n
  FROM messages GROUP BY d ORDER BY d DESC LIMIT 14` → server-rendered SVG bars.
- channel split: email present = `to_email <> ''`; handle present =
  `to_handle IS NOT NULL AND to_handle <> ''`. Report both / email-only / handle-only.
- media: `SUM(has_gif)`, `SUM(has_mp4)`.
- reports: `SUM(reports)` and count of rows with reports > 0.
- reply address left: count `sender_email IS NOT NULL AND sender_email <> ''`.
- blocklist size: `COUNT(*) FROM blocklist`.
- visits: today total, 7d total, top paths (7d), top countries (7d).
- recent messages: last 50 — created_at, to_name, channel, has media, reports,
  body. Admin-only; body shown (operator can moderate). Escape all output.

## Design (same system)

Reuse the site palette: paper `#fbf7ea`/`#fffdf5`, ink `#26356e`, red `#cf3a2d`,
soft `#5b6a9c`, faint `#93a0c2`. Hand-drawn uneven `border-radius` on cards, no
emoji icons (inline SVG only). Layout: header ("beatass control room"), a row of
stat cards, the 14-day bar chart, the channel/media/reports cards, the visits
card, then the recent-messages table. System sans is fine (the Worker pages
already use it).

## Verify before claiming done (karpathy / G34)

- `node --check src/index.js`.
- Local wrangler dev + local D1 (seed a couple messages + visits):
  - `/admin` with NO cookie → 302 to login. (fail-closed control)
  - `/admin/login` POST wrong password → rejected. (RED)
  - correct password → cookie set, `/admin` renders the numbers. (GREEN)
  - with `ADMIN_PASSWORD` unset in env → `/admin` denies even with a cookie.
- Deploy (git push). Then curl `/admin` live → expect the login redirect (secrets
  not set yet) = proof it's fail-closed. Sanjay sets the 2 secrets to unlock.

## Parked (be honest in the UI — say "coming soon", don't fake numbers)

- Email opens/delivered/bounced → needs Resend API + a stored events table.
- Instagram DMs sent / posts / followers → that data lives on Sanjay's laptop
  (`.notified.json`, `.posted.json`, auto.log) + IG, not the Worker. Needs a
  pushed feed (e.g. notify.mjs POSTs counts to an admin-tokened Worker route).
