# Self-healing bug loop POC

Assumptions: this is a design and build plan, not authority to deploy, send email, call GitHub, invoke a paid model, or edit product code. The current worktree is dirty; citations describe the current files, including the uncommitted `src/index.js`, and do not claim `HEAD` behavior. `packages/bug-capture/...` below means `~/Claude/Projects/Online Web Apps/packages/bug-capture/...`. External-service and model-cost claims are labelled `[from-memory — verify]` because this run has no live web access.

## Where I disagree

1. **"Auto-fix is the easy half" is false on this codebase.** Triage and verification are the bottleneck, but that does not make the fixer easy. The editable frontend is one 2,113-line `template.html`; backend routing, email, admin authentication, delivery and storage share one 1,590-line `src/index.js`. A one-line UI symptom can cross build output, Worker behavior and Playwright. Even the reusable capture package is not drop-in: it exports raw TypeScript, has two runtime dependencies and has no build script or emitted artifact (`packages/bug-capture/package.json:5-20`; `packages/bug-capture/tsconfig.json:3-13`). The correct claim is: code generation is not the bottleneck, and neither triage nor patching is trustworthy without narrow evidence and verification.

2. **A failing test is the preferred reproduction, not the only admissible pre-fix proof.** The reviewer is right that a raw report must never trigger a guessed fix. The absolute rule still fails for intermittent browser/provider faults and demonstrated privacy or invariant violations. A fix lane may start from either (a) a test that fails on the reported/deployed base SHA or (b) a deterministic invariant/diagnostic that proves the old behavior wrong, followed by a regression test. If neither exists, there is no fix. A non-reproduced report may produce a diagnostic proposal or human escalation, never a PR described as a fix. This repo already tests the built page and its real multipart contract rather than trusting source inspection (`test.mjs:7-11`, `test.mjs:77-95`, `test.mjs:249-264`).

3. **Direct POST is right; "already-authenticated infrastructure" is wrong.** `/api/send` is public. It has input checks, a sender blocklist and an IP-hash/KV rate limit, not reporter authentication (`src/index.js:1390-1477`). Only `/admin*` has an HMAC session (`src/index.js:469-486`, `src/index.js:1062-1127`). `@gno/bug-capture` already posts multipart directly and appends a Turnstile token, but it neither adds the HMAC its comment promises nor verifies an HTTP success (`packages/bug-capture/src/transport.ts:5-23`). The data path should be browser -> `POST /api/bug` -> D1/private R2. Email is notification only. The new public route still needs server-side Turnstile verification `[from-memory — verify]`, strict byte limits, idempotency and its own rate prefix.

4. **"Cookie names and flags at most" is still too permissive and partly impossible.** Capture no cookie inventory at all. Ordinary page JavaScript cannot read `HttpOnly` cookies or their flags `[from-memory — verify]`; BeatAss already sets the admin cookie `HttpOnly; Secure; SameSite=Lax` (`src/index.js:1093-1099`). Names also reveal internal state without helping reproduction. Record only a coarse `cookieEnabled` boolean when relevant. Never record values, names, headers or storage contents.

5. **Masking inputs and textareas does not make replay safe.** It misses the copied confession and destination in the preview (`template.html:1930-1954`), the private confession rendered as ordinary text on `/m` (`src/index.js:1351-1387`), every confession and identity-adjacent field in `/admin` (`src/index.js:731-755`), click labels, selected-element labels, full URLs, console strings and pixels. The existing package rasterizes `document.body` and filters only its own chrome (`packages/bug-capture/src/region.ts:81-103`, `packages/bug-capture/src/region.ts:130-156`). There will be no DOM/keystroke session replay in this product. "Last minute" means a 60-second, source-sanitized diagnostic timeline: safe event type, selector class, normalized route, status, duration and timestamp. `/admin` gets no recorder at all.

6. **Rate limiting or an email field does not make auto-replies safe.** A claimed address is not an owned address. Even a verification email can be abused to send one unwanted message. Under the current constitution, no real reporter email may be sent without Sanjay's explicit yes; there is no standing exception for this loop. The default reporter interface is therefore an unguessable status link shown in the browser. Contact email is optional, stored separately and encrypted, and every outbound message remains `notify_pending` until human approval. Fully automatic replies require a new explicit standing exception plus address verification, Turnstile and per-IP/per-address limits `[from-memory — verify]`.

