# The prompt to hand to Claude

Two prompts. **Paste Prompt 1 first** — it's the redesign, it needs no backend,
and it can ship on its own. Prompt 2 is the growth loop and comes after.

Replace `<REPO LINK>` with the GitHub URL before pasting.

> ⚠️ This folder is **not a git repository yet**, so there is no link to give.
> Run `git init`, commit, and push to GitHub first, or hand over the folder
> directly.

---

# PROMPT 1 — Redesign

```
Here is the codebase: <REPO LINK>

Read README.md and CLAUDE.md first. They explain the build, the house style,
and the decisions that were made deliberately. Then read VIRAL-RESEARCH.md —
it explains the strategy behind this brief. Then open beatass.html in a
browser and actually use it before changing anything.

## What this is

beatass is a website where you write an anonymous confession about someone,
take your feelings out on a hand-drawn voodoo doll, and the beating is
recorded as an animated GIF that travels with the message. Everything runs in
one HTML file with no server.

The drawing engine is genuinely good — pendulum physics, and every stroke is
drawn twice with a wobble re-rolled nine times a second so it reads as
hand-drawn rather than clip art. Keep that. The problem is the interface
around it.

## The goal

A product people share, not just use. That means: understood in five seconds,
fun within ten, finished in under a minute, and it produces something worth
posting. Assume 90% of visitors are on a phone.

## What's wrong right now — fix all of these

1. **The order is backwards.** The first thing on screen asks for a stranger's
   name and email address. That's the highest-friction request in the product
   and it comes before any fun. Nobody types an email for a site they haven't
   enjoyed yet. Restructure so the doll comes first and the "who's it for"
   details are collected last, right before sending.

2. **Nothing is a hero and everything is tiny.** Section labels are 13px, the
   damage/love gauges are 10px bars, the tool buttons are a thin toolbar, and
   the tagline is smaller than the logo. There's no focal point. Give the page
   one obvious main event and let it be big.

3. **The handwriting fonts are unreadable at UI sizes.** Caveat and Permanent
   Marker at 11–13px cannot be read comfortably. Restrict the script fonts to
   the logo, the tagline, the sticker chips, the doll's POW/OW impact words,
   and the text burned into the GIF. Everything functional — field labels,
   inputs, buttons, body copy, errors — moves to a clean high-contrast sans at
   16px minimum. The hand-drawn charm must come from the *drawing*, not from
   setting form labels in a script face.

4. **The lined-paper background is noise at desktop width.** Blue rules run
   edge to edge across the whole viewport including the empty margins, and the
   red margin line floats at an arbitrary position. Contain the paper so it
   reads as a page, not wallpaper. (Note: `--rule-h` is 30px and the body
   background is offset 4px so text sits on the rules — if you change body
   font-size or line-height you must re-measure that alignment.)

5. **The "fits on one screen, never scrolls" rule is strangling the layout.**
   It's why everything has to be small, and on mobile it squeezes the
   confession box down to three lines — you can't write a two-year-old secret
   in three lines. Replace it with **one job per screen**: a short stepped flow
   where each step gets room to breathe. Scrolling within a step is fine.
   Nothing should ever feel cramped again.

6. **The doll is passive.** Thin strokes, blank face at rest, sitting still in
   a big empty frame. Nothing about it invites a punch, which is why there has
   to be hint text explaining that it's interactive. Make it read as
   *hittable* on sight: bigger, heavier strokes, an expression, some idle
   life, and a clear invitation. Make the impact feel good — bigger reaction,
   more weight, damage that visibly accumulates and persists.

7. **The four tools are a toolbar, not a menu of options.** Punch / Pins /
   Burn / Love are four near-identical small items. They should feel like four
   distinct, tempting choices. Each one should look and *feel* different when
   used.

8. **The damage and love gauges are invisible.** 10px bars with 11px labels.
   These are feedback for the main interaction — they should be legible and
   satisfying to fill.

9. **There is no proof and no example.** A first-time visitor is asked to make
   something without ever seeing what the finished thing looks like. Show a
   looping example GIF early — that IS the pitch.

10. **There is no share surface at all.** No copy-link button, no save, no
    share-to-story. See "The share screen" below — this is the most important
    addition in the whole brief.

## The share screen (new, and the point of the whole exercise)

Today the flow ends at "It's gone. They'll never know it was you." — a dead
end. That final screen is where all the growth has to come from, so design it
properly:

- The finished recording, played large and looping.
- **Share** (one tap — use the Web Share API with the file attached, so the
  phone's native sheet offers Instagram, Snapchat, WhatsApp), **Save**, and
  **Copy link**.
- The recording itself is the ad. It must carry the site URL legibly burned
  in, and the stat line ("14 hits · 6 pins · burned").
- A one-line invitation to make your own.

**The export must be a video (MP4), not a GIF.** This is the single most
important technical point in this brief. Instagram Stories and Snapchat do
**not** accept animated GIF uploads — hand them a `.gif` and it posts as a
frozen still image, the doll never moves, and the entire growth plan silently
dies. Those two platforms are where this product has to travel.

This is easier than what exists today, not harder: `canvas.captureStream()`
plus the browser's built-in `MediaRecorder` records the doll canvas straight to
video with no library at all. Keep the existing gif.js GIF as a secondary
export for email and messaging apps, where GIFs do work.

Export sizes: **1080×1920 (9:16) is the primary** — that's the Instagram and
Snapchat Story shape, and the shape that carries a tappable link sticker.
1080×1080 square for feed. Keep the existing small 260×260 GIF for email.

Currently the GIF is 260×260 and about 600 KB, sized down deliberately so it
fits in an email. Keep a small email variant, but the *shared* video should be
high quality — it's going on someone's Story, not into an inbox.

Design the 9:16 Story frame as a deliberate composition, not a crop: the doll,
the confession, the stat line and the URL all need to read at a glance on a
phone held at arm's length.

## Safety — read carefully, do not strip this

This category gets shut down when it's used for abuse. Sarahah was pulled from
both app stores in 2018 over bullying; NGL settled with the FTC in 2024 for $5
million and was banned from serving anyone under 18. The existing safety
elements are deliberate and must survive:

- The "Report this" and "Block my address forever" links in the email mock.
  Keep them, and make them more prominent, not less.
- The warning about blind anonymous mail. **Keep the substance, rewrite the
  voice.** It currently reads like an engineering note printed above the send
  button ("Blind anonymous mail is what gets a domain blocklisted") — an
  internal deliverability observation shown to the user. Say the same thing in
  the product's own voice, at the right moment.
- **Add an 18+ age gate** as a first-run screen. Design it so it isn't a
  buzzkill — it's the first impression.
- Add a short, human line near the confession box about the line between funny
  and cruel. One sentence, in the product's voice, not a terms-of-service
  block.

Do not design anything that hints at or sells the identity of an anonymous
sender. That is specifically what the FTC fined NGL for.

## Hard constraints — these are not preferences

- **Edit `template.html`. Never edit `beatass.html`** — it's generated and any
  direct edit is destroyed by the next build. After every change run
  `python3 build.py`, then `npm test` before you call anything done.
- `npm test` is a real browser test. It checks layout at seven viewport sizes
  and verifies the generated GIF really starts with `GIF89a`. If you change
  the layout rules, update the test to match the new intent — don't delete it.
- Plain HTML, CSS and JavaScript in one file. **No React, no Tailwind, no
  bundler, no new dependencies.**
- **No emoji anywhere as icons.** Icons are hand-authored inline SVG in the
  `<defs>` block. Emoji were removed on purpose — they were the loudest
  "generated by AI" signal in the design. Any new icon you need, draw as SVG
  in the same hand-drawn style.
- **Nothing is a perfect rectangle.** Boxes use uneven `border-radius` values
  so no two corners match — that's what makes them read as pen-drawn. Keep it.
- **Three inks, three jobs:** ballpoint blue (`--ink`) for text, red pen
  (`--red`) for labels and annotations, highlighter yellow (`--hl`) for
  emphasis. Don't add a fourth accent without a reason you can state.
- Instagram DM sending was removed on purpose and stays removed — Instagram's
  API cannot cold-DM a handle. Don't add it back.

## What to deliver

1. The rebuilt `template.html`, built and tested.
2. Screenshots at 390×844 (phone) and 1440×900 (desktop) for every step of the
   flow.
3. A short note listing what you changed and why, and anything you chose not
   to change.

Design mobile-first. Show me the phone layout before the desktop one.
```

