# Google Flow automation design

Status: proposed and AMBER. This document is a design, not automation code.

## Decision boundary

Google Flow has no public API or command-line interface, so every option other than manual work drives a Google account through its browser user interface. Browser automation of a Google account UI is a terms-of-service gray zone and may conflict with rules against prohibited or suspicious automation. It can also break whenever the UI changes. The exact current Google and Flow terms are **verify live**.

The account, subscription, or both could be challenged, limited, or flagged. This is not a risk that an engineer can accept on Sanjay's behalf. Sanjay must decide whether this AMBER capability is acceptable before any automated submission is built or run.

**AMBER means:** supervised, human-launched experimentation only. It is not approved for unattended runs, overnight batches, parallel renders, login automation, or bypassing checks.

## Terms used here

- **Playwright/Puppeteer:** Node.js tools that control a real Chrome window much as a person would.
- **Persistent profile:** a separate Chrome data folder that preserves an interactive, already-logged-in session. It is a credential and lives outside the repository.
- **Headful:** a visible Chrome window. Headless means hidden browser automation and is prohibited in this design.
- **Queue:** small job files waiting to be rendered, oldest first.
- **Dry run:** validate the account, queue, files, and planned UI steps without pressing Generate or creating a chargeable render.

## Guardrails that apply to every automated option

1. A person launches every run from the local Mac and stays available to stop it. There is no scheduler, cloud runner, remote machine, or autonomous retry loop.

2. Use only one Flow tab, one browser context, and one render at a time. Never submit clips in parallel. Flow's web queue and the local machine can both jam under parallel work.

3. Start with a cap of three submitted renders per local calendar day. Store each submission in an append-only local log and stop at the cap. Any increase needs a fresh human decision after reviewing quota and account behavior **verify live**.

4. Pace actions like a careful person: pause between UI changes, wait for visible state changes, and do not hammer retries. Exact safe timing should be established in supervised testing, not guessed.

5. Always launch a visible Chrome window. Use a saved session created by a manual login. Do not store a Google password in the repo, environment, queue file, or script configuration. Do not automate the login challenge.

6. Read the expected signed-in account from the visible Flow or Google UI and hard-stop on a mismatch. The exact account label and selector are **verify live**. Until that check is proven, require the operator to confirm the account visibly before every run.

7. Check a kill switch before every job. A simple local file such as `~/.config/beatass-flow/DISABLED` is sufficient: if present, the run exits before opening or submitting the next job. The operator can create it at any time to stop future work.

8. Capture a screenshot and a concise failure record on every unexpected UI, timeout, missing download, account mismatch, or stop. Never guess through a changed screen.

9. Keep generated clips and logs under the relevant `marketing/production/<story-id>/` directory. Keep browser session data, account identifiers, and credentials outside the repo at `~/.config/beatass-flow/`.

10. Before enabling any run mode, Sanjay reads the current Google/Flow terms and accepts or rejects this specific risk. Record the decision and date locally. This is a human decision, not a technical test.

## Options compared honestly

| Option | Build effort | Fragility and anti-bot exposure | Ongoing maintenance | Risk | Fit |
| --- | --- | --- | --- | --- | --- |
| A. Node script using Playwright or Puppeteer | Medium. Build a small queue runner and map each Flow screen. | High. CSS selectors and buttons can change, render states can vary, and scripted account UI activity can be flagged. A visible browser and slow serial operation reduce, but do not remove, that risk. | Medium. Expect repair whenever Flow changes its UI. | AMBER. Account and subscription risk remains. | Best eventual supervised automation if Sanjay accepts the risk. It follows the existing Instagram house pattern. |
| B. Custom Chrome extension | High. Requires a Manifest V3 extension, UI drivers, state handling, and usually a local bridge because a browser extension cannot freely read an arbitrary local queue folder. | High. It still drives the same fragile Flow UI and presents a larger permission surface. Google may also change extension or page rules. | High. Maintain both the extension and the Flow integration. | AMBER, with more moving parts and no meaningful policy advantage over A. | Poor fit for the first version. |
| C. Semi-automatic Claude-in-Chrome session | Low to medium. Prepare prompt and frame files, then have the interactive browser session perform the visible steps with a person supervising. | Medium to high. The UI can still change, but a person can see and correct it immediately. It does not create a standing bot. | Low. Update the operator checklist when Flow changes. | AMBER. Still an account UI automation risk, but lower operational blast radius than a persistent runner. | Best learning and validation step before A. |
| D. Manual prompt files only | Low. Organize frames and prompts, then paste and upload by hand. | Low technical fragility. Human error and slow throughput remain. | Low. | Lowest automation risk because no browser-driving system is used. | The safe baseline and fallback whenever any automated option becomes unreliable. |