7. **The proposed fixer cage is both too weak and too restrictive.** A branch plus path allowlist is too weak because the dirty main checkout is not isolation and both monoliths mix safe and dangerous behavior. It is too restrictive because a real UI bug is outward-facing behavior by definition. More importantly, the constitution says scheduled runs may not edit product code unattended, and public GitHub issue/PR creation is outward publication. The unattended watcher may sanitize, classify, lease work and write proposals inside a designated state folder. The fixer must be owner-triggered in a clean worktree pinned to a SHA. Default-deny capabilities matter more than one static path list: no secret access, deploy, email, `git push`, GitHub publication or merge; per-report approved files; command allowlist; diff and test manifest. A draft PR is created only after a separate owner approval `[from-memory — verify]`. An agent never merges.

8. **Features should skip the bug fixer, not disappear.** The reviewer is right that an unapproved feature request must not enter an autonomous fix lane. It can still be deduplicated, summarized and ranked in a private human queue. Once the owner explicitly promotes a bounded feature, it may use the same reproduction/spec, isolated-worktree, test and draft-PR gates. "Never" would make half of the requested button dishonest.

The owner's original plan also has errors:

- **"Everything from the browser" is neither possible nor acceptable.** The current package captures only warn/error strings, network method/URL/status/duration, twenty clicks and screenshots. It does not capture bodies, headers, cookies, storage, heap contents, uncaught-error stacks or a replay (`packages/bug-capture/src/ring-buffer.ts:5-43`; `packages/bug-capture/src/network.ts:10-16`). Heap contents, request bodies, auth headers and cookies must remain forbidden.
- **The prior-art privacy summary is overstated.** General redaction removes only email-shaped strings, and only from notes and console logs (`packages/bug-capture/src/redact.ts:1-11`; `packages/bug-capture/src/bundle.ts:94-108`). Full page URL/referrer, selectors, click/element text and pixels are untouched. Network masking covers only five exact query-key names (`packages/bug-capture/src/network.ts:47-50`); `/m?...&t=...` is not protected.
- **The 512 KB ceiling is not an absolute transport ceiling.** Images sit outside it, and after dropping arrays the fitter does not clamp every remaining metadata/element field (`packages/bug-capture/src/bundle.ts:52-84`; `packages/bug-capture/src/transport.ts:19-23`). The server must enforce its own total and per-part limits.
- **An automatic screenshot is wrong here.** `captureBug()` tries to capture the body whenever the user supplied no screenshot (`packages/bug-capture/src/index.ts:45-53`). On BeatAss that can silently capture a confession. Screenshot must be explicit, route-allowed and masked before pixels exist.
- **"Malicious, stupid, or irrelevant" is a bad taxonomy.** Classify evidence, not the intelligence of the person. Repeated "user error" is often a usability defect. Use `needs_guidance`, `state_recovery`, `spam_or_unsafe` and `feature_request`.
- **Public GitHub is a privacy boundary.** The repository is public (`VENTURE.md:76-78`). No raw bundle, screenshot, reporter address, confession, `/m` token, admin data or evidence URL may enter an issue or PR. GitHub gets an opaque report ID and a synthetic reproduction only.
- **"Fixed" is not "shipped".** Pull requests build and test but do not deploy; only a non-PR run deploys (`.github/workflows/deploy.yml:48-84`). Reporter notification waits until a production revision file proves the merged fix is live and the live smoke check passed.

## Architecture

The system has five deep modules with small interfaces: capture, intake, triage, proof/fix and status/notification. Raw evidence never crosses into GitHub, and no model or fixer gets an outward capability.

```text
Report button -> privacy policy -> masked 60-second evidence -> POST /api/bug
  -> D1 state + private R2 evidence -> laptop triage proposal
  -> owner decision -> owner-triggered clean worktree -> red reproduction
  -> sanitized local issue draft -> owner-approved GitHub issue -> fix -> green target + full suite
  -> local PR draft -> owner-approved draft PR -> human merge -> CI deploy
  -> /version.json proves live -> status page -> owner-approved reporter email -> close
```