---

# PROMPT 2 — The growth loop (send after Prompt 1 ships)

```
Now change the direction of the product.

Read VIRAL-RESEARCH.md sections 1, 2 and 5 first.

Today the flow is outbound: I type someone else's email address and we send
them a confession they never asked for. That has no viral loop (one sender,
one recipient, zero new users) and it's the exact pattern that gets a domain
blocklisted.

Invert it, the way NGL and Sarahah did:

**Door A — the default.** I claim my own link (beatass.com/priya) and get my
own doll. I share the link. Friends open it, write a confession about me, and
beat or love MY doll. I get an inbox of confessions, each with its GIF. I post
the best ones to my Story with my link burned into the image. Their followers
click it, and the loop closes.

The recipient does the marketing, because they want the attention. Every share
is a recruitment ad.

**Door B — keep the current flow, make it safe.** Sending to a specific person
stays, but the email becomes a neutral "someone left you something at
beatass.com" with a link they choose to open — not the confession dumped into
their inbox. The page they land on offers them their own doll, so Door B
becomes an acquisition channel instead of a spam cannon.

This needs a backend, which does not exist today. Propose the smallest one
that works — I'd expect a single Cloudflare Worker with D1 and R2 — covering:
handle-to-owner mapping, message storage, GIF hosting, the notification email,
an enforced 18+ age gate, a word filter, rate limiting, per-message block and
report, and a one-tap kill switch for someone's own link.

Never fake a message to make the product look alive, and never sell or hint at
a sender's identity. Both are exactly what the FTC fined NGL for.

Give me the plan before you write any code.
```

---

## What to do, in order

| # | Step | Effort |
|---|---|---|
| 1 | `git init` + push to GitHub so there's a link to hand over | 10 min |
| 2 | Decide the two flags in VIRAL-RESEARCH.md §7 — the domain name, and the logo that currently reads as a gallows | your call |
| 3 | Paste **Prompt 1**. Review the phone screenshots first | 1–2 days |
| 4 | Ship the redesign, put it in front of ten real people, watch them use it without helping | 1 day |
| 5 | Paste **Prompt 2**, approve the plan, then build | 1–2 weeks |
| 6 | Age gate and moderation land **with** the loop, never after | — |
