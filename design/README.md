# beatass — Design System

The brand system behind **beatass.com**: write an anonymous confession about
someone, take it out on a hand-drawn voodoo doll, and the beating gets recorded
and sent to them.

Everything here is lifted from the real product source. No values were rounded,
snapped to a grid, or invented.

---

## 1. What the product is

One page. No server, no database, no accounts. You land on a sheet of feint-ruled
notebook paper, write a confession, and punch / pin / burn / love a stick-figure
doll hanging on a string. The doll's beating is recorded to a GIF with a stat
line burned into it — *"14 hits · 6 pins · burned"* — and that GIF rides along
with the confession in an email to the recipient.

**The doll is the product. The confession is the caption.** That sentence, from
the strategy doc, is the single most useful thing to know before designing
anything for this brand.

### Surfaces represented here

| Surface | What it is | Where it lives in this system |
|---|---|---|
| **The one-screen app** | logo, confession sheet, doll stage, tools, gauges, send bar | `ui_kits/beatass-app/` |
| **The email preview overlay** | a mock inbox on taped paper — the payoff moment | `ui_kits/beatass-app/` |
| **The sent overlay** | paper airplane, "It's gone." | `ui_kits/beatass-app/` |
| **The exported artifact** | 260×260 GIF, stat line + `beatass.com` burned in | `assets/sample.gif` |

There is exactly one product. It is a phone-first website — the redesign brief
assumes **90% of visitors are on a phone**.

---

## 2. Sources

Everything in this system was read from:

- **GitHub:** <https://github.com/luv-jeri/beatass> (branch `main`) — the whole
  product is one file, `template.html`. Worth exploring directly if you are
  building anything for this brand; the drawing engine in particular has no
  equivalent here.
- **Live build:** <https://luv-jeri.github.io/beatass/beatass.html>
- **Local mount:** `beatass/` — same tree.

Documents inside that repo that carry design authority, in order:

| File | What it settles |
|---|---|
| `CLAUDE.md` | House style. Three inks, no emoji, no perfect rectangles, the rule-alignment rule. |
| `README.md` | Build (`python3 build.py` → `beatass.html`), the GIF size decision, known limits. |
| `VIRAL-RESEARCH.md` | Why the UI is being changed and what must never change (anonymity, block/report). |
| `DESIGN-PROMPT.md` | The live redesign brief — the typography rule below comes from here. |

> **Do not edit `beatass.html`.** It is generated. `template.html` is the source.

---

## 3. Content fundamentals

### Voice

Lowercase, deadpan, and confident. It never explains the joke and it never
apologises for itself. The product is doing something slightly wicked and it
knows it — the tone is a friend raising an eyebrow, not a brand being zany.

**Real copy from the product:**

- `say the thing you'd never say` — the tagline
- `now take it out on him` — the doll's section label
- `pick something, then hit him` — the hint in the frame
- `hit him first!` — what you get for trying to send an untouched doll
- `It's gone.` / `They'll never know it was you.` — the sent screen
- `I've been holding this in for two years…` — the confession placeholder
- `Someone had to tell you, so it may as well be a stranger with a voodoo doll.`
  — the "roast" starter

### Casing

**Lowercase for the product's own voice. Sentence case for anything the user
must act on or read as fact.**

- Logo, tagline, section labels, hints, chips, field labels: **lowercase**
  (`their name`, `their email`, `grudge`, `secret crush`, `who's it for?`)
- Buttons: **Sentence case** (`Preview & send`, `Send it`, `Save GIF`, `Back`,
  `Send another`)
- Overlay headings and email copy: **Sentence case** (`It's gone.`)
- The impact words on the doll are the one exception: **ALL CAPS**, because
  they're comic-book sound effects — `POW`, `THWACK`, `BAM`, `OOF`, `WHAM`,
  `SMACK`, `OW`.
- Never ALL CAPS in email subject lines — the brief calls it out as a spam-filter
  trip. `REC 4.8s` and `dmg` / `love` are instrument labels, not copy.

### Person

**Second person, throughout.** The product talks to *you* about *them*.
`their name`, `their email`, `what do you want to say?`, `now take it out on
him`, `they'll never know it was you`. The doll is *him*. The recipient is
*they/them*. The product never says "we" except in the safety note, and never
says "I".

