# HANDOFF — the self-healing bug loop

Written 2026-08-15. Read this first if you are picking this work up cold.

## What this is

A loop that turns "somebody hit a bug" into a written case, a verdict, a GitHub issue,
a fix with proof it works, and an email telling that person it is fixed — with a human
click at exactly two points.

Sanjay approved building it on **beatass** (not Game Night Owl, which was the
recommendation) because he wants the end-to-end demonstration on the real product.
Directed approval: `evolution/approved/2026-08-15-selfheal-poc-directed.md`.

## The three decisions already made — do not re-litigate

| Decision | Answer | Consequence |
|---|---|---|
| Which product | **beatass**, this venture only | Costs ~2h extra privacy hardening, already paid |
| Branch protection on `main` | **Deferred, explicitly last** | Safe now (drafts only). **Hard precondition before the fixer may open a real PR** — `main` auto-deploys on push |
| Two human gates | **Confirmed** | Publish issue, open PR. Both wait for him |

## Read these, in this order

1. `docs/SELFHEAL-EXPLAINER.html` — open in a browser. The loop as a story with diagrams,
   plus a full architecture report at the bottom. Best single orientation.
2. `PLAN-SELFHEAL.md` — the design, and the debate that shaped it.
3. `STABILITY-REPORT.md` — the separate audit of the existing product (4 P0s outstanding).
4. `PLAN-SELFHEAL-SOL.md` / `AUDIT-SOL.md` — GPT-5.6 Sol's raw second opinion.

---

## State: all 7 phases built

| Phase | What | Status | Proof |
|---|---|---|---|
| 1 | Capture layer, privacy-safe by construction | **BUILT** | 28 checks |
| 2 | The side sheet, picker, screenshot mode | **BUILT** | — |
| 3 | Wired into the page, lazy-loaded | **BUILT** | 29 checks |
| 4 | `/api/bug` intake + D1 case file | **BUILT** | 23 checks |
| 5 | Triage — the verdict gate | **BUILT** | 28 checks |
| 6 | Issue draft, human approval, the fixer's gate | **BUILT** | 45 checks |
| 7 | The four reporter emails | **BUILT** | 19 checks |

**172 automated checks pass.** Nothing sends email. Nothing touches GitHub. Nothing deploys.

### What "built" means for phases 5-7, precisely

- **Triage** decides and writes verdicts, using **the Claude Code installed on this laptop** —
  no API key, no per-call bill (Sanjay, 2026-08-15: "we dont want to use the extrernal AI apis").
  It is handed `--allowed-tools ""`, so the thing forming the opinion has no shell, no file
  access and no network. Anything it returns that is not usable JSON becomes `needs_human`.
- **prepare-issue** writes sanitised drafts to `content/bugs/drafts/`. It contains no GitHub
  call at all — asserted by a test.
- **approve-issue** is the only file that can publish. It asks a human, at a keyboard, for the
  literal word "yes", and re-runs the privacy gate on the exact bytes first.
- **fix.mjs** implements the red→green gate and the isolated worktree, and `--attempt` now hands
  the case to local Claude Code to write the failing check and the patch. That agent gets
  Read/Write/Edit/Glob/Grep and **no Bash**, so it cannot run, push or deploy anything — it
  writes files in a throwaway worktree and stops. Judging the result is `--prove`, which is this
  program, not the model. It is briefed from the **sanitised draft**, so the reporter's address,
  screenshots and raw bundle never reach it.
