# Story 001 Part 1 "The meme" - production prompts

Locked style: NOIR-CONFESSION (graphic-novel noir). Reference board: `NOIR-CONFESSION-ref_001.png` in this folder. Pack validated 2026-08-03 (`story-001-part-1.pack.md`, motion-builder).

## The workflow (per scene, 2 steps)

STEP A - make the start frame (ChatGPT, your Pro sub): open ONE conversation, upload `NOIR-CONFESSION-ref_001.png` once, then paste each STILL prompt below. 9:16. Generate 2-3, pick the best, download as `frames/scene-N.png`.

STEP B - animate it (Flow): image-to-video mode, attach that scene's still as the start frame, paste the scene's MOTION prompt below, 9:16, 8 seconds. Generate 2 takes, keep the better one as `clips/scene-N.mp4`.

Then: VO (one track, script below), music (Suno, dark ambient instrumental), assembly with hook/cliffhanger cards + captions (Remotion template - next build). The hook and cliffhanger cards are NOT generated; they are made in the edit.

## VO script (record/generate as ONE track, ~30s)

In 2013, a man confessed to murder... in a meme. Reddit had a running joke called Confession Bear. A sad bear, a small embarrassing secret. "I fart and blame the dog." That kind of thing. Then one night, a user called Narado posted his own. Top line: my sister's boyfriend was violent and on drugs. Bottom line: so I ended his life, and nobody ever knew. It was ruled an overdose. He titled it "finally have the guts to say it." Ten thousand upvotes. Three thousand comments. Everyone asking: is this a joke? Then Narado himself replied. One sentence.

Cards (edit only): 0-2s hook card `In 2013 a man confessed to murder... in a meme.` + `TRUE STORY - 2013`. 32-35s cliffhanger card `"There is SOME truth behind it."` -> `PART 2: the internet hunts him down`.

---

## STILL prompts (STEP A - paste in ChatGPT with the style board attached)

### Scene 1 still - the bear meme card
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: a gentle sad-eyed
cartoon bear drawn in ink sits inside a floating meme card, centered in
darkness, softly lit from the card itself, two or three small harmless
doodles floating near it. Card in the lower half, top third dark and empty
for captions. No readable text, no logos, no visible faces except the
cartoon bear.
```

### Scene 2 still - the hooded figure posts
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: an adult hooded
figure in an oversized hoodie sits alone at a small desk in a dark bedroom
at 2am, seen from behind over the shoulder, face fully hidden, one monitor
casting the only light onto hands and desk, the room dissolving into
cross-hatched darkness. Figure centered in the lower half, top third dark
and empty for captions. No readable screen text, no logos, no visible face.
```

### Scene 3 still - the post explodes
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: one glowing card
hangs centered in darkness with a handful of small arrows and two speech
bubbles just beginning to appear around it, the crowd of shapes clearly
about to grow. Card centered lower half, top third dark and empty for
captions. No readable text, no logos, no faces.
```

### Scene 4 still - the one reply
```text
Match the attached style sheet exactly - same ink, paper, light, and single
cold blue accent. Vertical 9:16 scene, NOT a style board: a dense frozen
storm of dark speech bubbles filling the frame mid-air, all dimmed, and one
single brighter bubble just beginning to rise from the bottom center,
glowing with the cold accent light. Bright bubble lower half, top third
dark and empty for captions. No readable text, no logos, no faces.
```

---

## MOTION prompts (STEP B - assembled by pack.py, paste in Flow image-to-video with that scene's still attached)

### B001
```text
Use the attached style sheet as the strict visual system - match its heavy
black ink illustration, rough paper grain, stark white light carving shapes
out of darkness, cross-hatched shadows, and single cold blue accent used
only for light sources and key objects. Do NOT copy the sheet's layout; it
defines the language, not the composition. Faces are never shown; figures
read as strong ink silhouettes. Motion: slow deliberate push-ins and
drifts; shadows grow; light flickers; things are revealed by light, not by
camera cuts; steppy hand-inked feel, never glossy. Audio: sound design only
- room tone, paper sounds, low hums, single deep accents. No music. No
voice-over.

SHOT:
MG: a gentle sad-eyed cartoon bear sits inside a floating meme card,
centered. Small doodles pop up around the card one by one, staggered, like
harmless little secrets, then fade. At the end the card tilts slightly and
the whole frame dims into darkness, the bear's eyes the last thing lit.
Fixed camera. No text in frame. Settle on the darkened card.

AUDIO: soft paper rustle on each pop, light ticks, low room tone — sound design only, no music, no narration.

