# Self-healing bug loop — the plan

Date: 2026-08-15
Written by SahaJiv (Claude Opus 5), debated against GPT-5.6 Sol at xhigh effort. Sol's full argument is in `PLAN-SELFHEAL-SOL.md`; where it changed my mind, I say so.

---

## The headline: you have already built most of this

Before any design talk. I went and looked at the Tool Factory venture, and the loop you described is roughly **60% built and tested already**.

| Piece of your plan | Status | Where |
|---|---|---|
| Console capture, ring buffer | **Built + tested** | `packages/bug-capture/src/ring-buffer.ts` |
| Network call capture, tokens stripped | **Built + tested** | `.../network.ts` (141 lines) |
| Click trail | **Built + tested** | `.../clicks.ts` |
| Point at an element | **Built** | `.../picker.ts` (190 lines) |
| Drag-to-select screenshot | **Built** | `.../region.ts` (167 lines) |
| Full screenshot | **Built** | `.../screenshot.ts` |
| Bundle with a 512 KB ceiling that degrades gracefully | **Built + tested** | `.../bundle.ts` |
| The side sheet UI with problem-type dropdown | **Built** | `gamenightowl/src/components/BugWidget.astro` (545 lines) |
| Bot protection (Turnstile) | **Built** | same file, 14 references |
| Receiving endpoint + validation | **Built + tested** | `worker/src/intake.ts`, `validate.ts`, `turnstile.ts` |
| Database table for reports, with a `status` column | **Built** | `worker/schema.sql` — table `bugs` |
| Screenshot storage | **Built** | `worker/src/storage.ts` |
| **The four reply emails you described** | **Built** | `worker/src/email.ts` — `received`, `analyzed_bug`, `analyzed_not_bug`, `fixed` |

That last row is the striking one. You described four replies to the user; that file already has exactly those four, already written.

**What genuinely does not exist yet** is the back half: the AI triage that decides which of the four applies, the GitHub issue creation, the fixer, the proof that a fix is real, and the notification when it ships.

So the honest framing is not "build a self-healing system." It is **"finish the second half of a system you already started, and connect it."**

---

## Three things that change the design, which I verified today

### 1. Your GitHub repository is public

```
gh repo view luv-jeri/beatass --json visibility
  { "visibility": "PUBLIC", "isPrivate": false }
```

Your plan says the laptop script converts each report into a GitHub issue. On a public repository, that publishes to the open internet: the reporter's console logs, the URLs they were on, their screenshots, and their contact address.

### 2. On beatass specifically, a URL *is* a password

`src/index.js:1358` — the `/m` page is protected by nothing but the token in its own address bar:

```
/m?id=<message id>&t=<view token>
```

Anyone holding that URL can read that private confession, forever — there is no expiry. The capture package records `location.href` (`bug-capture/src/index.ts:42`). So a recipient filing a bug report from the page where they are reading their confession would attach a permanent key to it. Publishing that to a public issue publishes the confession.

The same is true of `/block?e=<their raw email>&t=...` and `/reply?id=..&t=..`.

**This is not a footnote. It rules out the literal version of your plan on this product.** Sol reached the same conclusion independently and put it more bluntly: a public repository must never receive raw reports, screenshots, reporter contact, signed `/m` URLs, or confession text.

### 3. `main` has no branch protection, and pushing to it deploys

```
gh api repos/luv-jeri/beatass/branches/main/protection
  404 Branch not protected
```

`.github/workflows/deploy.yml:64` deploys on any push to `main` that passes tests. So the rule "an agent never merges" is currently held up by convention alone. If an agent PR ever gets merged, it ships to production the same minute. Before any auto-fixer exists, `main` needs protection. That is a 5-minute settings change and it is a precondition, not a nice-to-have.

---

## Where Sol changed my mind

I went in with eight positions and argued them. Sol beat me on three.