### Punctuation and length

- Ellipses do the work of a pause: `I've been holding this in for two years…`,
  `…and this is what they did to you.`
- Em-dashes and mid-dashes for the aside: `heads up —`, `prototype note —`
- Interpunct for the stat line: `14 hits · 6 pins · burned`
- Never more than one exclamation mark, and only in the hint (`hit him first!`)
- Errors are three or four words and blame nobody: `needs a name`,
  `that's not an email`
- Nothing is longer than a sentence except the safety note

### Emoji

**None. Anywhere. Ever.** From `CLAUDE.md`: emoji were removed on purpose
because they were the loudest "generated by AI" signal in the design. Every
icon is hand-authored inline SVG.

### Safety copy — the one place the voice softens

The product ships two pieces of safety writing and both are load-bearing, not
filler:

1. The note above the send button about cold-emailing a stranger.
2. `Report this` · `Block my address forever` in the email footer.

The brief's instruction is precise: **keep the substance, rewrite the voice.**
The current text (*"Blind anonymous mail is what gets a domain blocklisted"*) is
an engineering note leaking into the UI. Say the same thing in the product's own
register. Never make these smaller, never hide them, and never write anything
that reveals, hints at, or monetises a sender's identity — anonymity is
permanent.

---

## 4. Visual foundations

### The metaphor

A sheet of school exercise paper on a desk, drawn on in pen. Every design
decision descends from that: feint blue rules, a red margin line, paper grain,
ballpoint ink, highlighter, sticky notes, masking tape. Nothing is glassy,
nothing is a gradient, nothing is a card with a soft shadow and a 12px radius.

### Colour — three inks, three jobs

This is a hard rule from `CLAUDE.md`. **No fourth accent without a stated reason.**

| Token | Value | Job |
|---|---|---|
| `--ink` | `#26356e` | ballpoint blue — **all body text**, the doll's strokes, borders |
| `--red` | `#cf3a2d` | red pen — labels, annotations, errors, the primary button |
| `--hl` | `#ffe873` | highlighter yellow — **emphasis only**, never a fill |

Supporting marks, each with one job and no more:
`--ink-soft #5b6a9c`, `--ink-faint #93a0c2` (dotted underlines, empty gauge
tracks, placeholders), `--pencil #8d8778` (counts, captions, the string),
`--sticky #ffe9a3` (tone chips), `--hl-pink #ffb9cf` (**only** appears when Love
is on), `--tape rgba(226,214,178,.72)`, `--heart #e0507f`.

Paper: `--paper #fbf7ea` (the page), `--paper-2 #fffdf5` (a fresh sheet laid on
top — frames, cards, the canvas), `--rule #cddaea`, `--margin-line #e3a8a2`,
and `--desk #e8e0cc` — the surface the page lies on, visible only past the page
edge at desktop widths.

The mock inbox is deliberately **outside** the palette — `#ffffff`, `#1c2333`,
`#77809a`, `#ececec`. It is pretending to be Gmail, not pretending to be paper.
That contrast is the joke; do not "brand" it.

### Type — script for the fun, sans for the function

The redesign brief settles this and it overrides the current build:

> Script fonts for the fun bits only — the logo, the tagline, the sticker chips,
> the doll's POW/OW impact words, and the text burned into the video. Everything
> you actually have to read — field labels, inputs, buttons, body copy, errors —
> moves to a clean high-contrast sans at **16px minimum**.

| Face | Token | Used for |
|---|---|---|
| **Permanent Marker** | `--font-marker` | logo wordmark, section labels, impact words, the burned-in `beatass.com` |
| **Caveat** (400/700) | `--font-script` | tagline, field labels, the excitable voice |
| **Patrick Hand** | `--font-hand` | decorative marginalia only — never the confession |
| **System sans** | `--font-sans` | everything you have to read: **the confession itself**, tone chips, inputs, buttons, tool labels, gauges, errors, the whole mock inbox |

`--fs-ui: 16px` is the **floor** for functional text. The old build's 11–13px
script labels are the number-one complaint in the brief and are not reproduced
here — field labels, tool labels, button labels, gauge labels and errors are all
sans at 14–18px. Script survives where it earns its keep: the logo, the tagline,
the tone chips, the confession itself, and the POW/OW burned onto the canvas.

