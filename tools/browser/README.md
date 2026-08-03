# Browser runners — parallel asset generation without repeating the clicks

Scripted versions of the browser recipes proven by hand on 2026-08-03
(story-001 v2 build). They drive a dedicated automation Chrome through
Playwright, so generating stills and clips for a new story part is three
commands instead of an afternoon of clicking.

## One-time setup (about 3 minutes)

1. `bash tools/browser/launch-chrome.sh` — opens a separate Chrome with its
   own profile at `~/.config/beatass/chrome-automation`. Your normal Chrome
   is untouched.
2. In that window, log into Google (for Flow at labs.google/fx) and
   chatgpt.com. The profile remembers both forever.

Every later session: run the launch script, done. The scripts refuse with a
clear message if that Chrome isn't running.

## Generate stills (ChatGPT, parallel tabs)

```
node tools/browser/chatgpt-stills.mjs \
  --jobs jobs.json --board path/to/reference-board.png \
  --out marketing/production/story-XXX/frames --parallel 3
```

`jobs.json` is `[{"name": "scene-1-v3", "prompt": "..."}, ...]`. Each job gets
its own chat tab; the board image is uploaded first, the prompt follows, and
the finished image is saved as `<out>/<name>.png` — no Downloads-folder dance.

## Generate clips (Flow)

Open the Flow project in the automation Chrome, upload the stills there, and
set the composer once by hand: Video / Frames / 9:16 / Omni Flash / 10s /
**x1 outputs**, Agent pill **OFF** (defaults are x4 = 4x the credits, and
Agent mode swallows prompts). Then:

```
node tools/browser/flow-clips.mjs --prompts PART-X-FLOW-PROMPTS.txt --plan     # parse check, no browser
node tools/browser/flow-clips.mjs --prompts PART-X-FLOW-PROMPTS.txt --dry-run  # full run minus Create — spends nothing
node tools/browser/flow-clips.mjs --prompts PART-X-FLOW-PROMPTS.txt --yes      # real submit, ~15 credits/clip
node tools/browser/flow-clips.mjs download --out downloads/                    # after renders finish
```

Submissions go in back-to-back (about 30s each); Flow renders them all in
parallel on its side. `download` saves every grid video as `flow-clip-N.mp4`
(720p previews; 1080p originals stay in the Flow project) and prints the
ffmpeg one-liner for the first-frame contact sheet you need to map clips to
scenes — the grid is newest-first, never assume order.

## Rules

- **Always `--dry-run` first** on a new story part or after Flow ships a UI
  change. The selectors here match Flow/ChatGPT as of 2026-08-03; when one
  breaks, the error names the step — fix the selector, re-dry-run.
- Real submits only with `--yes` after the dry run is clean. Credits are
  spent per clip; there is no undo.
- Why the odd techniques inside: Flow swallows plain synthetic clicks
  (hence the pointer-event burst in `lib.mjs`) and ignores untrusted text
  insertion (hence real CDP keystrokes). ChatGPT's composer drops the first
  click after a file upload (hence the probe-and-retry). Signed asset URLs
  can't be fetched from outside the page (hence in-page fetch -> base64).
  Don't "simplify" these away — each one was a real failure.