**1. My "path allowlist" cage was false security.** I proposed restricting the fixer to an allowlist of files. Sol pointed out this is meaningless in a monolith: `src/index.js` is one file containing intake, outbound email, admin authentication, private message views and the blocking logic. Allow it and the agent can change anything that matters; deny it and the agent can fix almost no real Worker bug. Same for `template.html`, which is the entire client.

The right cage is **capability separation, not path separation**: the triage process runs read-only with no GitHub, mail or deploy ability; the fixer runs only when you invoke it, in an isolated worktree, with no secrets, no push, no merge, no deploy; a separate verifier decides pass/fail from command output, not from the fixer's own description of its work. Paths still matter — touching `.dev.vars*`, `wrangler.jsonc`, delivery tools or auth code should force human review — but as a *risk flag*, not as the boundary. I concede this fully; Sol's version is better.

**2. My "no reproduction, no fix" gate was too literal.** I said the agent must reproduce the bug or not touch it. Sol's correction: some real bugs cannot be interactively reproduced — a device-specific crash, a transient Worker exception, a race — yet can still be proven by a versioned stack signature plus a deterministic fixture. Meanwhile "clicking around until something looks similar" is not proof even though it looks like reproduction.

The gate should be **"no pre-fix failure evidence, no PR"**, accepting any one of: a failing unit or contract test, a deterministic fixture derived from the captured signature, or a demonstrated failing code path. All three then require the identical test to pass after the patch, plus the full suite green. If none can be produced, the agent may investigate and write a diagnostic note, but may not open a PR. This is stricter where it counts and less ritualistic. Adopted.

**3. Masking text inputs is not enough.** I said mask `<input>` and `<textarea>` so the confession is not recorded. Sol listed everything that leaves through anyway: the rendered preview text, the URL token, the canvas and media, the text of a picked element, click labels, console arguments, request URLs, and — on `/admin` — whole table cells containing other people's messages and contacts.

Its conclusion, which I now agree with: **drop DOM and session replay from the POC entirely.** Replace your "last 1 minute recording" with a 60-second *diagnostic timeline* — sanitized error codes, allowlisted route templates, status classes, duration buckets, element identifiers with no text. You keep almost all the debugging value and remove the entire class of leak.

### And one thing we both flagged that overrides part of your plan

Under Banyan's outward law, **creating a GitHub issue and opening a pull request are outward actions.** Your plan has a script doing both unattended. Sol named this directly and it is correct: the autonomous lane can receive, triage, reproduce and *prepare* an issue or a patch, but publishing the issue and opening the PR need your yes.

In practice this costs you very little. The agent does all the work and leaves a ready-to-fire draft; you click once. What it buys is that no machine can ever publish something about a user, in your name, that you have not seen.

### Where I held my position and Sol agreed

- Email is the notification channel, never the data channel. The bundle goes by direct POST to the Worker; email carries a pointer.
- Cookies are never attached. (Sol added the mechanical detail that your admin cookie is `HttpOnly` so JavaScript cannot read it anyway — and extended the ban to `localStorage`, `sessionStorage`, IndexedDB and service-worker caches, which I had not covered.)
- Feature requests never enter the fixer. Sol refined this usefully: they should enter the *same intake* — a user saying "I can't find X" may be reporting a real discoverability defect — and split *after* triage into a human-only review queue.

---

## The architecture

```
BROWSER                    WORKER                  LAPTOP (caged)              YOU
                                                
[Report bug] button
      |
   side sheet
   - point at element
   - screenshot (explicit)
   - describe it
   - reply address (optional)
      |
  capture, masked at source
  60s diagnostic timeline
      |
      +--- POST /api/bug ---> verify Turnstile
                              size + schema checks
                              rate limit
                              |
                              +-> D1  bug_reports (metadata + state)
                              +-> R2  private evidence (sanitized)
                              |
                              +-- email you: "new report" + link
                              +-- reply to user: "we got it"
                                        |
                                   watcher polls
                                        |
                                   AI TRIAGE (read-only, no write powers)
                                        |
                    +-------------------+-------------------+
                    |                   |                   |
               real_bug           not_a_bug /          feature_request
                    |             cache_cookie              |
                    |                   |                   |
             prepare issue        reply with the       human review
             DRAFT                 actual fix           queue
                    |                   |
                    v                   v
            [ YOU APPROVE ] <---------- (auto-reply allowed:
                    |                    fixed product copy only,
              gh issue create            never attacker text)
                    |
              FIXER (isolated worktree, no secrets,
                     no push, no merge, no deploy)
                    |
              pre-fix failure evidence  --- none? --> diagnostic note, stop
                    |
              patch -> test goes green -> npm test green
                    |
            [ YOU APPROVE ] --> draft PR --> you review --> you merge
                    |
              deploy (existing CI)
                    |
              version.json proves it is LIVE
                    |
              reply to user: "fixed"
```