## Recommendation

Choose a two-stage path:

1. Use option C now for a small supervised learning batch. It confirms the real Flow controls, image attachment path, account label, render states, download path, and current terms without creating a standing browser robot.

2. If Sanjay explicitly accepts the AMBER risk after that batch, build option A as a narrow, visible, human-launched queue runner. It should automate only the repeatable transfer work: open the next job, attach one approved start frame, paste one action prompt, select already-approved settings, submit one render, wait, download, and log. It must not make creative approvals, change account settings, solve login challenges, post to social media, or run unattended.

Do not build option B first. Its added engineering and permissions do not solve Flow's lack of a stable interface. Keep option D ready as the immediate fallback.

## Proposed option A shape

This follows `tools/instagram/post.mjs` as the house precedent: a saved session outside the repo, deterministic queue order, a dry-run mode, hard stop on wrong account, one item at a time, and a failure screenshot rather than improvising.

### Proposed files and locations

```text
tools/flow/
  render.mjs                      # proposed future queue runner
  config.example.json             # safe committed defaults, no credentials
  README.md                       # manual login, risk acceptance, run instructions
  last-failure.png                # local diagnostic image, gitignored
  selectors.md                    # human-readable map of verified Flow screens

marketing/production/story-001-confession-bear/
  queue/
    pending/
      001-part-01-scene-02.json   # one approved frame plus action prompt
    complete/
    failed/
    .render-log.jsonl             # append-only local render record
  frames/
  clips/
  logs/

~/.config/beatass-flow/
  chrome-profile/                 # manually established Google session
  DISABLED                        # optional kill-switch file
  risk-acceptance.md              # local date and human approval
```

`~/.config/beatass-flow/` is intentionally outside the repository. It may contain a browser session, which has the same practical sensitivity as a credential. `last-failure.png` and logs may reveal private account UI, so they should be gitignored or stored only inside the story's local working area as appropriate.

### Job file contract

Each queued job describes exactly one already-approved eight-second render. It contains:

- stable job ID, story ID, part, and scene number
- absolute or story-relative start-frame path
- exact action-only motion prompt path or text
- requested vertical format and requested duration
- requested output filename
- creation and approval timestamps
- optional accepted style name and motion-sheet checksum

The queue runner reads the oldest pending job only. It moves a job to an in-progress record before opening Flow, then records a terminal outcome: `downloaded`, `failed`, `stopped`, or `needs-human-review`. It must never silently resubmit a failed job. A human creates an intentional retry job with a new take number.

### Safe configuration contract

The committed example configuration should include:

| Setting | Proposed default | Purpose |
| --- | --- | --- |
| `flowUrl` | `https://labs.google/flow` | One explicit destination. Verify the live URL before build. |
| `expectedAccountLabel` | required, no default | Account identifier expected in the visible UI. Exact reliable field is verify live. |
| `dailyCap` | `3` | Conservative total submitted renders per local day. |
| `maxJobsPerRun` | `1` | Enforces one deliberate render per launch during the trial. |
| `headful` | `true`, fixed | Visible browser only. No headless override. |
| `dryRun` | `true` | Default behavior must never submit a render. |
| `minimumPaceSeconds` | conservative value set after live observation | Avoid rapid UI actions. Exact value is verify live. |
| `renderTimeoutMinutes` | conservative value set after live observation | Stops and screenshots rather than waiting forever. |
| `killSwitchPath` | `~/.config/beatass-flow/DISABLED` | Operator-controlled stop before each job. |
| `outputDir` | story `clips/` folder | Where a verified download is copied or moved. |

The actual config belongs in a local ignored file. It contains no password. A login command, if any, only opens visible Chrome so Sanjay can sign in himself and save the profile.

