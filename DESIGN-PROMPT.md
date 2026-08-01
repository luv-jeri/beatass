# The prompt to hand to Claude

Two prompts.

- **Prompt 1 — Redesign.** Runs entirely in the browser, needs no server, ships
  on its own. Paste this first.
- **Prompt 2 — Make it actually send.** Email delivery, file storage, and the
  personal link. Comes after.

Both already have every decision baked in. Just copy and paste.

---

# PROMPT 1 — Redesign

```
Here is the codebase: https://github.com/luv-jeri/beatass
Live version: https://luv-jeri.github.io/beatass/beatass.html

Read README.md and CLAUDE.md first — they explain the build, the house style,
and which decisions were made deliberately. Then read VIRAL-RESEARCH.md for the
strategy behind this brief. Then open the live link ON A PHONE and actually use
it before changing anything.

## What this is

beatass is a website where you write an anonymous confession about someone,
take your feelings out on a hand-drawn voodoo doll, and the beating gets
recorded and sent to them by email.

The drawing engine is genuinely good — the doll hangs on real pendulum physics,
and every stroke is drawn twice with a wobble re-rolled nine times a second so
it reads as hand-drawn rather than clip art. Keep all of that. The problem is
the interface around it.

## The goal

Understood in five seconds, fun within ten, finished in under a minute, and it
produces something worth posting. **Assume 90% of visitors are on a phone.**
Design the phone first and show me that layout before the desktop one.

## Fix all of these

**1. It's hard to read.** Section labels are 13px, the damage/love gauges are
10px bars with 11px labels, and the tool buttons are a thin toolbar. Handwriting
fonts (Caveat, Permanent Marker) at 11–13px cannot be read comfortably. This is
the number one complaint.

Fix: **script fonts for the fun bits only** — the logo, the tagline, the sticker
chips, the doll's POW/OW impact words, and the text burned into the video.
Everything you actually have to read — field labels, inputs, buttons, body copy,
errors — moves to a clean high-contrast sans at **16px minimum**. The charm must
come from the drawing, not from setting form labels in a script face.

**2. The no-scroll rule is the root cause.** Today the page is forbidden from
scrolling at all, which is *why* everything has to be tiny, and why the
confession box collapses to three lines on a phone — you cannot write a
two-year-old secret in three lines.

Fix: **one single page, a little scrolling allowed on phones, no multi-step
wizard.** Friction is the enemy: fewest possible taps, no page switching, no
"next" buttons. But nothing should ever be cramped or unreadable again. A small
scroll is cheaper than tiny text.

**3. Nothing is a hero.** There's no focal point, so the eye has nowhere to
land and the page reads as busy but empty. On a phone, **the doll should be the
first thing above the fold** — it's the only reason anyone stays. The
confession box sits below it, and the recipient's name and email come last,
just before sending. Keep the send button visible at all times so it's never
hunted for.

**4. The doll is passive.** Thin strokes, blank face at rest, sitting still in
a big empty frame. Nothing about it invites a punch — which is why there has to
be hint text explaining that it's interactive.

Fix: make it read as *hittable* on sight. Bigger, heavier strokes, an
expression, idle movement, a clear invitation. Make impact feel good: real
weight, a bigger reaction, and damage that visibly accumulates and stays.

**5. The four tools are a toolbar, not a choice.** Punch / Pins / Burn / Love
are four near-identical small items. They should feel like four distinct,
tempting options, each looking and *feeling* different when used.

**6. The gauges are invisible.** The damage and love bars are the feedback for
the main interaction. Make them legible and satisfying to fill.

**7. The paper background is noise at desktop width.** Blue rules run edge to
edge across the whole viewport including the empty margins, and the red margin
line floats at an arbitrary position. Contain it so it reads as a page, not
wallpaper. (`--rule-h` is 30px and the body background is offset 4px so text
sits on the rules — if you change body font-size or line-height, re-measure
that alignment.)

**8. No proof, no example.** A first-time visitor is asked to make something
without ever seeing what the finished thing looks like. Show a looping example
early — that IS the pitch.

**9. The logo reads as a hanging.** It's currently a stick figure suspended
from a rope round its neck. Redraw so the string clearly attaches to the doll's
back or head as a *puppet*. Same charm, different joke.

## Mobile specifics — this is a phone product

- **Thumb zone.** Doll in the top two-thirds, all controls in the bottom third
  where a thumb reaches one-handed.
- **Punchable with a fat thumb**, not a mouse pointer. The current
  `cursor: crosshair` is desktop thinking. Generous hit areas.
- **Vibrate on every hit** — `navigator.vibrate()`. One line, and it makes
  punching feel dramatically better on Android. (iPhone browsers won't; fine.)
- **Test on a cheap Android**, not a flagship. The doll redraws every stroke
  twice at 60fps plus particles — smooth on a good phone, can stutter on a
  £120 one. If it does, drop the boil rate before dropping the effect.

## The two exports — you need BOTH

**A) The GIF, for email.** Roughly what exists today: small (260×260, ~600 KB)
so it survives an inbox. Animated GIFs work in Gmail. Keep this.

**B) An MP4 video, for Instagram and Snapchat.** This is new and it is the most
important technical point in the brief.

**Instagram Stories and Snapchat do not accept animated GIF uploads.** Hand
either one a `.gif` and it posts as a frozen still image — the doll never moves
and the whole thing is pointless. The social export must be a **video**.

Watch out: the browser's built-in recorder produces **MP4 on iPhone** but
**WebM on older Android Chrome**, and Instagram rejects WebM. So:

1. Check `MediaRecorder.isTypeSupported('video/mp4')` first. If true, use
   `canvas.captureStream()` + `MediaRecorder` — no library needed at all.
2. If false, fall back to `WebCodecs` (`VideoEncoder`, H.264) plus a small MP4
   muxer vendored into `vendor/` exactly like gif.js already is.
3. Either way the output must be a real `.mp4`. Verify on a real Android phone.

Shape it **1080×1920 (9:16)** — the Instagram and Snapchat Story shape. Design
that vertical frame as a deliberate composition, not a crop: the doll, the
confession text, the stat line ("14 hits · 6 pins · burned") and `beatass.com`
all need to read at a glance on a phone held at arm's length.

**Record while they play, not after.** The recorder can capture the canvas live,
so the video is finished the moment they stop hitting. That deletes the "making
your gif…" wait screen entirely — and that wait is exactly where people quit.

**Have the file ready before the Share button is tapped.** Phones only allow
sharing as a direct response to a tap, so encoding cannot start on the tap.

## The final screen

Today the flow dead-ends at "It's gone. They'll never know it was you." That
screen is where all the sharing has to come from. Design it properly:

- The video, large and looping.
- **One Share button** using the Web Share API with the file attached, so the
  phone's own share sheet opens with Instagram, Snapchat and WhatsApp already
  in it. No instructions, no save-then-re-upload.
- **Save** and **Copy link** alongside it.
- A one-line invitation to make another.

## The email — this is the main product, make it excellent

The preview overlay is the payoff moment. Right now it's a plain mock. It needs
to be the best-looking thing in the product, because it's what the whole
experience builds to.

- **The email carries the full confession text**, inline, plus the GIF. This is
  a deliberate product decision — do not change it to a link-only notification.
- **The subject line must be catchy and curiosity-driven**, personalised with
  the recipient's name. Write 5–8 options and show them to me. Think
  "Priya, someone finally said it" rather than "You have a new message."
  Avoid ALL CAPS and multiple exclamation marks — those trip spam filters.
- Make the preview feel like a real inbox, and make the moment of pressing send
  feel like a decision.

## Safety — keep this, do not strip it

- Keep the **"Report this"** and **"Block my address forever"** links in the
  email. Make them clearer, not smaller.
- The existing warning above the send button currently reads like an
  engineering note printed at the user ("Blind anonymous mail is what gets a
  domain blocklisted"). **Keep the substance, rewrite the voice** — say it in
  the product's own tone, at the right moment.
- Add one short human line near the confession box about the line between funny
  and cruel. One sentence, in the product's voice, not a legal block.
- **Never design anything that reveals, hints at, or sells a sender's
  identity.** Anonymous is permanent.

**Decisions already taken — do not add these:** no age gate or age
verification screen (an "18+" note in the footer is the extent of it), and no
change to the domain name. Both were considered and deliberately declined.

## Hard constraints — not preferences

- **Edit `template.html`. Never edit `beatass.html`** — it's generated, and any
  direct edit is destroyed by the next build. After every change run
  `python3 build.py`, then `npm test`, before calling anything done.
- `npm test` is a real browser test across seven viewport sizes that also
  verifies the generated GIF really starts with `GIF89a`. If you change the
  layout rules, **update the test to match the new intent — don't delete it.**
  Add a check for the MP4 export too.
- Plain HTML, CSS and JavaScript in one file. **No React, no Tailwind, no
  bundler.** The only new dependency permitted is the MP4 muxer, vendored into
  `vendor/` and inlined at build time exactly like gif.js.
- **No emoji anywhere as icons.** Icons are hand-authored inline SVG in the
  `<defs>` block. Emoji were removed on purpose — they were the loudest
  "generated by AI" signal in the design. Draw any new icon in the same style.
- **Nothing is a perfect rectangle.** Boxes use uneven `border-radius` values so
  no two corners match. That's what makes them read as pen-drawn. Keep it.
- **Three inks, three jobs:** ballpoint blue (`--ink`) for text, red pen
  (`--red`) for labels and annotations, highlighter yellow (`--hl`) for
  emphasis. No fourth accent without a stated reason.
- Instagram DM sending was removed on purpose and stays removed — Instagram's
  API cannot cold-DM a handle.

## Deliver

1. The rebuilt `template.html`, built and tested.
2. Screenshots of every screen at 390×844 (phone) and 1440×900 (desktop).
3. The 5–8 subject line options.
4. A short note on what you changed, what you chose not to change, and anything
   you couldn't verify without a real Android device.
```

