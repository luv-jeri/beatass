# Story 001 Part 1 - V2 storyboard (rebuild after v1 rejection, 2026-08-03)

V2 rules (Sanjay's feedback, non-negotiable):
- NO full-screen text-card scenes. Every second of screen time is generated
  imagery. All text (hook, confession lines, cliffhanger) is rendered as
  captions/overlays ON TOP of video in Remotion.
- Female emotional narrator (voice picked from samples in `vo/samples/`).
- Music follows the story's mood arc + a sound-effects layer on the beats.
- Every still/clip keeps the BOTTOM FIFTH of the frame completely black and
  empty - the Flow watermark lives there and Remotion crops that band off.
- Cinematic letterbox bars top and bottom, added in Remotion (not generated).
- Generation volume is not a constraint: more takes, pick the best.

Style: NOIR-CONFESSION, unchanged. Attach `NOIR-CONFESSION-ref_001.png` to
every still generation. Stills via ChatGPT (browser automation approved),
clips via Flow image-to-video 9:16 (browser automation approved), serial,
one render at a time, supervised per `research/09-flow-automation-design.md`.

## VO script v2 (female read, eleven_v3 emotion tags inline)

In 2013, a man confessed to murder... in a meme. [sighs] Reddit had a running
joke called Confession Bear. A sad bear. A small, embarrassing secret. "I fart
and blame the dog." That kind of thing. Then one night, a user called Narado
posted his own. [whispers] Top line: my sister's boyfriend was violent, and on
drugs. Bottom line: so I ended his life... and nobody ever knew. It was ruled
an overdose. He titled it: "finally have the guts to say it." Ten thousand
upvotes. Three thousand comments. Everyone asking... is this a joke? [whispers]
Then Narado himself replied. One sentence.

Overlay text (Remotion captions, never generated into frames):
- Hook over S1: `In 2013 a man confessed to murder... in a meme.` + `TRUE STORY - 2013`
- Confession lines over S5/S6 as word-synced captions (they are IN the VO).
- Cliffhanger over S9 tail: `"There is SOME truth behind it."` -> `PART 2: the internet hunts him down`

## Scene list (9 scenes, timing draft until new VO alignment)

| # | Slug | VO section | Draft slot |
|---|---|---|---|
| S1 | 01-cold-open | "In 2013... in a meme." (hook overlay) | 0-4s |
| S2 | 02-bear-meme | "Reddit had a running joke..." | 4-10s |
| S3 | 03-silly-secrets | "I fart and blame the dog..." | 10-15s |
| S4 | 04-night-post | "Then one night... posted his own." | 15-21s |
| S5 | 05-the-words | "Top line: my sister's boyfriend..." | 21-27s |
| S6 | 06-ink-bleed | "Bottom line: so I ended his life..." | 27-33s |
| S7 | 07-case-closed | "It was ruled an overdose... guts to say it." | 33-38s |
| S8 | 08-explosion | "Ten thousand upvotes... is this a joke?" | 38-44s |
| S9 | 09-one-reply | "Then Narado himself replied. One sentence." | 44-49s |

S2/S4/S8/S9 are regenerations of the four v1 scenes (v1 clips lack the bottom
band and scene-1 was 720p). S1/S3/S5/S6/S7 are new. No death depiction
anywhere (S7 is a closing case folder, not a body) - framing rules in
`../../STORY-001-CONFESSION-BEAR.md` still bind.

## STILL prompts (ChatGPT, style board attached, 9:16)

Every prompt ends with the same two framing lines - keep them verbatim:
top third dark and empty for captions; bottom fifth of the frame completely
black and empty, nothing placed there.

### S1 still - cold open, the bear's eyes
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: an extreme closeup
of a gentle sad-eyed cartoon bear's face drawn in heavy ink, filling the
middle of the frame, a cold blue glow rising from below and carving the eyes
out of darkness, rough paper grain visible. No readable text, no logos.
Top third dark and empty for captions. Bottom fifth of the frame completely
black and empty, nothing placed there.
```

### S2 still - the bear meme card
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: a gentle sad-eyed
cartoon bear drawn in ink sits inside a floating meme card, centered in
darkness, softly lit from the card itself, two or three small harmless
doodles floating near it. Card in the middle of the frame. No readable text,
no logos, no visible faces except the cartoon bear. Top third dark and empty
for captions. Bottom fifth of the frame completely black and empty, nothing
placed there.
```

### S3 still - silly secrets
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: the same floating
meme card seen slightly from the side, surrounded by a small cloud of playful
hand-inked doodles - a dog, a sock, a slice of pizza, tiny stars - like
harmless little secrets orbiting it, the mood light but the darkness around
still deep. No readable text, no logos. Top third dark and empty for
captions. Bottom fifth of the frame completely black and empty, nothing
placed there.
```

### S4 still - the hooded figure posts
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: an adult hooded
figure in an oversized hoodie sits alone at a small desk in a dark bedroom
at 2am, seen from behind over the shoulder, face fully hidden, one monitor
casting the only light onto hands and desk, the room dissolving into
cross-hatched darkness. Figure centered in the middle of the frame. No
readable screen text, no logos, no visible face. Top third dark and empty
for captions. Bottom fifth of the frame completely black and empty, nothing
placed there.
```

### S5 still - the words are typed (NEW, replaces the v1 text card)
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: an extreme closeup
of two hands on a keyboard in near-darkness, lit hard from one side by cold
monitor light, deep cross-hatched shadow, and above the hands a faint card
shape beginning to glow with unreadable smudged ink strokes, as if words are
burning onto it. No readable text, no logos, no faces. Top third dark and
empty for captions. Bottom fifth of the frame completely black and empty,
nothing placed there.
```

### S6 still - the ink bleeds (NEW, replaces the v1 text card)
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: the sad-eyed bear's
floating meme card centered in darkness, heavy black ink beginning to bleed
down over the card from its top edge like a slow stain, the bear's face half
swallowed by the dark, the cold blue light dimming. No readable text, no
logos. Top third dark and empty for captions. Bottom fifth of the frame
completely black and empty, nothing placed there.
```

### S7 still - case closed (NEW, replaces the v1 text card)
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: a single worn
cardboard case folder lying on a dark surface, lit by one cold overhead
shaft of light, its cover slightly lifted with unreadable smudged pages
inside, dust hanging in the light, everything else cross-hatched darkness.
No readable text, no badges, no logos, no faces. Top third dark and empty
for captions. Bottom fifth of the frame completely black and empty, nothing
placed there.
```

### S8 still - the post explodes
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: one glowing card
hangs centered in darkness with a handful of small arrows and two speech
bubbles just beginning to appear around it, the crowd of shapes clearly
about to grow. Card centered in the middle of the frame. No readable text,
no logos, no faces. Top third dark and empty for captions. Bottom fifth of
the frame completely black and empty, nothing placed there.
```

### S9 still - the one reply
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: a dense frozen
storm of dark speech bubbles filling the frame mid-air, all dimmed, and one
single brighter bubble just beginning to rise from the bottom center of the
composition, glowing with the cold accent light. No readable text, no logos,
no faces. Top third dark and empty for captions. Bottom fifth of the frame
completely black and empty, nothing placed there.
```

## Next after approval

1. Update the motion-builder pack (9 action blocks, style lock verbatim,
   `pack.py --check`) - motion prompts for Flow come from there.
2. Full VO in the picked voice + new alignment JSON.
3. Automated generation run (ChatGPT stills -> Flow clips), serial, supervised.
4. Music arc (2 Lyria clips crossfaded) + SFX layer (ElevenLabs sound-effects
   endpoint - verify it live first).
5. Remotion: letterbox bars, bottom-band crop in ClipPlayer, new beats.md ->
   sync.py -> render (never pipe the render through tail).