### 1. Capture module

Reuse `@gno/bug-capture`; do not paste a fork into `template.html`. Extend its interface with a mandatory `CapturePolicy` selected before `init()`:

- `routeClass`: `/`, `/m`, `/admin` or `other`; never full URL.
- `allowTimeline`, `allowPicker`, `allowScreenshot`, `allowClickText`.
- literal `maskSelectors`, `normalizeUrl()`, `sanitizeConsole()`, `sanitizeNetwork()`.
- 60-second filtering for all diagnostic events; explicit screenshot only; maximum two images and one MiB per image.
- a transport result `{id, statusUrl}` that throws on non-2xx, malformed response or timeout. It must not show success for an HTTP rejection, which the current `send()` can do (`packages/bug-capture/src/transport.ts:19-23`).

Create a package-owned browser IIFE exposing a narrow `window.BeatAssBugCapture` interface. The package currently exports `.ts` and has no build artifact (`packages/bug-capture/package.json:5-20`). Vendor the reviewed artifact as `vendor/bug-capture.iife.js`; add `__BUGCAPTURE__` to `build.py`'s existing literal `SCRIPTS` map and inline it next to `__GIFJS__` (`build.py:80-107`; `template.html:746-750`). BeatAss still ships plain HTML/CSS/JS and runs no runtime bundler.

The BeatAss adapter and side sheet live in `template.html`. It borrows the GameNightOwl widget's public package calls, picker and screenshot flow (`gamenightowl/src/components/BugWidget.astro:269-279`, `:472-498`) but uses BeatAss styling, accurate consent copy and no automatic screenshot. `build.py` continues to emit `beatass.html` and `public/index.html`; generated files are never hand-edited (`build.py:92-116`).

`/m` and `/admin` are Worker-rendered, not `template.html` (`src/index.js:1062-1127`, `src/index.js:1351-1387`). `/m` gets a metadata-only "Report a product problem" link generated by `viewPage()`. `/admin` gets no embedded recorder; it links to a clean `/bug-report?from=admin` page with text-only capture. This prevents the capture module from ever observing the admin DOM.

### 2. Intake module

Add `POST /api/bug` beside `/api/send` in `src/index.js`. Do not reuse the existing `/report`; that route is a signed recipient-abuse action that increments `messages.reports` (`src/index.js:1274-1294`). The intake sequence is:

1. Fetch the enabled policy from `GET /api/bug/config`; if disabled, do not initialize capture.
2. Require same-origin POST, valid schema, server-side Turnstile verification `[from-memory — verify]`, distinct `bug:<ipHash>` KV limit, and an idempotency UUID. The existing HMAC and IP-hash helpers are reusable (`src/index.js:54-81`).
3. Reject JSON over 128 KiB, more than two screenshots, any screenshot over one MiB, and total multipart over 2.25 MiB. These are BeatAss limits, not claims about Cloudflare limits.
4. Run deterministic server sanitizers again. Client masking is the primary privacy control; server scanning is a tripwire, not permission to capture first and redact later.
5. Insert `bug_reports(state='receiving')`, write sanitized evidence to a new private `BUG_EVIDENCE` R2 binding under `bugs/<id>/...`, hash it, then conditionally move to `received`. The existing `MEDIA` route intentionally serves matching GIF/MP4 keys publicly and cacheably (`src/index.js:1177-1195`), so bug evidence must not use that public namespace.
6. Append an opaque action to the existing `events` log. Add nullable `bug_id` and an index in the migration; never put report text in `detail`, which is already clipped to 300 characters (`src/index.js:508-525`).
7. Return only `{id, statusUrl}`. `statusUrl` carries an HMAC capability and exposes coarse state, never raw evidence.

Add `migrations/005-selfheal.sql` and matching fresh-database definitions in `schema.sql`:

