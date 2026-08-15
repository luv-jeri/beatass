# Stability report — beatass

Date: 2026-08-15
Reviewed by: SahaJiv (Claude Opus 5) with GPT-5.6 Sol at xhigh effort, findings cross-checked against each other.

Two agents audited this project independently. Sol read the code cold and produced 50 severity-tagged findings. I ran live checks against the running system, the laptop automation and the test suite, then verified Sol's biggest claims against the real code before accepting any of them. Three of Sol's claims were wrong or overstated and are corrected below. Two of mine were wrong and are corrected too.

Raw agent output is kept in `AUDIT-SOL.md` (stability) and `PLAN-SELFHEAL-SOL.md` (the self-healing design debate).

---

## The one-line verdict

The product's code is in better shape than most things of its size — but **the machinery around it is off, and the alarm that would tell you is off too.**

| Layer | State |
|---|---|
| Worker code, send path, admin auth | Solid. Real guards, real reasoning, documented decisions |
| Test suite | **Red locally, and 6 of 8 suites never run** |
| Delivery automation (Instagram, WhatsApp, sync) | **Dead since 9 August — six days** |
| The watchdog that should have caught that | **Also dead** |
| Live site | Up. Warm response ~0.34s. No caching at all on the homepage |

---

## Part 1 — What is actually broken right now

These are live checks I ran today, not code reading.

### L1 · Every scheduled job is disabled. Delivery has been dead for six days. `P0`

```
launchctl print gui/501 | grep beatass
  com.beatass.logcheck   => disabled
  com.beatass.notify     => disabled     <- Instagram delivery
  com.beatass.whatsapp   => disabled     <- WhatsApp delivery
  com.beatass.insights   => disabled
  com.beatass.eventsync  => disabled
  com.beatass.health     => disabled
```

Last time anything ran, by log timestamp: Instagram **9 Aug 21:01**, WhatsApp **8 Aug 16:31**, events-sync **9 Aug 21:31**. Today is 15 Aug.

**What this means in plain English:** when someone sends a confession to an Instagram handle or a WhatsApp number, the website stores it correctly and tells the sender it went through. The laptop is what actually delivers it. The laptop has not been delivering anything for six days. Those messages are sitting in the database, undelivered, and the sender believes they arrived.

Email is unaffected — the Worker sends those itself, live.

I could not count exactly how many are stranded, because reading the production database needs an interactive Cloudflare login this session doesn't have. **You can get the number in about 30 seconds:** `node tools/status.mjs stuck`

### L2 · The watchdog shares the fate of the thing it watches `P0`

`com.beatass.logcheck` exists precisely to notice when delivery stops. It is disabled by the same switch that disabled delivery. A monitor that dies with its subject is not a monitor. This is why six days passed silently.

### L3 · `npm test` is red, and hides it by stopping early `P1`

`npm test` chains every suite with `&&`. The 4th link fails, so **everything after it never runs**:

```
build.py .............................. ok
test-relay.mjs ........................ ok
instagram dm selftest ....... 34/34 pass
instagram outreach selftest .. FAILED (7)  <-- chain stops here
whatsapp selftest ........... never runs
classify selftest ........... never runs
test.mjs (browser, layout) .. never runs
test-sound.mjs .............. never runs
test-queue.mjs .............. never runs
test-events.mjs ............. never runs
```

I ran the six skipped suites by hand. **All six pass.** So the product is fine; the safety net is not.

The 7 failures are a *stale test*, not a bug. On 2026-08-07 you deliberately set `outreach.follow` and `outreach.comment` to `false` in `tools/instagram/config.json` because the account was reach-restricted. The selftest still asserts "a new person gets a follow → true".

**The landmine:** that config change is still uncommitted. CI runs `npm test` on every push and only deploys if it passes. The day that config file gets committed, **CI goes red and deploys stop**, and the cause will look unrelated to the change.

### L4 · The browser tests cannot run on your laptop at all `P1`

```
browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1234/
```

Playwright's browser is not installed locally. `test.mjs` and `test-sound.mjs` — the two that catch the scrolling and GIF failures your `CLAUDE.md` calls the most important — exit 1 immediately on your machine. CI installs the browser, so CI does run them. But you cannot check your own work before pushing. One command fixes it: `npx playwright install chromium`.

### L5 · The Instagram notifier has no overlap guard `P2`

`tools/whatsapp/auto-whatsapp.sh:27` refuses to start if another run is going. `tools/instagram/auto-notify.sh` has no such check. Two Instagram runs can overlap, share one state file, and both DM the same person.

### L6 · No log rotation anywhere `P2`

