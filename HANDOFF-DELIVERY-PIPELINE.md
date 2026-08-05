# beatass — delivery pipeline handoff (written 2026-08-05, ~02:30 IST)

Read this to continue the **message-delivery** work (email / Instagram DM /
WhatsApp) in a fresh session. The reels/marketing track has its own handoff
(`HANDOFF-NEXT-SESSION.md`) and its own parallel session — do not confuse the
two.

---

## The one-line status

WhatsApp delivery is live and working; the Instagram DM pipeline was hardened
tonight after a real message (Harsh) was half-delivered; both lanes now log
every step and an hourly watchdog reports trouble. Next session is about making
that logging + retry a proper, script-driven backbone — not something an AI has
to babysit.

## What is live right now

| Piece | State |
|---|---|
| WhatsApp field on beatass.com | live (deployed, migration `003` applied to prod DB) |
| WhatsApp sender + 60s timer | armed (`com.beatass.whatsapp`) |
| Instagram DM sender + 2min timer | armed (`com.beatass.notify`), hardened tonight |
| Email delivery | unchanged, working |
| Hourly log watchdog | armed (`com.beatass.logcheck`), fires a Mac notification on trouble |
| Insights + health timers | armed (`com.beatass.insights`, `com.beatass.health`) |
| Git | all delivery commits pushed (HEAD = origin/main); nothing of ours unpushed |

Verified live tonight: Harsh's DM resumed and completed all 3 bubbles, he was
followed and commented on. 3 real recipients delivered on WhatsApp (Priyanshu,
Upend, abhay), 1 dead number given up after 3 tries.

---

## THE NEXT-SESSION MISSION (Sanjay's words, 2026-08-05)

> "we will be checking the current logs, we want to log and get all the data and
> store it properly. we need to have fallback retry - tracking each pipeline like
> sending message on instagram. we need to log each and everything, done with
> scripts and all instead of just AI, so that we can retry and fix issues."

Translated into concrete work:

1. **Start by reading the logs.** `node tools/log-check.mjs --hours 24` and read
   `~/.config/beatass-logs/report.txt`. See what actually went wrong overnight
   before building anything.
2. **Log and store ALL delivery data properly** — not scattered JSON files.
   Every attempt on every channel: who, when, which step, outcome, error, retry
   count, device/context info. Likely a single store (a D1 table or one JSONL
   the scripts own), queryable, so "what happened to message X?" is one command.
3. **Per-pipeline fallback + retry as a first-class thing**, script-driven.
   Tonight's `entryState` / `recordPartial` / `recordFailure` are the seed of
   this but they live inside each notifier. Lift retry/fallback into something
   shared the scripts drive, so a stuck message is retried and reported without
   an AI in the loop.
4. **Make it debuggable by a human with scripts**, not by asking the AI. A
   `status` command per message id; a `retry <id>` command; a `stuck` report.

The philosophy Sanjay is pushing: the machine should log enough, and retry
reliably enough, that fixing an issue is reading a file and running a script —
never "ask Claude to go look."

---

## THE WHITEBOARD BACKLOG (photo 2026-08-05)

Fix these in the new session. Item 1 has one word I could not read — **Sanjay to
confirm** (see note).

