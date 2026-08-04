# beatass — next-session handoff (written 2026-08-04, end of pipeline-v2 day)

One screen of current state. Read this, then `VENTURE.md`, then
`marketing/insights/LATEST.md`, and you are caught up.

## What is live on Instagram (@_beatAss_)

| Reel | Story | Posted | Notes |
|---|---|---|---|
| /reel/DbnmqMdq4lo/ | story-005 The Villain Was Right (HINDI) | 2026-08-04 | pipeline v2, marker-pop style |
| /reel/DbnmOIOqQAN/ | story-005 The Villain Was Right (ENGLISH) | 2026-08-04 | pipeline v2, marker-pop style |
| /reel/DbnaVoMKZpR/ | story-004 The Confession | 2026-08-04 | old pipeline, Lily voice |
| /reel/DbnNh4zKzCw/ | story-002 Wedding Gift Part 1 | 2026-08-04 | parts 2-3 unbuilt (handoff in /tmp, may be stale) |
| /reel/Dbm3hlrK8iA/ | story-003 The Cottage | 2026-08-04 | best early performer (192 views day 1) |
| 3 older reels | story-001 parts 1-3 | 2026-08-03 | series lost 21% by part 3 |

All posted reels verified 9:16 on the LIVE video element (never trust the
thumbnail). Rating history: story-003 v1 got 2/5 (lyrics in music, flat
script, 1:1 crop); 2026-08-04 pipeline-v2 delivery got **5/5**.

## Pipeline v2 — the standing rules (Sanjay-directed 2026-08-04)

1. Hook = the conclusion / weirdest line inside the first 1-2 seconds.
2. 1-2 emotional spikes mid-reel, each with its own spike SFX accent.
3. Voice: **Brian** `nPczCjzI2devNBz1zQrb` — stability 0.30, style 0.5,
   speed 1.15, similarity 0.75 (tts.mjs now has these flags).
4. Style: **marker pop** — notebook DNA + vivid saturated colors, exaggerated
   expressions, no pastels. Lock lives in story-005 FLOW-PROMPTS (library).
5. Strong concepts ship EN + HI: two scripts (localized, not literal), same
   beats, ONE clip set, two renders. Devanagari captions verified rendering.
6. Auto-share is authorized: post.mjs waits for Instagram's own "shared"
   confirmation; never close the browser mid-upload; crop = Select Crop menu
   then "Original"; then measure the live post's video element.
7. Music instrumental-only ("absolutely no vocals..." in every Lyria prompt),
   gains by RMS math: beds ~17dB under VO (~0.04-0.05), verify segment RMS.

## The insights loop (new, installed and loaded)

- launchd `com.beatass.insights` runs `tools/instagram/insights-loop.sh` at
  09:30 + 21:30 → `marketing/insights/snapshots/*.json` + `LATEST.md`.
- **Start every content session by reading `marketing/insights/LATEST.md`**
  and diffing recent snapshots; feed findings into the next reel.
- Baseline: views plateau 140-190/reel in a day, likes 2-4%, comments ~0.
  Single twist reels > series.
- **Open ask for Sanjay:** switch the account to a professional/creator
  account in the app (Settings → Account type) — unlocks real retention /
  drop-off curves, which the scraper cannot see from the web.

## Where things live

- Skill: `~/.claude/skills/reel-factory/` (SKILL.md + pipeline.md +
  LEARNINGS.md — read Unabsorbed entries; several new ones from 2026-08-04).
- Asset library: `node tools/library.mjs list|search` (45 assets; search
  before generating anything — law 5).
- Remotion app: `marketing/remotion/story-001/` — currently configured for
  story-005 HINDI (beats.md, schemas, Master.tsx, captions-data.ts). The
  clips/current symlink → story-005. Generated clips are gitignored; copies
  sit in `marketing/production/story-00N/staging*/`.
- Flow browser automation: `tools/browser/` (CDP 9333; single project tab
  only; real batches single-tab; count is a proxy — identify every clip by
  frame). Flow project in use: ae554740.
- Instagram tools: `tools/instagram/` — post.mjs (share + confirmation,
  OK-modal dismiss), insights.mjs, stage-reels.mjs. Session profile at
  `~/.config/beatass-instagram` (never in repo). Known unlock sequence:
  `pkill -f "Google Chrome for Testing"` then remove `Singleton*` files.
- Venture memory (auto-memory): `beatass-marketing-push.md` — full history,
  standing rules, ratings.

## Likely next moves (not started)

- Read the first few insights snapshots (loop runs tonight 21:30) and compare
  pipeline-v2 reels vs old ones — hook retention is THE metric Sanjay cares
  about. Iterate on whatever wins.
- Wedding Gift parts 2-3 exist as scripts only; decide with Sanjay whether
  the series continues (data says series underperform) or gets re-cut as one
  single reel in pipeline v2.
- If Sanjay switches to a creator account, extend insights.mjs to capture
  retention from the professional dashboard.