`~/.config/beatass-instagram/auto.log` is 304 KB and grows forever. Nothing truncates or rotates. Slow leak, not urgent.

### L7 · The git repository is 1.1 GB `P2`

176 `.mp4` files are committed, 1.35 GB of tracked content. `.gitignore` already excludes Remotion renders for exactly this reason, but `content/instagram/*.mp4` and `marketing/production/**/final/*.mp4` are tracked. Every clone and every CI checkout pays for this.

---

## Part 2 — Speed

Measured live today against beatass.com.

| What | Measured | Note |
|---|---|---|
| Homepage, cold | 1.05s to first byte | Worker cold start |
| Homepage, warm | 0.34s to first byte, 0.44s total | Fine |
| Homepage size | **154 KB brotli / 290 KB raw, every single visit** | |
| `cache-control` on `/` | **absent** | |
| `etag` on `/` | **absent** | |
| `cf-cache-status` on `/` | **absent** — never edge-cached | |
| `/about.html` | `cf-cache-status: HIT` | static pages are cached |

### S1 · The homepage is uncacheable, and it is an accident `P1`

`src/index.js:1577` builds a brand-new header object containing only `content-type`, throwing away everything the asset layer returned — including its ETag and cache headers. Same bug in the 404 handler at `src/index.js:1586`.

**Consequence:** a repeat visitor re-downloads all 154 KB every time. There is no conditional request, so the browser can never get a cheap `304 Not Modified`.

**Smallest fix:** spread the original response headers and override only `content-type`. That restores the ETag and gives you 304s for free. ~10 minutes.

Sol found a second bug in the same three lines that I missed: because the handler hardcodes `status: 200`, **if the asset layer returns a 404 or a 500, the Worker turns it into a 200** and serves an error body as if it were the homepage.

### S2 · 135 KB of the page is base64 fonts that can never be cached separately `P2`

| Piece | Size in the page |
|---|---|
| Caveat font | 66 KB |
| Marker font | 38 KB |
| PatrickHand font | 31 KB |
| gif.js + worker | 29 KB |
| Your own code | ~118 KB |

Base64 also costs 33% over the raw bytes. Serving the three fonts as real `.woff2` files with `immutable` caching would cut ~33 KB of overhead *and* make them cacheable forever after the first visit.

This one is a genuine trade-off against your "one file, works with no internet" rule, so I am flagging it rather than recommending it. If the offline-single-file property still matters, keep it as is.

### S3 · Two wasted database round-trips on every homepage hit `P2`

`logVisit` (`src/index.js:496`) and `logEvent` (`src/index.js:516`) each run `CREATE TABLE IF NOT EXISTS` *before* their insert, on every single call. That is a defensive choice with a comment explaining it — but it doubles the D1 statements for every page view and every event, forever, to guard against a migration that has long since run.

---

## Part 3 — Code findings

Sol produced 50 findings, 28 at P0/P1, every one with a `file:line`. I verified the highest-impact ones myself. The table below marks what I confirmed against the real code versus what I am passing through on Sol's citation.

### Confirmed by me