- `bug_reports`: `id`, unique `client_id`, timestamps, normalized route, build revision, `state`, `verdict`, `confidence`, safe summary, reproduction/issue/PR/ship/notification states, private evidence key/hash, lease owner/expiry and last error.
- `bug_contacts`: report ID, keyed-HMAC email hash, encrypted address, verification/approval timestamps and deletion timestamp. The encryption key and HMAC key are Worker secrets, never repo content.
- `events.bug_id`: nullable reference used by the shared action log. Do not overload `messages.post_state` or `msg_id`.

Every transition is a literal map plus conditional update, such as `WHERE state = 'received'`. That reuses the admin queue's safe state-transition pattern (`src/index.js:1130-1156`) and prevents two watchers from creating duplicate work.

### 3. Triage module

Add `tools/selfheal/triage.mjs`, `tools/selfheal/auto-triage.sh` and `tools/selfheal/com.beatass.selfheal.plist`. Reuse the current classifier's useful shape: `--dry`, `--one`, bounded batches, schema-constrained model output, timeout, untrusted-text fencing and fail-closed parsing (`tools/classify.mjs:6-11`, `:68-90`, `:104-134`, `:203-222`). Do not reuse its confession prompt.

The unattended watcher may read sanitized evidence, apply deterministic spam/privacy rules, request an AI classification only when the owner has enabled that outward model lane, lease a row and write a proposal to D1 plus `~/.config/beatass-selfheal/`. It has no GitHub token, email capability or product worktree. Source the tested `tools/lib/backoff.sh`; use a one-run lock; process at most five reports per run; open a circuit after three whole-run failures. The existing wrappers already establish backoff and launchd kill-switch patterns (`tools/lib/backoff.sh:18-57`).

### 4. Issue and proof/fix modules

`tools/selfheal/prepare-issue.mjs <id>` refuses to run until the pinned base has a recorded red reproduction or an owner-approved invariant proof with a failing regression test. It then writes a sanitized `issue.md` and fixtures under the designated local state folder. It contains an opaque report ID, deployed base SHA, synthetic reproduction, expected/actual behavior and evidence hash. It contains no raw evidence or private link.

`tools/selfheal/approve-issue <id>` is the explicit outward gate after red proof. Only then may a GitHub issue be created `[from-memory — verify]`. Feature requests stop in the human queue unless separately promoted.

`tools/selfheal/fix <id>` is owner-triggered. It refuses an unapproved report, unpinned base, absent proof contract or overlapping active worktree. It creates a clean worktree/branch `selfheal/<id>` from the reported base SHA. A per-report manifest names allowed files and commands. Network, secrets, deploy, email, push, PR publication and merge are denied. The agent may edit only that worktree during this interactive run.

The output is local: regression test, patch, test transcripts, changed-file list and evidence hash. `tools/selfheal/approve-pr <id>` is a second explicit outward gate that may create a draft PR `[from-memory — verify]`; it never marks the bug shipped and never merges.

### 5. Status, ship and notification module

Add a generated `public/version.json` containing the build revision. CI supplies the main-branch revision during build and its existing live check verifies that exact file after deploy. The watcher marks `shipped` only when production reports a revision containing the merged fix and the live workflow is green. A PR being green or merged is insufficient.

`GET /api/bug/status?id=<id>&t=<capability>` returns only `received`, `needs_info`, `queued`, `fix_in_review`, `shipped` or `closed`, plus owner-approved guidance. It is the default reply channel and causes no email.

Reporter email remains optional. `sendViaResend()` is the one existing outbound email seam (`src/index.js:416-448`), but the self-heal module calls it only from an authenticated admin action that changes `notify_pending -> notify_sending`. Fully automatic receipt/fix emails remain disabled unless Sanjay creates a bounded standing exception.

## The privacy model

Masking happens before event insertion and before DOM rasterization. Submit-time redaction is only defense in depth.