AVOID: No color other than black, off-white paper, and the single cold blue
accent. No glossy 3D, no photorealism, no digital gradients, no lens
flares. No visible faces. No readable text, no captions, no subtitles, no
logos, no watermarks. No gore, no injuries, no real people. No daylight
cheerfulness. No camera cuts within a clip. No music, no soundtrack, no
voice-over, no narration, no lyrics.
```

### B002
```text
Use the attached style sheet as the strict visual system - match its heavy
black ink illustration, rough paper grain, stark white light carving shapes
out of darkness, cross-hatched shadows, and single cold blue accent used
only for light sources and key objects. Do NOT copy the sheet's layout; it
defines the language, not the composition. Faces are never shown; figures
read as strong ink silhouettes. Motion: slow deliberate push-ins and
drifts; shadows grow; light flickers; things are revealed by light, not by
camera cuts; steppy hand-inked feel, never glossy. Audio: sound design only
- room tone, paper sounds, low hums, single deep accents. No music. No
voice-over.

SHOT:
MG: a hooded figure sits alone at a small desk, seen from behind over the
shoulder, face fully hidden, lit only by a monitor glow. The figure types
in two slow short bursts, hesitates with fingers hovering, then presses one
final key and leans back as the screen gives one soft flash. Slow subtle
push-in. No text in frame. Settle on the glowing screen and still figure.

AUDIO: quiet room tone, slow keyboard clicks, one decisive final click, low hum rising — sound design only, no music, no narration.

AVOID: No color other than black, off-white paper, and the single cold blue
accent. No glossy 3D, no photorealism, no digital gradients, no lens
flares. No visible faces. No readable text, no captions, no subtitles, no
logos, no watermarks. No gore, no injuries, no real people. No daylight
cheerfulness. No camera cuts within a clip. No music, no soundtrack, no
voice-over, no narration, no lyrics.
```

### B003
```text
Use the attached style sheet as the strict visual system - match its heavy
black ink illustration, rough paper grain, stark white light carving shapes
out of darkness, cross-hatched shadows, and single cold blue accent used
only for light sources and key objects. Do NOT copy the sheet's layout; it
defines the language, not the composition. Faces are never shown; figures
read as strong ink silhouettes. Motion: slow deliberate push-ins and
drifts; shadows grow; light flickers; things are revealed by light, not by
camera cuts; steppy hand-inked feel, never glossy. Audio: sound design only
- room tone, paper sounds, low hums, single deep accents. No music. No
voice-over.

SHOT:
A single glowing card hangs centered in darkness. Arrows rain upward around
it, a few then dozens then hundreds, staggered. Speech bubbles bloom and
crowd in from all edges, layering over each other, the light getting
harsher and more chaotic. Fixed camera. No text in frame. Settle on the
card almost buried in bubbles.

AUDIO: notification pings accelerating into a swarm, rising bass swell — sound design only, no music, no narration.

AVOID: No color other than black, off-white paper, and the single cold blue
accent. No glossy 3D, no photorealism, no digital gradients, no lens
flares. No visible faces. No readable text, no captions, no subtitles, no
logos, no watermarks. No gore, no injuries, no real people. No daylight
cheerfulness. No camera cuts within a clip. No music, no soundtrack, no
voice-over, no narration, no lyrics.
```

### B004
```text
Use the attached style sheet as the strict visual system - match its heavy
black ink illustration, rough paper grain, stark white light carving shapes
out of darkness, cross-hatched shadows, and single cold blue accent used
only for light sources and key objects. Do NOT copy the sheet's layout; it
defines the language, not the composition. Faces are never shown; figures
read as strong ink silhouettes. Motion: slow deliberate push-ins and
drifts; shadows grow; light flickers; things are revealed by light, not by
camera cuts; steppy hand-inked feel, never glossy. Audio: sound design only
- room tone, paper sounds, low hums, single deep accents. No music. No
voice-over.

SHOT:
A chaotic storm of speech bubbles freezes mid-air all at once. Everything
dims and goes still. One new bubble rises slowly from bottom center,
glowing brighter as every other bubble fades toward black around it. Slow
push-in on the lone bubble. No text in frame. Settle just before it fully
centers.

AUDIO: the swarm cuts to silence, one deep sub-bass note, faint heartbeat — sound design only, no music, no narration.

AVOID: No color other than black, off-white paper, and the single cold blue
accent. No glossy 3D, no photorealism, no digital gradients, no lens
flares. No visible faces. No readable text, no captions, no subtitles, no
logos, no watermarks. No gore, no injuries, no real people. No daylight
cheerfulness. No camera cuts within a clip. No music, no soundtrack, no
voice-over, no narration, no lyrics.
```
