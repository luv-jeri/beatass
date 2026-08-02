# Claude Design brief — Instagram post, story and reel templates (5 tones)

Copy everything below the line into the SAME Claude Design project that holds
the beatass design system, so it inherits the tokens and the doll. When it's
done, trigger a handoff export with the templates page open.

---

## What this is for

beatass.com lets someone type the thing they'd never say to a person's face,
take it out on a small plush voodoo doll, and email it to that person
anonymously. Our Instagram (@_beatass_) posts real confessions. The current
feed post template is weak and I want a proper family of templates.

Before writing anything, look at the existing design system in this project —
paper, inks, the doll, the wordmark. Everything you make must be unmistakably
the same brand.

## What's wrong with the current post (fix all of this)

- The message card floats in the top half with a sea of empty paper below —
  no visual anchor, the eye falls off the bottom.
- The doll is tiny, shoved in a corner, and unrelated to the message — he
  reads as a logo, not as the guy who took this beating.
- Everything is the same visual volume: wordmark, annotation, message, footer
  all whisper. Nothing punches. On a phone feed at thumbnail size it reads as
  "beige rectangle".
- The layout doesn't change with the message — a 6-word roast and a
  4-line apology get the identical composition.

## The job

Three template types, each in five tone variants. The tones are the chips the
sender picks on the site, and each tone should feel different at a glance
while staying one family:

| Tone | Feel | Doll state to use |
|---|---|---|
| secret crush | soft, giddy, a note passed in class | loved (heart eyes) |
| grudge | tight, controlled anger, underlines pressed too hard | hurt (X eyes) |
| apology | quiet, sincere, more white space, smaller voice | flinch |
| roast | loud, gleeful, big type, the funniest one | panic |
| thank you | warm, plain, disarmingly earnest | default (just arrived) |

Tone can change: paper tint within the palette, which doll state appears, the
sticker/annotation set (hearts vs pins vs flames vs stars), type scale, how
hard the highlighter is used. Tone must NOT change: the fonts, the core
palette, the hand-drawn wobble, the wordmark.

### 1. Feed post — 1080×1350

The message IS the poster. It should own ~60% of the canvas, set big enough
that a 5-word message still fills the space (auto-scale type: short = huge,
long = smaller, both look deliberate). The doll interacts with the message —
peeking over the card's edge, holding a corner, slumped under it — not parked
in a corner. Wordmark small but readable; "anonymous, obviously" or a
tone-specific annotation in red script; beatass.com bottom edge.

### 2. Story — 1080×1920

Same DNA, vertical. Safe zones: keep everything important out of the top 250px
and bottom 350px (Instagram UI covers those). One extra element the post
doesn't have: a spot near the bottom for a "send yours → beatass.com" line
sized like a link sticker sits on top of it.

### 3. Reel cover + frame kit — 1080×1920

We record the doll actually being beaten (we already have that as video). The
reel template is: a cover frame (tone-styled, message teaser + doll), a
lower-third card that holds the message WHILE the beating video plays behind
it, and an end card ("say the thing you'd never say — beatass.com"). Design
these as three still layouts; we animate them in code.

## Hard rules

- Colors, exactly: ink `#26356e`, paper `#fbf7ea`, plush `#fffdf5`, red
  `#cf3a2d`, blush `#e0507f` (~30%), highlighter `#ffe873`, pencil `#8d8778`.
- The three fonts already in the system (marker for the wordmark, hand script
  for annotations, print-hand for messages). No new fonts.
- Hand-drawn wobble everywhere; nothing perfectly straight, no two corners
  alike. No gradients, no shadows softer than a pencil could make, no emoji,
  nothing glossy.
- The message text must be a REAL text layer we can swap programmatically —
  never baked into artwork. Same for the sender's tone annotation.

## Delivery format (half the job)

- Each template as a clean HTML/CSS prototype at exact pixel size, message
  text in one clearly-marked element (`id="message"`), tone annotation in
  another (`id="annotation"`), so a script can inject any message and
  screenshot it.
- The five tone variants of each template as five body classes on the same
  HTML (`class="tone-crush"`, `tone-grudge`, `tone-apology`, `tone-roast`,
  `tone-thanks`) — one file per template type, not twenty-five files.
- Any new sticker/scribble art (hearts, flames, stars, pin clusters) as
  separate small SVGs with named groups, same style as the doll.

## What NOT to do

- No stock-photo energy, no Canva-template symmetry, no rounded-rectangle
  app-UI look. It's a page from a notebook that got out of hand.
- Don't redesign the doll or the wordmark — they're locked.
- Don't put the full confession in tiny type to make room for decoration.
  The words are the product; decoration serves them.