| Route | Captured | Masked at capture time | Never captured |
|---|---|---|---|
| `/` | Normalized route, build revision, viewport/DPR, coarse browser/language, safe error code, normalized same-origin route/status/duration, timestamped safe clicks outside private areas, optional numeric JS memory totals when supported `[from-memory — verify]`, explicit screenshot/picker result | `#i-name`, `#i-email`, `#i-handle`, `#i-wa`, `#i-msg`, `#i-sender`, `#p-to`, `#p-greet`, `#p-sub`, `#p-msg`; values and private descendants become opaque boxes before selector text or pixels are produced. Generated media is included only when deliberately selected. These fields are real sensitive surfaces (`template.html:584-623`, `:677-704`). | Field values, confession, contacts, share consent, multipart bodies, response bodies, headers, cookies, storage, full URL/query/referrer, heap contents, keystrokes, DOM snapshots, automatic screenshot |
| `/m` | Route literal `/m`, build revision, viewport/coarse browser, safe top-level error code, reporter's manual note | Strip every query parameter before any buffer sees it. Default is metadata-only. If the user explicitly requests a screenshot, mask recipient heading, confession, media and every action URL as one opaque region before rasterization. The `t` query value grants access to the message (`src/index.js:1355-1386`). | Message body/name, view token, message ID, media URL/pixels, click or element text, network URLs, DOM replay, cookies, referrer, automatic screenshot |
| `/admin` and `/admin/login` | Nothing from the page. A link opens a separate clean text-only report page carrying only `from=admin` and build revision. | Not applicable; the capture library is never initialized. | Admin credentials/session, screenshots, picker, DOM text, queries, console, network, clicks, cookies, contacts, confessions, UA/geo/fingerprint rows. The dashboard deliberately renders all of those (`src/index.js:731-755`). |

The server stores only already-sanitized evidence in private R2, minimal state in D1 and reporter contact in a separate encrypted row. Default retention: raw evidence 7 days, triage/proof artifacts 30 days, minimal aggregate metadata 90 days `[from-memory — verify]`; ship only after the owner approves those periods and a deletion job/test exists. Deletion removes evidence and contact first, then retains only non-identifying counts and verdict.

## The triage decision

Deterministic rules run before AI: schema/size, Turnstile result `[from-memory — verify]`, duplicate client ID/payload hash, rate limit, forbidden-data tripwire and known test-report marker. The AI receives a bounded, sanitized evidence summary, never cookies, contacts, raw screenshots or private confession data. Confidence never substitutes for evidence.

| Verdict | Minimum evidence | Action | Reporter status/reply |
|---|---|---|---|
| `real_bug` | A stated expected/actual contract plus at least one hard signal: failing request/error code, exception fingerprint, repeat cluster, or local falsifiable reproduction | Move to `reproduction_pending`; no fix until the verification gate passes | Before red proof: "We found evidence of a possible problem and are trying to reproduce it." After red proof: "We confirmed the problem and are working on a tested fix." Email only if approved |
| `needs_guidance` | Current behavior matches a documented rule and a synthetic run demonstrates the correct path; no contrary error signal | Queue owner-reviewed guidance; cluster repeats into a usability/feature candidate | "I could not confirm a failure. Try: <specific steps>. If that does not match what you saw, add details at your status link." |
| `state_recovery` | Same build succeeds in clean state and fails under a reproduced, non-secret cache/client-state condition | Give the narrow recovery step; also open a bug if the app should self-recover | "This looks tied to saved browser state. Try <targeted step>; you do not need to clear all cookies." |
| `spam_or_unsafe` | Deterministic abuse signal, irrelevant payload, forbidden-data tripwire, duplicate flood or prompt-injection attempt | Quarantine; no model/fixer/GitHub; rate action if policy allows | No email. Status says only "This report was not accepted." |
| `feature_request` | Desired behavior is new rather than a violated existing contract | Deduplicate and place in private human decision queue; no fixer | "This is a feature request. It is queued for human review, not promised." |
| `needs_human` | Missing/contradictory evidence, confidence below 0.80, sensitive route, provider-only/transient fault, or model/parser failure | Stop. Ask for one narrow missing fact through status page or escalate privately | "We could not classify this safely. A person needs to review it." |

Never reply "not a real bug" merely because there is no console error. A confused user may have found a design defect. `needs_guidance` closes only after the synthetic correct path succeeds and a human approves the response.