Two human gates, both one click: **publish the issue**, and **open the PR**. Everything between them is automatic.

---

## The privacy model

The rule is: **mask at capture time, not at send time.** Anything masked only before sending has already existed in memory in a form that a bug in the masker can leak.

| Data | On `/` (the app) | On `/m` (private confession) | On `/admin` |
|---|---|---|---|
| Confession text | never captured | never captured | never captured |
| Recipient email / handle / number | never captured | never captured | never captured |
| Full URL | path only, query dropped | **path only — the token must never leave** | path only |
| Screenshots | only if the user explicitly takes one | **disabled** | **disabled** |
| Element picker | selector + tag + size, no text | selector only | disabled |
| Console logs | messages, with emails and long tokens stripped | same | disabled |
| Network | method, route template, status class, duration bucket | same | disabled |
| Cookies / localStorage / sessionStorage / IndexedDB | **never, in any form** | never | never |
| Memory | a coarse `performance.memory` bucket if present, nothing else | same | never |
| Reporter's reply address | captured, because they typed it on purpose | same | same |

The whole widget is **off on `/admin`**. If you hit a bug on the dashboard you file it by hand — you are the only person who uses that page, and it is the one page that shows every message in the database.

The acceptance test for this is a **canary test**: type a unique nonsense string into the confession box, file a report, and assert that string appears nowhere in the JSON, nowhere in the multipart body, and nowhere in the screenshot pixels. If a canary escapes, the build fails. Sol proposed this and it is the right shape — the privacy claim becomes something a machine checks on every commit, not something we promise.

---

## How triage decides

Five verdicts, each needing different evidence:

| Verdict | What it needs | What the user gets |
|---|---|---|
| `real_bug` | a failure signature: an error, a bad status, or a described behaviour that contradicts a known contract | "Noted, we're on it, we'll tell you when it ships" |
| `user_error` | the described behaviour matches how the app is supposed to work | a reply explaining how to do the thing |
| `cache_cookie` | works in a fresh isolated context, fails in theirs | "Try a hard refresh" + exact steps |
| `feature_request` | asks for behaviour that does not exist | goes to your review queue, no auto-reply promise |
| `needs_human` | **anything the model is not confident about** | "Noted", and it waits for you |

Two guards that matter more than the taxonomy:

- **Fail closed on malformed output.** If the model returns anything that does not parse against the schema, the verdict is `needs_human`. Never a guess.
- **The dangerous failure is a confident `user_error` on a real bug** — you tell a user "that's not a bug" and close it, and they never report anything again. Guard: `user_error` and `cache_cookie` are the only verdicts that produce a dismissive reply, so they need the *highest* confidence bar, and every one of them gets logged for you to skim. If in doubt it goes to `needs_human`, which costs you thirty seconds and costs the user nothing.

And Sol's note on wording, which I am adopting: your original taxonomy included "malicious, stupid, or irrelevant." Use `abuse`, `unactionable`, `duplicate`, `out_of_scope` in the data. Never store or send a word that insults the reporter — that text has a way of ending up in front of them.

---

## The POC — and my main recommendation about it

Sol scoped an 8-hour POC on beatass. I think that is the right size but **the wrong product**.

**Build the POC on Game Night Owl, not beatass.**