- **notify** renders all four emails, decides who is due what, and **can now send**, behind three
  locks: `--send`, `--i-mean-it`, and `RESEND_API_KEY` in the shell (that key lives in
  Cloudflare's secret store, not on this laptop, so no schedule can send by accident).
  `notified_at` is written only after Resend answers ok, so a failed send stays owed and is
  retried rather than being silently marked told.

## Files that are new or changed

```
bugreport/bugreport.js          707 ln  capture, scrub, picker, screenshot, sheet, submit
bugreport/bugreport.css         263 ln  sheet styling + the capture-time masking rules
bugreport/vendor-screenshot.js   21 KB  pre-built DOM rasteriser (modern-screenshot)
bugreport/test-privacy.mjs      207 ln  28 checks — redaction rules in plain node
bugreport/test-browser.mjs      218 ln  29 checks — real Chromium, hunts the actual bytes
bugreport/test-intake.mjs       162 ln  23 checks — real Worker on real local D1
migrations/005-bug-reports.sql   55 ln  the case-file table
docs/SELFHEAL-EXPLAINER.html            the explainer + architecture report
template.html                   MODIFIED  +3 KB always-on stub before </body>
build.py                        MODIFIED  copies the reporter into public/
src/index.js                    MODIFIED  + POST /api/bug, + BUG_* constants, json() takes headers
package.json                    MODIFIED  + 3 tests, + modern-screenshot devDep
evolution/approved/2026-08-15-selfheal-poc-directed.md   NEW
```

## How to run it

```bash
cd ~/Claude/Projects/banyan/ventures/beatass
python3 build.py
npx wrangler d1 execute beatass-db --local --file migrations/005-bug-reports.sql
npx wrangler dev --local --port 8899 --var BLOCK_SECRET:local-dev-secret
# open http://127.0.0.1:8899 — button is bottom right
```

Read reports back:
```bash
npx wrangler d1 execute beatass-db --local --command \
  "SELECT id, state, kind, note FROM bug_reports ORDER BY ts DESC LIMIT 5"
```

Tests:
```bash
node bugreport/test-privacy.mjs && node bugreport/test-browser.mjs && node bugreport/test-intake.mjs
```

---

## The four things that will bite you if you do not know them

### 1. Pattern-based redaction cannot protect a confession
Emails and phone numbers have a shape a regex can find. A confession is ordinary prose and has
none. The moment any code does `console.error('failed: ' + message)` the whole thing lands in a
log line no pattern would catch.

So `clean()` does **two** passes and the first one matters more: it scrubs the *live values* of
six named fields (`#i-msg #i-email #i-handle #i-wa #i-sender #i-name`) by exact match, then runs
patterns. We do not try to recognise the secret; we already know it is whatever sits in those
boxes right now.

**The unit tests were fully green when the browser test caught this.** That is why both exist.

### 2. A screenshot cannot be fixed by scrubbing text
Once the page is pixels, nothing can reach into it. The masking happens to the **page**:
`data-capturing` goes on `<html>`, the stylesheet hatches out the private fields, we wait **two
animation frames** for that to actually paint, and only then rasterise. Rasterising in the same
frame photographs the page as it looked *before* the mask landed.

### 3. On beatass, a URL is a password
`/m?id=..&t=..` is protected by nothing but the token in its own address bar, and it never
expires. So captured URLs are **path only, query always dropped**. Same for `/block` and `/reply`.
This is also why bug reports must never become public GitHub issues verbatim — the repo
`github.com/luv-jeri/beatass` is **public**.

### 4. The reporter is OFF on `/m` and `/admin`
Those two pages render other people's messages. `pageKind()` returns `private` / `admin` and the
module refuses to arm. A button that is not there cannot be misused.

---

## The loop, command by command

```bash
# 1. somebody files a report in the browser        -> state: received
# 2. decide what it is                              -> triaged | dismissed
node tools/selfheal/triage.mjs --dry --local        # look first
node tools/selfheal/triage.mjs --local              # then write verdicts

# 3. draft a public-safe issue                      -> issue_ready
node tools/selfheal/prepare-issue.mjs --local

# 4. GATE 1 — a human publishes it                  -> issue_open
node tools/selfheal/approve-issue.mjs <case-id> --show --local   # read it
node tools/selfheal/approve-issue.mjs <case-id> --local          # asks "yes"

# 5. fix it, in a throwaway worktree
node tools/selfheal/fix.mjs <case-id> --start
node tools/selfheal/fix.mjs <case-id> --attempt     # local Claude Code writes check + fix
node tools/selfheal/fix.mjs <case-id> --prove       # red -> green -> suite green
#    a failed gate writes .gate-failed.txt, and --attempt reads it, so run 2 is told why
node tools/selfheal/fix.mjs <case-id> --pr          # renders a DRAFT only

# 6. GATE 2 — a human opens the PR (command is printed by --pr)

# 7. tell the reporter
node tools/selfheal/notify.mjs --dry --local
```

## Where to pick up

The loop is complete: every stage runs, and the thinking at both stages that need it runs on the
Claude Code already installed here. Two things are still open, and both are deliberate.

1. **Branch protection on `main` is still off.** Sanjay deferred it as the last step. It is a
   hard precondition before the fixer's lane may open a real PR, because a push to `main`
   auto-deploys. Until it is on, `--pr` renders a draft and prints the command rather than
   running it.
2. **`shipped_sha` is never set by anything.** So no case can reach `fixed`, and no reporter can
   be told their bug is live. That is correct as it stands — it should only be set by something
   that has confirmed the deployed commit actually answering on the real site, and nothing does
   that yet. This is the last honest gap in the loop.

Two commands that need a human, and cannot be run from an agent session:

```bash
npx wrangler login            # the auth token has expired; nothing --remote works without it
gh api -X PUT repos/luv-jeri/beatass/branches/main/protection ...   # only when Sanjay says so
```

## Outstanding, from the separate stability audit

Not part of this loop, but live problems on the product:

- **Delivery is dead behind TWO locks, not one.** All six launchd jobs are disabled (six plists
  exist in `~/Library/LaunchAgents/`, `launchctl list` shows zero of them loaded), *and*
  wrangler's auth token has expired — so `wrangler d1 ... --remote` cannot reach the real
  database at all. Both delivery jobs (`tools/instagram/notify.mjs:86`,
  `tools/whatsapp/notify.mjs`) read the live database that way, so re-enabling the jobs on its
  own would only produce six failing runs. Order: `npx wrangler login` in a real terminal first,
  then load the jobs.
  `node tools/status.mjs stuck` also hits `--remote` and fails for the same reason; add
  `--local` and you are reading seeded dev data, not the real backlog.
- ~~`npm test` halts at the outreach selftest~~ **FIXED 2026-08-15.** The seven assertions were
  reading a business setting as if it were the logic under test: they called `outreachPlan` with
  no config, so they inherited the live one, and when outreach was switched off on 2026-08-07
  they went red and took the six suites behind them down. They now pass an explicit config, plus
  one new test that asserts the live switches are *obeyed* — true whichever way they are set.
- ~~`/m` reply promise~~ **FIXED 2026-08-15, and this one changed what recipients read.** The
  Instagram and WhatsApp messages said "reply right here if you want to answer them". Nothing on
  our side has ever read those replies — only the email lane has an inbound handler
  (`src/index.js:942`). They now say we cannot carry a reply back. Nothing was sending at the
  time (outreach off, all six jobs disabled), so no live behaviour changed on the day.
  **If Sanjay wants a real reply route instead of honest copy, this is the line to revert.**

## House rules that constrain any change here

- Edit `template.html`, never `beatass.html`. Run `python3 build.py` after.
- Plain HTML/CSS/JS. No framework, no bundler in the shipped page. `vendor-screenshot.js` is
  committed pre-built for exactly this reason.
- No emoji as icons. Inline SVG only.
- Nothing outward — deploy, publish, email a real person, merge — without Sanjay's yes.
- Run `npm test` (or at minimum the three bugreport suites) before calling anything done.