**Confidently wrong failure mode:** a report says "Send it does nothing" at 390x844. The sanitized screenshot shows the preview card, the network log is empty, and the AI confidently calls it user error. The actual regression is that the bottom of the card, including `#btn-send`, is two pixels below the viewport; the user cannot press it. Guard: verdicts about visible/interactive UI require a geometry assertion at the reported viewport, not screenshot interpretation. The existing test already measures overlay bounds and fails the process on collected errors (`test.mjs:347-364`). A high-confidence model verdict cannot close without that route-specific negative check; repeat clusters automatically reopen it.

## The verification gate

A proposed fix is eligible for a PR only when all of these are true:

1. **Pinned truth:** capture the production build revision with the report. Reproduce from a clean worktree at that SHA, never from the dirty owner checkout.
2. **Synthetic privacy:** replace any captured names, addresses, confession text, tokens and media with canaries. Raw evidence remains outside the repo and GitHub.
3. **Red proof:** run one focused command against the old code and record a deterministic failing assertion. For an invariant-only case, record the exact invariant violation, obtain human approval, and add the failing regression test before the fix.
4. **Fix:** edit only the report manifest's approved files in the isolated worktree.
5. **Green proof:** the same focused assertion passes without weakening or deleting it.
6. **Regression proof:** `python3 build.py`, the focused Worker/package tests and full `npm test` pass. `npm test` already rebuilds and exercises real Playwright plus Worker/local-D1 scripts (`package.json:6-13`).
7. **Privacy proof:** serialized JSON, multipart bytes, screenshot pixels, issue draft and PR draft contain none of the canaries. A string scan is insufficient for images; inspect the known private rectangles and require the opaque mask.
8. **Scope proof:** diff contains only manifest-approved source, tests and generated build outputs; no secrets, workflow activation, delivery changes, deploy action or unrelated cleanup.
9. **Human gates:** after red proof, the owner may approve issue publication; only after the remaining green, regression, privacy and scope proofs may the owner separately approve draft-PR publication. No agent merges or pushes main.

For a client-only bug in this single-file app, a valid reproduction is a Playwright scenario against built `beatass.html` or `public/index.html` that sets the reported viewport/touch mode and deterministic browser state, mocks `/api/*` responses/delay/offline behavior, performs the sanitized click sequence and asserts a user-visible contract. It must fail before the patch and pass after. A screenshot alone is evidence, not a test. The current harness already serves the built page, mocks the exact API and captures page errors/geometry (`test.mjs:77-175`); `page.addInitScript`/request interception patterns also exist in `test-sound.mjs:42-75`, `:184-203`.

If the problem cannot meet this gate, the allowed outputs are `needs_human`, a diagnostics-only proposal, or a feature request. There is no guessed fix.

## POC scope

The smallest credible one-day POC is local and deliberately synthetic. It proves the state transitions and privacy controls without any real email, GitHub publication, deployment or unattended product-code edit.

**One tracer:** seed a deterministic client defect in a disposable, owner-triggered POC worktree: at 390x844 the existing message preview puts `#btn-send` outside the viewport while the separate report sheet remains usable. From the real built page:

1. Open the plain side sheet on `/`, type unique confession/contact canaries, explicitly select a safe screenshot and submit to a local Worker `/api/bug`.
2. Local D1 stores the state; local/private R2 stores masked evidence. Acceptance rejects any canary in JSON, multipart or screenshot pixels.
3. A dry-run triage adapter returns `real_bug` under a schema and moves the report only to `reproduction_pending`. No hosted model is required for the POC; one recorded fixture proves the interface, not model quality.
4. The owner-triggered runner generates a Playwright test that fails on the disposable old build, records that red proof, renders the local issue draft, applies a pre-scoped patch in that worktree, reruns red-to-green plus `npm test`, and renders local PR/status/email drafts.
5. A local `version.json` transition marks the synthetic fix shipped; the status page changes to `shipped`. No outward notification is sent.

Time box: capture privacy hardening and IIFE 2.0 h; sheet plus local intake/storage 2.0 h; dry triage/state machine 1.0 h; red/green isolated fixer tracer 2.0 h; end-to-end privacy/state acceptance and kill-switch check 1.0 h. Total 8.0 h.