### One-job run sequence

1. Operator first runs dry-run. The runner checks the kill switch, local risk-acceptance record, daily cap, job file, start-frame file, output directory, and expected signed-in account. It opens Flow visibly but does not press Generate.

2. Operator reviews the dry-run report and the actual Flow page. If the account or UI is unexpected, stop. No fallback selector and no automatic click-through is allowed.

3. In run mode, the runner opens one new Flow project or the verified render screen. It selects the pre-approved vertical format and eight-second duration only if those controls have been mapped in a prior supervised session. Flow's exact choices and defaults are **verify live**.

4. It uploads the one approved start frame, enters the exact action-only prompt, and captures a pre-submit screenshot or visible confirmation state for the run record.

5. It submits exactly one render, records the local timestamp, then waits for a visible completed state. It does not open a second job while waiting.

6. It downloads the completed video, verifies that the file exists and is non-empty, names it `part-01-scene-02-take-01.mp4`, and records the output path and completion timestamp.

7. It moves the job to `complete/` only after the local file check succeeds. A failed download, unexpected modal, timeout, or changed Flow screen causes a screenshot, failure record, and `needs-human-review` state. The next job does not start automatically.

## Phased build plan

This is intentionally small and should be built only after the human risk decision. Size: three focused sessions after a short supervised Flow mapping session.

### Phase 0: live mapping and decision, one supervised session

- Sanjay opens Flow normally, checks current Google and Flow terms, and decides whether AMBER experimentation is acceptable.
- With one non-sensitive test frame, map the visible steps: account label, image upload, image-to-video mode, 9:16, duration, prompt entry, generate, progress, completion, and download.
- Capture no secrets in repo notes. Mark every unavailable or inconsistent UI control as `verify live`.
- Deliverable: `selectors.md` and a manual operator checklist, not a bot.

### Phase 1: queue and safety scaffold, one session

- Define the job schema, story folder convention, ignored local configuration, append-only log format, daily cap rule, kill-switch rule, dry-run report, and screenshot destinations.
- Add sample fixtures using fake local files only. No Flow submission occurs.
- Deliverable: a testable local contract and safe defaults.

### Phase 2: visible one-job driver, one session

- Implement only the mapped happy path in a headful persistent profile: validate, open, attach, paste, submit one job, wait, download, log.
- Add an explicit stop at every unrecognized page or dialog. Do not add self-healing selectors or automatic retries.
- Deliverable: a supervised one-render run against one disposable test job, only if the Phase 0 decision approved it.

### Phase 3: failure paths and limited pilot, one session

- Exercise all safety stops, then render up to the daily cap of real approved clips under supervision.
- Review screenshots, logs, download names, selector stability, quota behavior, and any account warnings. Decide whether to keep option A, return to option C, or revert to manual files.
- Deliverable: a go, pause, or retire decision backed by the small pilot, not by theoretical completeness.

## Test plan

Run these checks in order. Use a test image and harmless motion prompt before Story 001 production assets.

| Test | Expected result |
| --- | --- |
| Queue order | Oldest approved pending job is selected; nothing else starts. |
| Dry run | Browser opens visibly, all preflight checks report, and Generate is never pressed. |
| Kill switch | Creating `DISABLED` before launch and while a prior job finishes prevents the next job from starting. |
| Account mismatch | The runner stops before upload or submission and saves a screenshot. |
| Missing frame or malformed job | The runner stops locally without opening a Flow submission. |
| Daily cap | A fourth submission on the trial cap is refused, even if jobs remain. |
| Unknown dialog or changed selector | The runner stops, saves `last-failure.png`, records the page state, and does not click a guessed alternative. |
| Render timeout | The runner logs `needs-human-review`, screenshots the visible state, and does not retry. |
| Download failure | The job is not marked complete until a non-empty local video file exists. |
| Serial rule | While one render is pending, no second Flow tab or submission starts. |
| Human stop | Closing the visible browser or invoking the kill switch leaves the current job recoverable and starts no next job. |

The success criterion is modest: one operator can move one approved frame and one action prompt through Flow, receive one correctly named local clip, and get a clear stop with evidence whenever the workflow differs. It is not a promise of unattended volume production.