**Font substitution note:** the three handwriting faces are real, shipped
`.woff2` files copied from `beatass/fonts/` — no substitution. The product does
**not** name a specific sans; `template.html` uses the system stack
(`ui-sans-serif, system-ui, sans-serif`) for the mock inbox. This system keeps
that stack as `--font-sans`. **If there is a licensed brand sans, send it and
I'll swap it in.**

### The rhythm that everything hangs off

`--rule-h: 30px`. The page background is offset `4px` so handwriting baselines
land **on** the printed rules. Change body font-size or line-height and this
alignment breaks — re-measure. The confession textarea repeats the same 30px
rule in `--ink-faint`, and turns it `--red` when the field is wrong.

### Shape — nothing is a perfect rectangle

Every box takes four different corner radii with different x/y values, so no two
corners match and the edge reads as drawn freehand:

```
--radius-pen-lg   210px 16px 230px 14px / 14px 240px 16px 225px   frames, big cards
--radius-pen-md   220px 16px 230px 14px / 14px 235px 16px 225px   tool tiles
--radius-pen-btn  225px 18px 235px 16px / 16px 245px 14px 230px   buttons
--radius-pen-sm   9px 4px 8px 5px / 5px 8px 4px 9px               gauges, progress
```

Borders are pen widths, not hairlines: `2px` standard, `2.5px` on frames and the
primary button. Dotted `2px` `--ink-faint` under inputs, going **solid ink** on
focus and **solid red** on error.

Nothing sits perfectly straight either. The logo is rotated `-1.4deg`, the
tagline `+0.6deg`, overlay cards `+0.5deg`, and tone chips alternate
`+1.2deg` / `-1.6deg` by `:nth-child`, going to `-2deg` + `scale(1.05)` when
selected.

### Shadows

Two systems, and mixing them is a mistake.

- **Buttons cast a hard offset shadow with zero blur** — the flat drop-shadow of
  a doodle. `3px 4px 0 rgba(207,58,45,.3)` on red, `3px 4px 0 rgba(38,53,110,.28)`
  on ink, `2px 3px 0 rgba(38,53,110,.18)` on ghost.
- **Real objects lying on the desk get a soft blur** — a chip is
  `1px 2px 5px rgba(60,50,20,.16)`; a taped sheet is
  `1px 6px 20px rgba(40,36,26,.34)`.

Nothing else has a shadow. Inputs, frames, gauges and the canvas are flat.

### Backgrounds and texture

- Feint rules (`--bg-ruled`) at `--paper`, offset `4px` — **contained to a
  1240px page**, not painted across the viewport. Past that edge is `--desk`,
  and the page carries a `0 2px 26px rgba(60,50,20,.13)` shadow so it reads as a
  sheet lying on a desk. (The brief flags the old edge-to-edge treatment as
  wallpaper; this is the fix.) On a phone the page IS the viewport, so the desk
  and the shadow disappear.
- A 2px `--margin-line` down the left of the page at `left: 30px`, with content
  starting to the right of it.
- A fixed SVG turbulence grain over everything at `.45` opacity — greyscale
  fractal noise, 160×160, tiled. This is what stops the flats looking digital.
- Inside the doll frame, a 22px squared grid in `--rule` at `.55` alpha.
- Radial glows appear on the canvas only: warm orange `rgba(255,150,40,.22)`
  when burning, pink `rgba(255,120,175,.18)` when loved.

No gradients anywhere in the UI layer. The only gradients in the product are
radial particle glows painted on canvas.

### Motion

Fast, small, and physical. Nothing eases slowly.

| What | Duration / curve |
|---|---|
| Button press | `.12s` |
| Tool selection | `.14s` |
| Error appearing | `.15s` |
| Gauge filling | `.2s` |
| Hint fading | `.3s` |
| Overlay arriving | `.25s cubic-bezier(.2,.9,.3,1)` — a pop, from `translateY(12px) rotate(.6deg)` |
| Scrim | `.2s` linear fade |
| REC dot | `1s` infinite blink to `.15` opacity |

And the one that defines the brand: **the boil.** Every stroke of the doll is
drawn *twice* with a random wobble, and the wobble is re-rolled every **110ms**
(~9 times a second). That is what stops him looking like clip art. It is the
single most important animation in the product.