| # | Sev | What breaks | Where | Fix |
|---|---|---|---|---|
| C1 | P0 | **"Reply right here" is a promise nothing can keep.** Instagram and WhatsApp messages tell the recipient to reply in the DM. Nothing anywhere reads inbound DMs or WhatsApp messages. `grep` for any inbound reader returns nothing; no tool reads `sender_email`. Email has a working relay; the other two channels do not. The reply is never seen by anyone, and the sender never learns someone answered | `tools/instagram/notify.mjs:200`, `tools/whatsapp/notify.mjs:130` | Either build the reader, or change the copy to point at the `/m` page's reply box, which does work. Honesty law says this cannot stay as is |
| C2 | P1 | **The doll picture silently vanishes.** If the GIF worker is blocked, the code falls back to a PNG still, sets `state.isStill`, and shows it in the preview. But only `state.gifBlob` is ever attached to the send, and the fallback never sets it. The user sees their doll, presses send, and the recipient gets an email with no image | `template.html:1904-1909` vs `template.html:2007` | Attach the still as the GIF, or tell the user the image will not be included |
| C3 | P1 | **Any website can send confessions from your visitors' IPs.** There is no `Origin`, `Referer` or `Sec-Fetch-Site` check on `/api/send`, and it accepts plain form posts. A third-party page can make every visitor silently submit anonymous mail, burning their rate-limit quota and distributing abuse across IPs your controls cannot see | `src/index.js:1391` | One header check against the site origin. ~15 min |
| C4 | P1 | **Rate limits are raceable.** Every limiter reads a KV counter, then writes back `value + 1`. Concurrent requests all read the same number and all pass. This applies to sends, the reply route, the relay ceiling, and admin login | `src/index.js:1473-1477`, `:1068-1074`, `:1326-1331` | KV cannot do atomic increments; a Durable Object or D1 `UPDATE ... RETURNING` can. Or accept it and document the ceiling as soft |
| C5 | P1 | **No timeout on any outbound call.** There is no `AbortController` or `AbortSignal` anywhere in the Worker. A hung Resend connection holds the user's request open until the platform kills it | `src/index.js:433` | `signal: AbortSignal.timeout(10000)`. ~5 min |
| C6 | P1 | **A failed email still leaves a stored message.** The row is inserted and the media uploaded at `:1496`, *then* Resend is called at `:1539`. On failure the user gets a 502 saying "try again" — and a retry writes a second row and a second set of R2 objects. If Resend actually accepted the mail but the response was lost, the retry sends a duplicate email | `src/index.js:1484-1567` | An idempotency key from the browser, checked on insert |
| C7 | P1 | **Orphaned media.** R2 uploads happen before the D1 insert with no cleanup on failure. A D1 error leaves files in R2 that nothing references and nothing ever deletes | `src/index.js:1486-1494` | Delete on insert failure, or a sweep job |
| C8 | P2 | **Delivery state is written non-atomically.** Both notifiers do a plain `writeFileSync` on their state file. A kill mid-write corrupts it. `loadSent()` uses a bare `JSON.parse`, so the next run *crashes* rather than re-sending — which is the safe direction — but `backoff.sh` then escalates to a 6-hour cooldown and the lane goes quiet. `tools/status.mjs:42` is the dangerous one: it swallows the parse error and reports every delivered message as "waiting" | `tools/instagram/notify.mjs:124`, `tools/whatsapp/notify.mjs:257` | Write to `.tmp`, then `renameSync`. ~10 min, fixes both |
| C9 | P2 | **No index on the handle/number lookup.** `SELECT DISTINCT to_handle, to_whatsapp FROM messages` scans the whole table. `events` and `visits` also grow forever with no retention policy | `src/index.js:1260`, `schema.sql:35-36` | Add an index; add a prune job |

### Where I corrected Sol

| Sol's claim | What is actually true |
|---|---|
| `BLOCK_SECRET` missing means HMAC runs with a zero-length key — implying forgeable tokens | I tested it: `crypto.subtle.importKey` **throws** `DataError: Zero-length key is not supported`. So it fails *closed* — those routes return 500. It is not a security hole. It **is** a real availability single point of failure: one secret signs admin sessions, IP hashes, block links, report links, reply links and view links. Rotating it silently invalidates every block link already sitting in people's inboxes — and the block link is this product's core abuse defence |
| The `/m` reply link is missing from Instagram/WhatsApp copy | The link is built correctly (`notify.mjs:167`, `:96`). The real hole is different and worse — see C1. Right instinct, wrong mechanism |
| The test suite is green and hides regressions | The suite is **red right now** and 6 of 8 suites never execute. Sol read the code but did not run it |

### Passed through on Sol's citation — not independently verified

Each has a `file:line` in `AUDIT-SOL.md`. I did not check these myself; treat them as leads.

- `P0` Inbound email relay can lose a reply silently: the `email()` handler catches and swallows, with no bounce and no retry (`src/index.js:1024-1045`)
- `P0` No database-schema gate before deploy: CI can ship an `INSERT` naming columns the live D1 lacks, taking `/api/send` down (`deploy.yml:48-69`)
- `P1` The action log records `delivered` when Resend merely returned HTTP success — bounces look green (`src/index.js:1558-1564`)
- `P1` The sender blocklist fails **open** on a D1 error — known abusers get through exactly when the safety database is unhealthy (`src/index.js:1448-1458`)
- `P1` A "block me everywhere" click can silently degrade to an email-only block while still claiming success (`src/index.js:1240-1268`)
- `P1` Cross-channel block poisoning: one message naming an unrelated email, handle and number lets one person's block permanently silence three strangers (`src/index.js:1248-1268`)
- `P1` A stalled send leaves the button on "Sending..." forever (`template.html:1979-2027`)
- `P1` A GIF render that never finishes leaves the UI stuck at "making your gif" (`template.html:1900-1926`)
- `P1` WhatsApp partial delivery restarts from bubble 1, duplicating the intro (`tools/whatsapp/notify.mjs:402-425`)
- `P1` `events-sync` can duplicate events when the D1 insert succeeds but the offset write fails (`tools/events-sync.mjs:59-70`)
- `P1` A stuck process makes `pgrep` suppress **all** future runs forever, with no timeout or escalation (`tools/events-sync.sh:17-23`)
- `P1` The post-deploy check only probes static GETs — D1, R2, admin auth and Resend can all be broken while CI calls the deploy healthy (`deploy.yml:70-87`)
- `P1` Resend error bodies are logged in full, potentially putting recipient data into Cloudflare logs (`src/index.js:442-446`)
- `P1` Two manual deploys from different refs can race and overwrite a newer build (`deploy.yml:12-22`)