| | Game Night Owl | beatass |
|---|---|---|
| Capture widget | already shipped and working | needs porting into a no-bundler page |
| Intake worker | already built + tested | needs writing |
| Privacy risk of a captured bug report | a wrong word in a charades game | someone's private confession + a permanent link to it |
| What the POC proves | the loop works | the loop works, if you survive the privacy work first |

Doing it on Game Night Owl means the one-day POC spends its day on **the part that does not exist yet** — triage, issue, fixer, proof, notify — instead of re-litigating the part that already works. You prove the loop on a product where a mistake is embarrassing rather than harmful. Then you port a proven loop to beatass, where the privacy work gets the attention it deserves as its own phase.

If you want it on beatass regardless, it is doable — the privacy hardening is roughly the first two hours of Sol's plan — but you are paying that cost to learn something you could learn for free.

### The one-day POC (either product)

One tracer bug, end to end, nothing real going outward:

| Hour | What |
|---|---|
| 1 | Seed one deterministic bug. Wire the existing widget to a local intake |
| 2 | Report lands in D1 with state `received`; evidence in R2; canary test passes |
| 3 | Triage adapter returns `real_bug` against a fixed schema. Recorded fixture, no live model needed — this proves the *interface*, not model quality |
| 4 | It writes an issue **draft** to disk. Nothing published |
| 5-6 | Fixer, in an isolated worktree: generates a test that goes red on the current build, patches, test goes green, `npm test` green |
| 7 | Renders draft PR, draft status page, draft reply email. All inspectable, none sent |
| 8 | Acceptance: one command proves — no canary escaped, a duplicate submit makes one report, every state transition was legal, the test was red before and green after, and every outward artifact is a draft |

**What the POC deliberately does not do:** no real email to anyone, no real GitHub issue, no real PR, no deploy, no scheduling, no live model, no `/m` or `/admin` capture, no replay, no cookies.

**The signal it gives you:** if that one command passes, the loop is real and the remaining work is volume, not invention. If it fails, you found out in a day.

### After the POC

Sol estimates ~45 hours to production, dominated by privacy tests and the fact that the Worker is one large file. I think that is honest and I would not sell you a smaller number. But note the sequencing: **you get value long before hour 45.** A working intake + triage + "we got your report" reply — no fixer at all — is roughly the first 12 hours, and on its own it is a real product improvement.

---

## Risks, and how each one is switched off

| Risk | Detection | Kill switch |
|---|---|---|
| A privacy canary escapes | canary test in CI | intake disabled by a flag; new reports quarantined |
| Triage confidently dismisses a real bug | every dismissive verdict logged for your review | flip triage to `needs_human` for everything |
| The fixer produces plausible wrong patches | it cannot open a PR without red-to-green proof | it has no push, no merge, no deploy — worst case is a bad draft nobody merges |
| Bug reports become a spam channel | Turnstile + rate limit + report volume alarm | disable the endpoint; the button is one build away from gone |
| The reply email is used to harass someone | no attacker-supplied text ever goes in an email; fixed product copy only | stop outbound replies, keep intake |
| Model costs run away | per-report cost logged | hard monthly ceiling; triage falls back to `needs_human`, which costs nothing |
| An agent PR gets merged and auto-deploys | — | **branch protection on `main`, before any of this is built** |

---

## Decisions — answered 2026-08-15

Logged as a directed approval in `evolution/approved/2026-08-15-selfheal-poc-directed.md`.

| Decision | Answer |
|---|---|
| A. Which product | **beatass**, end to end, this venture only. My Game Night Owl recommendation was overridden deliberately — he wants the demonstration on the real product |
| B. Branch protection on `main` | **Deferred to last.** Safe for the POC, which produces only drafts. Becomes a hard precondition before the fixer lane opens a real PR, because `main` auto-deploys on push |
| C. Two human gates | **Confirmed.** Publish issue, open PR |

Because the POC now runs on beatass, **the privacy canary test moves to the front**: it is gate zero, not a late acceptance check. The plan below is otherwise unchanged.