### Interaction states

- **Hover (buttons):** lift and tilt — `translate(-1px,-2px) rotate(-.5deg)`,
  shadow grows to `5px 7px 0`.
- **Press (buttons):** `translate(1px,2px)`, shadow collapses to `1px 1px 0`.
  The button physically lands on the paper.
- **Hover (tools):** a `--ink-faint` border appears where there was none.
- **Selected (tools):** red border, red label, red icon, and a
  `rgba(255,232,115,.55)` highlighter wash behind.
- **Selected (chips):** pink, rotated `-2deg`, scaled `1.05`.
- **Focus (inputs):** dotted underline goes solid ink.
- **Error:** underline and rule lines go red, a red script message fades in
  below, and it **clears the instant you start typing again**.
- **Disabled:** `opacity .4`, no shadow, `not-allowed`.

### Transparency and blur

Used exactly twice: the overlay scrim (`rgba(34,30,22,.66)` + `blur(3px)`) and
the highlighter wash behind a selected tool. Nowhere else. There is no
frosted-glass surface in this product.

### Layout

- One column max `1240px`, page padding `clamp(14px,2.5vw,34px)`.
- Desktop is a two-column grid, `minmax(0,1fr) minmax(0,1.02fr)` — the doll's
  column is very slightly wider.
- Under `820px` it stacks to one column.
- Fixed elements: the margin line and the grain, both `pointer-events:none`,
  both `z-index:0`. The app sits at `z-index:1`, overlays at `20`.
- **Phone (default): one page, scrolling allowed.** Header, then the doll as the
  hero, then the four tools and the gauges in the thumb zone directly under it,
  then the confession, then the recipient's name and email last. The send button
  is `position:fixed` at the bottom and visible at all times, over a 2px ink
  rule with `env(safe-area-inset-bottom)` respected. Nothing is ever cramped —
  a small scroll is cheaper than tiny text.
- **Desktop (≥820px): one screen, no scroll.** The same pieces reflow into two
  columns and the send bar returns to static flow at the foot of the page.

### Imagery

There is no photography and there are no illustrations as assets. The only
imagery the product produces is the **exported GIF** — a hand-drawn stick figure
on `--paper-2`, warm and pale, with a hard-ink stat line burned across the
bottom. `assets/sample.gif` is the real one from the repo.

---

## 5. Iconography

**Hand-authored inline SVG, in one `<defs>` block, referenced by `<use>`.**
No icon font, no icon library, no emoji, no Unicode glyphs standing in for icons.

Every icon in the product has been copied into `assets/icons/` verbatim from
`template.html`:

| File | Symbol id | Used for |
|---|---|---|
| `fist.svg` | `#i-fist` | Punch tool |
| `pin.svg` | `#i-pin` | Pins tool |
| `flame.svg` | `#i-flame` | Burn tool |
| `heart.svg` | `#i-heart` | Love tool |
| `plane.svg` | `#i-plane` | the sent screen |
| `doll.svg` | `#i-hang` | the logo mark |
| `sprite.svg` | all six | drop-in `<defs>` sprite — inline it and use `<use href="#i-fist">` |

House style for drawing a new one, read off the existing set:

- `fill: none`, `stroke: currentColor` — icons inherit ink colour, always.
- Stroke width **2.1–2.2** on the 32×32 tool icons, **2.4–2.8** on the larger
  150-unit marks.
- `stroke-linejoin: round`; `stroke-linecap: round` on open strokes.
- Two viewBox sizes only: `0 0 32 32` for tools, and a tall/wide 150-unit box for
  the illustrative marks.
- Deliberately imperfect geometry — the fist is a lumpy 20-point star, not a
  clean shape. Nothing is symmetrical.
- Rendered at `clamp(19px,2.8vh,25px)` in the toolbar.

### The logo

`assets/logo.svg` is the product's current mark: a stick figure with a string
running to the top of the frame, beside the `beat`+`ass` wordmark in Permanent
Marker with `ass` in `--red`, the whole lockup rotated `-1.4deg`.