Deliberately left out: `/m` screenshots, all `/admin` capture, literal replay, cookies/storage/heap, real AI judgement, real reporter email, email verification, real GitHub issue/PR, launchd scheduling, production R2 retention, deploy and automatic code edits. The POC earns the next investment only if one command proves: no privacy canary escapes, duplicate submit makes one report, every state transition is valid, the base test is red, the patched test and full suite are green, and all outward artifacts are inspectable drafts.

## Build plan

1. **Harden and distribute the reused capture module (5 h).** Files: canonical `packages/bug-capture/src/{index,bundle,transport,redact,network,ring-buffer,clicks,element,region,screenshot}.ts`, its tests/build config, and BeatAss `vendor/bug-capture.iife.js`. Build `CapturePolicy`, source-time redaction, 60-second windows, explicit screenshots, response checking and absolute byte/image caps. Acceptance: package tests plus browser privacy canaries prove full URLs, contacts, tokens, private text and unmasked pixels never leave; a 500 response is shown as failure.
2. **Add the plain BeatAss sheet (4 h).** Files: `template.html`, `build.py`, `test.mjs`; generated `beatass.html` and `public/index.html` only through the build. Acceptance: button/sheet works at all seven existing viewports, picker and explicit masked screenshot work, keyboard focus/close works, no page scroll regression, and the generated page contains exactly one inlined capture artifact.
3. **Build intake and storage (6 h).** Files: `src/index.js`, `schema.sql`, `migrations/005-selfheal.sql`, `wrangler.jsonc`, new focused Worker test. Acceptance: local Worker accepts one valid masked multipart report, rejects invalid Turnstile `[from-memory — verify]`, over-limit parts, raw token/canary and duplicates; D1/R2 partial failure lands in a recoverable state; no evidence key is publicly fetchable.
4. **Build the triage/state queue (6 h).** Files: `tools/selfheal/triage.mjs`, structured schema/prompt fixtures, self-tests, admin bug queue in `src/index.js`. Acceptance: all five verdicts plus `needs_human` parse; malformed/model-injected output fails closed; conditional transitions and leases prevent duplicate work; raw contact/evidence never appears in prompts or admin list.
5. **Build the compliant laptop watcher (4 h).** Files: `tools/selfheal/auto-triage.sh`, launchd plist, tests, reuse `tools/lib/backoff.sh`. Acceptance: dry run writes only designated state, concurrent second run exits, three failures open the breaker/back off, unload stops it, and the process has no GitHub/email/product-write capability.
6. **Build issue/proof/fix tooling (8 h).** Files: `tools/selfheal/{prepare-issue,approve-issue,fix,approve-pr}` plus policy/manifest fixtures and tests. Acceptance: raw/sensitive issue draft is refused; unapproved or unpinned job cannot run; fixer uses a clean isolated worktree, produces red/green transcripts and cannot push/deploy/email/merge; outward commands require the two explicit approvals.
7. **Build status, ship proof and notification (6 h).** Files: `build.py`, `.github/workflows/deploy.yml`, `src/index.js`, status/notification tests. Acceptance: PR state cannot mark shipped; exact production `version.json` plus live green check can; status capability reveals no evidence; notification stays pending until an authenticated owner action; retries are idempotent.
8. **Production hardening and privacy drill (6 h).** Files: retention/deletion job, ops docs/tests, kill-switch test, privacy page wording. Acceptance: simulated evidence leak disables intake, quarantines new reports and deletes one report/contact end to end; quota/model/GitHub/email outages do not loop; rollback/unload instructions are exercised locally. Provisioning or enabling any external resource remains a separate owner-approved action.

Full production estimate: about 45 engineering hours total; after the one-day tracer, roughly 37 hours remain. That is not a promise; monolith changes and privacy tests dominate uncertainty.

## Risks and kill switches