---

# PROMPT 2 — Make it actually send

```
Now make it real. Nothing is currently stored or sent.

Build the smallest backend that does the job. Constraint: keep running costs as
close to zero as possible — everything that can happen in the user's browser
already does.

**Storage.** The GIF and MP4 are made on the client, then uploaded. Use
**Cloudflare R2** (cheapest — no charge for downloads) or Firebase Storage.
Note: Firestore is a database with a 1 MB document cap, so files cannot go
there. **Auto-delete files after 30 days** — nobody rewatches a confession a
month later, and this turns a growing bill into a flat one.

**Email.** The email carries the full confession text inline plus the GIF, with
a catchy personalised subject. Use a reputable sending provider.

Before sending a single message, set up **SPF, DKIM and DMARC** on
beatass.com. These are free DNS records. Without them this mail goes straight
to spam regardless of anything else, and with the confession inline the
reputation risk is real — so also wire up: instant honouring of "Block my
address forever", a working "Report this", rate limiting per sender, and
bounce/complaint handling that stops sending to an address that has complained.

**The personal link (lower priority — build it last).** A user can claim
beatass.com/their-name, share it, and receive anonymous confessions about
themselves. They see them in an inbox and can choose to share any one to their
Story from our page. No accounts and no passwords — magic link or OTP only, one
field.

**A trick worth taking.** For the inbox, don't store video files. The doll's
performance is just a short list of instructions — "punched here, 6 pins, on
fire for 2 seconds" — about 500 bytes. Store that, and let the recipient's own
phone redraw the animation at full quality. Roughly 4,000× cheaper than storing
video, and better quality.

This requires one change: the doll currently uses `Math.random()` for the
wobble and sparks, so it draws differently every time. Replace it with a seeded
random number generator and store the seed alongside the instructions. Build
this in from the start — retrofitting it is painful.

**Never fake a message** to make the product look busy, and **never reveal or
hint at a sender's identity.** The FTC fined NGL $5M for exactly those two
things.

Give me the plan before writing any code.
```

---

## Where things stand

| Decision | Answer |
|---|---|
| Direction | Email to a specific person is the main product; personal link added later, lower priority |
| Accounts | None — magic link or OTP at most |
| Who sees confessions | Only the recipient; they choose whether to share to a Story |
| Email contents | **Full confession inline**, catchy personalised subject |
| Age limit | **None** — 18+ note in the footer only |
| Anonymity | Permanent. Never revealed, never hinted at, never sold |
| Fake messages | Never, not once |
| Block & report | Yes, on every message |
| Shared artifact | 9:16 video of the doll, with the confession, stat line and beatass.com |
| Sharing | One Share button → the phone's native share sheet |
| Domain | **beatass.com**, keeping it |
| File storage | Cloudflare R2 (or Firebase Storage), auto-delete after 30 days |
| Layout | Single page, small scroll allowed, fewest possible taps |
| Fonts | Handwriting for the fun bits, clean readable sans for everything else |
| Logo | Redrawn so the string attaches to the doll's back, not its neck |