> ⚠️ **This mark is flagged for redrawing and I have not redrawn it.**
> `VIRAL-RESEARCH.md` §7 and the brief both note the string currently attaches
> at the neck, so it reads as a hanging rather than a puppet. The fix is to
> attach the string to the doll's **back or head**. I copied the existing mark
> rather than inventing a replacement — **send the redrawn mark and I'll swap it
> in everywhere.**

---

## 6. Index

```
styles.css                    the one file consumers link — @imports only
thumbnail.html                homepage tile
assets/brand/                 identity: doll character (6 states, master with named groups), lockups, wordmark, favicons, email + social art — see Brand Board.html & Character Sheet.html
tokens/
  fonts.css                   @font-face for Hand / Scrawl / Marker
  colors.css                  three inks + paper + inbox + glows + semantic aliases
  typography.css              families, size ladder, line heights, type roles
  spacing.css                 spacing scale, the 30px rule rhythm, fluid gaps
  shape.css                   the four pen radii, stroke widths, tilt angles
  elevation.css               hard doodle shadows vs soft desk shadows
  motion.css                  durations, the pop curve, the 110ms boil
  paper.css                   ruled backgrounds, grain, canvas grid
assets/
  fonts/                      PatrickHand.woff2, Caveat.woff2, Marker.woff2
  icons/                      the six hand-drawn SVGs + sprite.svg
  logo.svg                    the current mark (flagged for redraw)
  sample.gif                  a real export from the product
guidelines/                   foundation specimen cards
components/                   the reusable primitives (see below)
templates/confession/         the starting template consuming projects copy
ui_kits/beatass-app/          the full product recreation
SKILL.md                      agent-skill entry point
github.md                     source-repo association
```

### Components

Grouped by concern. Every one has a counterpart in `template.html`; nothing here
was invented.

**`components/brand/`** — `Logo`, `Icon`, `Tagline`, `Highlighter`, `PaneLabel`
**`components/controls/`** — `Button`, `ToolButton`, `ToneChip`
**`components/forms/`** — `PaperField`, `ConfessionSheet`
**`components/feedback/`** — `Gauge`, `ProgressBar`, `RecBadge`, `SafetyNote`
**`components/surfaces/`** — `PaperFrame`, `TapedCard`, `Overlay`
**`components/product/`** — `MailPreview`

**Intentional additions** (not one-to-one with a source class, and why):

- **`Icon`** — a thin `<use href="#i-…">` wrapper. The source repeats the same
  four-line `<svg><use/></svg>` at every call site; a wrapper stops consumers
  hand-writing SVG and drifting off the stroke rules.
- **`Highlighter`** — the source implements the highlighter as a `::before` on
  `.tagline .hl`. Pulled out as its own component because the emphasis rule
  ("highlighter yellow, emphasis only") applies far beyond the tagline.

### Template

`templates/confession/` — **Confession page**. The one-screen flow as a starting
point a consuming project can copy: paper page, doll hero, the four tools, the
gauges, the confession, the recipient, and the pinned send bar. It ships with
`doll-stage.js`, which wraps the drawing engine as a `<doll-stage>` custom
element (attributes `tool` / `burn` / `love`, events `beatass-touch` and
`beatass-hit`) so the doll drops into any page without porting the engine.

### UI kit

`ui_kits/beatass-app/` — the whole product, click-through: fill the form, pick a
tone, hit the doll (real physics, real boil), watch the gauges fill, preview the
email, send it. Screens: `AppScreen`, `MailPreviewScreen`, `SentScreen`, and
`DollCanvas` — a faithful port of the drawing engine, including `sLine`,
`sCircle`, `sPath` and the 110ms boil.

---

## 7. What I could not do

- **The logo.** Flagged for redraw; copied as-is rather than invented. See §5.
- **The brand sans.** Not specified anywhere in the source; using the system
  stack. See §4.
- **MP4 export and Web Share.** Both in the brief, neither in the source yet, and
  neither is represented here. `navigator.vibrate` **is** wired — it fires on
  every punch and pin.
- **The logo's puppet-string fix**, as above.
- **A real Android device.** The doll now draws heavier strokes plus accumulating
  damage marks on top of the existing double-stroke boil, so there is more per
  frame than the source had. It is smooth in every browser I can reach, but the
  brief's "test on a cheap Android" is not something I can verify. If it
  stutters, drop the boil rate (110ms → 160ms) before dropping any effect.