| Failure | Detection | Fast stop/recovery |
|---|---|---|
| Confession/contact/token leaks into evidence | Browser canaries, server tripwire, sampled evidence audit | Set `BUG_INTAKE_ENABLED=0`; config prevents `init()`; quarantine report; delete evidence/contact; rotate any leaked capability |
| Capture monkey-patch breaks the app | Page errors, send/GIF/viewport suite, client error-rate spike | Remote config disables initialization; old page continues without report button |
| Oversize/flood bypasses client caps | Server part counters, per-IP/payload metrics, R2 growth alarm | Fail closed with 413/429; disable intake; never rely on the package's nominal 512 KB target |
| Turnstile unavailable or misconfigured `[from-memory — verify]` | Server verification failure rate | Fail closed; show status-page message; no bypass switch |
| D1 row and R2 evidence diverge | `receiving` age and hash audit | Reconciler deletes orphan or retries conditional write; breaker stops intake after repeated storage failure |
| AI is prompt-injected or confidently wrong | Schema failure, disagreement with deterministic evidence, repeat clusters, human samples | Model has no action capability; route to `needs_human`; disable `BUG_AI_ENABLED`; never auto-close on confidence alone |
| Duplicate issues/PRs | Unique `client_id`, leases, conditional states, stored external ID | Stop watcher; reconcile by opaque report ID; one owner-approved promotion command is idempotent |
| Fixer changes dangerous behavior | Manifest diff check, command audit, capability denial, full suite | Terminate worktree run; discard isolated worktree; no push/PR exists before approval |
| Public GitHub leaks private evidence | Draft linter with canaries/forbidden patterns | Publication command refuses; if human published anyway, remove content and rotate tokens under explicit authority `[from-memory — verify]` |
| Automated email becomes an abuse pipe | Unverified-contact count, complaints, per-address/IP counters | `BUG_NOTIFY_ENABLED=0`; no standing exception means human approval remains mandatory |
| Watcher loops or burns model budget | Per-run cap, timeout, breaker, cost counter, backoff state | `launchctl unload ~/Library/LaunchAgents/com.beatass.selfheal.plist`; revoke model lane; watcher has no product/GitHub/email capability |
| Reporter is notified before deployment | Production revision mismatch or failed live check | Keep `notify_pending`; only `version.json` plus live green state can move to `shipped` |
| Owner's dirty checkout contaminates a fix | Base/diff check and isolated worktree requirement | Refuse run; never stash/reset/clean the owner's checkout |

Hard flags default off: `BUG_INTAKE_ENABLED`, `BUG_AI_ENABLED`, `BUG_GITHUB_ENABLED`, `BUG_NOTIFY_ENABLED`. There is intentionally no unattended `BUG_FIXER_ENABLED`.

## Cost

All figures here are `[from-memory — verify]`; pricing and free-tier limits drift. They are planning ranges, not authority to spend.

Assumptions: one sanitized triage prompt of roughly 20 KB plus structured output for every accepted report; 20% of reports reach one coding-agent proof/fix attempt; about one MiB short-lived private evidence per report; zero automatic reporter email under the current constitution. If a standing email exception is later approved, budget up to two messages per report.

| Item | Rough cost |
|---|---:|
| Triage model call | $0.01-$0.10 per accepted report `[from-memory — verify]` |
| Coding-agent proof/fix run | $0.50-$5.00 per reproduced bug `[from-memory — verify]` |
| Weighted model total at 20% fix rate | $0.11-$1.10 per report `[from-memory — verify]` |
| Worker + D1 operations | Usually below $0.01/report and plausibly inside existing free allowances at these volumes `[from-memory — verify]` |
| Private R2 at about 1 MiB/report with short retention | Fractions of a cent/report; roughly $0.015/GB-month storage before operation charges `[from-memory — verify]` |
| Reporter email | $0 now; later roughly $0-$0.004/report for up to two messages, plan-dependent `[from-memory — verify]` |
| GitHub issue/draft PR on the existing repo | No per-item fee expected `[from-memory — verify]` |

| Accepted reports/month | Evidence added/month | Expected monthly total at 20% fix rate |
|---:|---:|---:|
| 10 | about 10 MiB | $1.10-$11.10 `[from-memory — verify]` |
| 100 | about 100 MiB | $11-$111 `[from-memory — verify]` |
| 1,000 | about 1 GiB | $110-$1,110 `[from-memory — verify]` |

The range is wide because agent runs, not storage or email, dominate. Enforce an owner-set monthly dollar ceiling and stop before the next model call when it is reached. The agent may report that a paid tier is needed; it may never enable one or click a payment button.