1. **Log and track all the data (device info) → `[?]` compliant log.**
   ⚠️ The word before "compliant" is unread — looks like "Hinna"/"Hina".
   Likely a compliance regime (GDPR? India's DPDP?) or a name. CONFIRM before
   building. This is the same as mission item 2 above: capture device/context
   info with each message, stored in a compliant way.
2. **Fallback and retry for messages.** = mission item 3.
3. **Make pipelines robust → log each pipeline.** = mission items 2–4. Started
   tonight (event logs per lane); needs to become the real backbone.
4. **Change the template of the email, insta, and WhatsApp message.** Copy/design
   refresh across all three channels. WhatsApp copy was just reworked with emoji
   + bold (2026-08-05); email + insta DM still on older wording.
5. **Redesign the "add a reply email" step (people are missing it) → remove the
   checkbox.** On the send form, the sender's own reply-email is being missed.
   Make it more prominent and drop the checkbox gating it. Touches
   `template.html` (the `#f-sender` field) — rebuild with `build.py` after.
6. **Create a conversation feature for reply.** Today a reply relays one email to
   the sender (`/reply` route in `src/index.js`). Sanjay wants a back-and-forth
   thread, not a one-shot relay.
7. **Fix favicon and `<title>` of the web app as they appear in Google search.**
   SEO/branding polish. Check `template.html` `<head>`, `og.png`, and the
   built `public/` output; verify what Google actually renders.

---

## HOW THE PIPELINES WORK TODAY (so you don't rebuild what exists)

### The shared shape (both DM lanes)

A message is written to the D1 database by the website with no delivery. A
laptop timer picks it up, opens a real logged-in browser, and sends. State per
message lives in a JSON log **outside the repo** (it names people):

- Instagram: `~/.config/beatass-instagram/.notified.json`
- WhatsApp: `~/.config/beatass-whatsapp/.wa-notified.json`

Each entry is one of three things, decoded by a **pure** function so the
selftest can prove it with no browser:

| Log entry | Meaning |
|---|---|
| absent | never tried → waiting |
| a date string | fully delivered → never again |
| `{partial, attempts, reason, last}` | half-done / failed → resume or give up |

- Instagram: `entryState(entry)` in `tools/instagram/notify.mjs` → `{kind, startAt}`
  where kind ∈ waiting/resume/done/gaveup. `MAX_TRIES = 3`.
- WhatsApp: `stillWaiting(entry)` + `deadKey(number)` in `tools/whatsapp/notify.mjs`.
  A number WhatsApp rejects is remembered **hashed** so the same wrong number is
  not retried; `MAX_TRIES = 3`.

### Instagram DM lane (`tools/instagram/`)

- `notify.mjs` — decides who is waiting, delivers 3 bubbles (intro / confession /
  link+optout), runs outreach. **Hardened tonight:** resumes a half-sent DM at
  the exact bubble that failed; `sendBubble()` proves each send by watching the
  composer empty (a click can time out *after* it worked — that was Harsh's bug);
  outreach runs in its own try so a DM error can't skip follow+comment.
- `ig-dm.mjs` — the low-level browser helpers (openThread, typeDm, clearBox).
- `outreach.mjs` — follow + comment on latest post; keeps its own per-handle
  record `.outreach.json`; has a cool-off state when Instagram limits us.
- `auto-notify.sh` + `com.beatass.notify.plist` — the 2-minute timer.
- `insights.mjs` / `health.mjs` — read-only scrapers on their own timers.

### WhatsApp lane (`tools/whatsapp/`)

- `notify.mjs` — same shape as IG. India only; `waNumber()` cleans to `+91…`.
- `wa-send.mjs` — browser half. **Every selector was read off the live page**
  (see the comment block); runs **visible even when unattended** because
  WhatsApp Web will not restore a login headless (tested twice).
- `login.mjs` — one-time QR link. Session in `~/.config/beatass-whatsapp/`.
- `auto-whatsapp.sh` + `com.beatass.whatsapp.plist` — the 60-second timer.
- Account guard checks the **profile name** (`Beat Ass`) from Settings, because
  WhatsApp Web never prints the phone number anywhere.

### The new logging spine (tonight, the seed to build on)

- `tools/events.mjs` — `logEvent(lane, {...})` appends one JSON line to
  `~/.config/beatass-<lane>/events.jsonl`. Both notifiers call it on every step
  (attempt, bubble-sent, delivered, partial, gave-up, undeliverable, skip,
  outreach, outreach-failed). Numbers are masked before logging.
- `tools/log-check.mjs` + `com.beatass.logcheck.plist` — reads both lanes'
  events + auto.logs each hour, flags trouble, writes
  `~/.config/beatass-logs/report.txt`, fires a Mac notification. **Read-only.**

**This is exactly what the mission wants to grow up.** Next session: decide
whether to promote `events.jsonl` into the D1 database (one `deliveries` table)
so it is queryable and backed up, and add `status <id>` / `retry <id>` /
`stuck` commands.

---

## THE DATA MODEL (D1, live)

`messages` table (`schema.sql`) now has, added across migrations:
`to_email`, `to_handle`, `to_whatsapp`, `view_token`, `share_ok`, `score`,
`post_state`, etc. `blocklist` keys: raw email, `ig:<handle>`, `wa:<+number>` —
an email block sweeps carried handles + numbers too. There is **no delivery-log
table yet** — that is the likely next migration (mission item 2).

---

## GOTCHAS THAT COST TIME TONIGHT (do not relearn these)

- **A click can time out after it worked.** Never trust `click()` as proof a
  message sent — check the state change (composer emptied). This bit both a DM
  send and is now guarded in `sendBubble()`.
- **Unbounded retry + a short timer = a browser window every minute forever.**
  One wrong WhatsApp number did this ~7× before it was caught. Everything that
  can fail needs a try ceiling AND to remember the *target* (number/handle), not
  just the message, or a re-typed bad target loops again.
- **Headless WhatsApp Web does not restore a login.** The timer must run visible.
- **Scripts outside the repo can't `import 'playwright'`** — use
  `createRequire(<repo>/package.json)`.
- **macOS `sleep` is blocked in the shell tool** — use `until <cond>; do sleep`.
- **Two runs of the same lane fight over the session folder** — the loser gets a
  blank "not signed in" profile. The `.sh` runners guard with `pgrep`.
- **A parallel marketing session edits this repo too.** Tonight it left
  `tools/instagram/config.json` uncommitted (a bio change + whitespace reformat)
  — that's theirs, leave it. Always `git status` at session start (G4).

---

## OPEN / WAITING ON SANJAY

1. **The unread whiteboard word in item 1** — confirm it.
2. **Instagram profile / WhatsApp business profile copy** — Sanjay was going to
   set the WhatsApp business profile on his phone (About / Description / Greeting
   are in `WHATSAPP.md` and `WHATSAPP-SETUP-STEPS.txt`, both paste-ready). Not
   confirmed done. The greeting message is the anti-block piece.
3. **Ratings** — a couple of deliveries this session are unrated in
   `memory/feedback.md`.

## FILE MAP (delivery only)

- Site + API + all routes: `src/index.js` (send, block, report, reply, /m, admin)
- The form: `template.html` (edit here, never `beatass.html`; run `build.py`)
- DB: `schema.sql`, `migrations/00N-*.sql`
- Instagram: `tools/instagram/*`
- WhatsApp: `tools/whatsapp/*` + `WHATSAPP.md` + `WHATSAPP-SETUP-STEPS.txt`
- Logging spine: `tools/events.mjs`, `tools/log-check.mjs`
- Feature plan: `docs/WHATSAPP-FEATURE.md`
- Tests: `npm test` (dm 36, whatsapp 62, + relay/classify/sound/queue/browser)

## FIRST FIVE MINUTES OF THE NEXT SESSION

```
git status                                  # G4 — is the tree clean?
git log --oneline -8                         # what landed since
node tools/log-check.mjs --hours 24          # what broke overnight
cat ~/.config/beatass-logs/report.txt
launchctl list | grep beatass                # are all 5 timers loaded?
```
Then confirm the whiteboard word, and start with mission item 1 (read logs) →
item 2 (proper data store) before writing any new feature.