---

## Part 4 — What is genuinely solid

Not padding; these needed no work and I want them left alone.

- **Admin authentication.** HMAC-signed cookie, constant-time compare, `HttpOnly; Secure; SameSite=Lax`, `Path=/admin`, login rate-limited, fails closed when the secret is absent. The CSRF reasoning is written down and correct.
- **The generated file is in sync.** `beatass.html` matches `template.html` byte-for-byte. The one rule most likely to be broken silently is not broken.
- **The abuse controls are real**, not decoration: block links act on POST specifically so corporate mail scanners cannot trigger them, and the reasoning is in a comment at `src/index.js:1199-1204`.
- **`/media/` is done properly**: key validated against a strict pattern, `immutable` caching, ETag, `noindex`.
- **The backoff library has its own test** (`tools/lib/backoff-test.sh`) including a control for the exact bug it was written to fix. That is the standard the rest of the suite should meet.
- **The queue state machine is well tested** — the tests prove a refused or private confession cannot be posted even by a crafted request.
- **Domain separation in the token scheme** (`view:`, `reply:`, `r:`, `ig:`, `wa:`, `admin:`) is textbook-correct.

---

## Part 5 — What to do, in order

Grouped by what each block buys you.

### Block A — turn the lights back on (30 minutes, today)

| # | Do | Why |
|---|---|---|
| 1 | `node tools/status.mjs stuck` | Find out how many real messages are stranded. Do this first — it may change your priorities |
| 2 | `launchctl enable gui/501/com.beatass.notify` (and the other five) | Restart delivery |
| 3 | `npx playwright install chromium` | Make your own tests runnable |
| 4 | Fix the 7 stale outreach assertions to read the config's flags | Unblock the other 6 suites, and defuse the CI landmine |
| 5 | Replace `&&` in the `test` script with a runner that runs all suites and reports a summary | One red suite must never hide seven green ones again |

### Block B — stop the silent failures (half a day)

| # | Do | Where |
|---|---|---|
| 6 | Make the watchdog independent of what it watches: alert if any lane has been quiet longer than N hours, and run it somewhere the disable switch cannot reach | new |
| 7 | Decide C1 — build the DM reply reader, or change the copy | `notify.mjs` both |
| 8 | Atomic state writes: `.tmp` + `renameSync` | both notifiers |
| 9 | Add the `pgrep` overlap guard to the Instagram lane | `auto-notify.sh` |
| 10 | Fix the still-image fallback so the picture is actually sent | `template.html:1904` |

### Block C — the cheap hardening (half a day)

| # | Do | Where |
|---|---|---|
| 11 | Preserve asset headers and status on `/` and 404 | `src/index.js:1577`, `:1586` |
| 12 | `AbortSignal.timeout()` on the Resend call | `src/index.js:433` |
| 13 | Origin check on `/api/send` | `src/index.js:1391` |
| 14 | Idempotency key on send, so a retry cannot duplicate | `src/index.js:1484` |
| 15 | Drop the per-call `CREATE TABLE`, run it as a migration | `src/index.js:496`, `:516` |

### Block D — the ones that need a decision from you, not a fix

- **C4, raceable rate limits.** The honest options are "accept it, it is a soft ceiling" or "move to a Durable Object". Both are defensible. This is a judgment call, not a bug fix.
- **S2, base64 fonts.** Splitting them out makes repeat visits much cheaper but breaks the single-file property. Only you know if that property still matters.
- **L7, the 1.1 GB repository.** Cleaning history is disruptive and irreversible. Worth doing once, deliberately, not as a side task.

---

## How to read the confidence of this report

- Everything in Part 1 and Part 2 I ran or measured myself today, with the command output above.
- Part 3 "Confirmed by me" I read in the actual source, and in three cases proved with a runnable test.
- Part 3 "Passed through" is Sol's work with line citations I did not open. High quality, but unverified.
- The corrections table exists because two agents disagreeing and then checking is the only reason those three errors did not reach you as fact.
