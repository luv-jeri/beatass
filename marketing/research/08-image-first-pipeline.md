# Image-first pipeline for the 30-second confession reel factory

Status: proposed production method. This document is a design, not automation code.

## Decision

Make each generated story clip from a prepared still image, not from text alone.

For a confession reel, the visual path is:

```text
motion sheet -> scene start frame -> Flow image-to-video -> 8-second clip -> Remotion assembly -> final MP4
```

A **motion sheet** is the approved master reference image for one visual style. It shows the character, line or material treatment, palette, lighting, camera rules, and safe empty space for captions. A **start frame** is the composed still image that will be the first frame of one scene. It tells the video model exactly who and what is already in shot. The **motion prompt** then asks only for the movement during the clip.

This fits the current 30 to 35 second format: four 8-second generated scenes per reel, then hook, captions, voiceover, verdict card, and end card are assembled in Remotion. Readable words stay out of generated imagery.

## Why image-to-video is the better default

Text-to-video asks the model to invent the whole shot every time. Across the 12 scenes in a three-part story, that means it is asked to reinvent the hooded poster, the bear, the room, palette, camera, and style twelve times. Even a good individual clip can fail the series.

| Text-only failure | What it looks like in a 12-scene story | Image-first control |
| --- | --- | --- |
| Character drift | The hooded figure becomes a different body shape, outfit, skin tone, or visible face in later scenes. | The intended figure is already in the start frame. Flow only needs to animate it. |
| Style drift | Scene 1 is a hand-drawn notebook; Scene 5 becomes glossy 3D or photoreal. | Every still is made against the same motion sheet and reviewed before video spend. |
| Composition drift | The model puts a face or a bright object where captions must sit, or crops the main action at the edge. | The still reserves the top third and establishes the exact 9:16 crop first. |
| Story continuity break | The desk changes position, the monitor disappears, or the bear no longer matches the earlier card. | Reuse scene assets and describe the same object once in the still workflow. |
| Wrong action | The model turns a pause into dramatic gesturing, adds an extra character, or reveals a face. | The start frame limits what can change; the motion prompt contains one short action sequence. |
| Expensive retry | A good composition with one bad movement means generating a whole new video and hoping composition survives. | Fix the still first. Once the still is right, retry only the motion or make a second motion from the same still. |
| Unusable generated text | Monitor copy, card labels, counters, and captions become gibberish. | Keep all readable text out of the still and clip. Add it in Remotion. |

Image-first does not guarantee identity or style. Flow can still alter a character during animation, add unwanted objects, or mishandle a supplied frame. It does give a clean approval point before the slower video generation step, which makes failures cheaper to find and correct.

## Folder convention

Use one self-contained directory for each story. The lower-case slug is stable even if the on-screen title changes.

```text
marketing/production/
  story-001-confession-bear/
    README.md                     # story status, chosen style, approval notes
    motion-sheet/
      master-reference.png        # the locked visual reference image
      master-reference-prompt.txt # exact approved source prompt
    frames/
      part-01-scene-01.png
      part-01-scene-02.png
      part-01-scene-03.png
      part-01-scene-04.png
      part-02-scene-01.png
      ...
    prompts/
      part-01-scene-02-still.txt
      part-01-scene-02-motion.txt
      ...
    clips/
      part-01-scene-02-take-01.mp4
      part-01-scene-02-take-02.mp4
    vo/
      part-01.wav
      part-01-script.txt
    final/
      story-001-part-01-master-1080x1920.mp4
      story-001-part-01-publish.mp4
    logs/
      frame-review.md
      render-log.jsonl
```

Keep names ordered with zero-padded part and scene numbers. A clip file should never overwrite another take. The selected take is recorded in the part's Remotion data file, not inferred from whichever file is newest.

## Concrete production pipeline

1. Select the winning story style from the bake-off and make one master motion sheet. It should show the recurring character or object, materials, palette, lighting, line treatment, safe empty top third, and a no-text rule. This is a one-time approval for the style.

2. Create a short **style anchor** from the motion sheet. It is the exact unchanged character and visual description copied into every still prompt. For example: "2D hand-drawn living notebook animation on ruled cream paper, blue ballpoint linework, yellow highlighter accents, rough flipbook jitter, no readable text." Do not keep rewriting this description from memory.

3. Break a part into its four existing eight-second scene beats. For each beat, write two files: a still prompt that describes the fully composed shot, and an action-only motion prompt that describes what changes after frame zero.

4. Generate and approve the start frame before requesting video. The frame review checks: correct character, no face where prohibited, clear visual read, text-free image, top-third caption space, correct 9:16 crop, and continuity with the adjacent scenes.

5. In Flow, choose image-to-video. Attach the approved start frame. If Flow offers "Ingredients to Video," attach the master motion sheet too only when live testing shows it improves consistency without changing the frame. If Flow offers frames-to-video, use the approved start frame as the start frame. Exact option names, limits, and reference-image behavior are **verify live**.

6. Paste only the motion prompt. It names movement, timing, camera movement, and allowed sound effects. It does not repeat the whole style, retell the scene, request captions, or ask for screen text. Render one eight-second take.

7. Review the finished clip at full-screen phone size. Reject it if Flow changes the face, violates the caption-safe top third, inserts text, makes the action unclear, or breaks the selected style. If the picture itself is wrong, repair or regenerate the still. If the picture is right but the movement is wrong, reuse the still and retry the motion prompt.

8. Save the downloaded take to `clips/` under its exact part, scene, and take number. Record its Flow prompt, date, and decision in `logs/render-log.jsonl` or `logs/frame-review.md`.

9. Generate voiceover separately, then hand the chosen clip paths, VO audio, script, and timing to the locked Remotion template. Remotion adds the hook card, word-synced captions, confession copy, verdict bait, end card, and clean 1080x1920 export.

10. Watch the assembled part once with audio and once muted before approving it for posting. The finished reel, not a folder of acceptable clips, is the production result.

## Where the stills can come from at zero new spend

Rank these paths in this order. "Free" here means no new cash spend; all generation can still consume existing subscription allowance or quota.

| Rank | Path | How to use it | Cost and decision |
| --- | --- | --- | --- |
| 1 | Flow's own image generation, if available | Generate the motion sheet and start frames in the same product where the video will be made. Download the approved PNG, then use it as the image-to-video start frame. | Preferred if present in the existing subscription. Whether Flow currently exposes image generation, its model, quotas, download format, and whether it accepts multiple references are **verify live**. |
| 2 | Gemini app image generation, if included with the existing subscription | Generate the master sheet and scene stills in Gemini, download them, then upload the chosen still to Flow. Maintain the same style anchor and reference image in every request. | No new spend only if the current account entitlement covers it. Current image model, reference support, usage cap, commercial terms, and export behavior are **verify live**. |
| 3 | Local composition from approved brand assets | Build a 9:16 still locally from the approved motion sheet and simple original shapes, then use it as Flow's start frame. This is useful when exact caption space or object placement matters more than a new generated illustration. | Zero marginal spend. It needs a person to make the still and is only valid when all source assets are owned or generated for beatass. |
| 4 | Motion-builder image model: `nano-banana-pro` through Kie API | Use only if its output is materially better than the free paths and the scene warrants it. Its output becomes the approved start frame for Flow. | Paid, pay-per-use. It needs an explicit budget yes from Sanjay before any generation. It is not part of the $0 default. Current model and API behavior are **verify live**. |

Do not make a start frame from a copyrighted meme photo or a stranger's artwork. For Story 001, the sad bear is an original drawn character, never the real Confession Bear image.

## Consistency rules that are worth the effort

1. Use one master motion sheet per chosen style. Store the exact image and its exact source prompt. Do not replace it quietly halfway through a series.

2. Use the same reference image wherever Flow or the still-image tool accepts one. If a product exposes a reproducible seed, record and reuse it. Seed availability and reliability in Flow and Gemini are **verify live**. A seed is a repeatable starting value that can sometimes make generations more alike; it is not a guarantee.

3. Describe recurring characters identically in the still prompt. Give the hooded poster a fixed identity statement once: "adult hooded figure, charcoal oversized hoodie, face always hidden by angle and shadow, seated at a small desk, no identifying features." Only add the scene-specific change after it.

4. Put composition notes in every still prompt: vertical 9:16, main subject in the middle or lower half as appropriate, top third intentionally empty for captions, clear silhouette, and no readable words. The note can vary only when the storyboard has a deliberate reason.

5. Keep a continuity contact sheet of all approved frames in `frames/`. Review all four frames in a part side by side before video rendering. A frame that looks good alone can be a visual jump next to its neighbors.

6. Reuse a still when the story stays in the same place, time, and composition but needs a different action. The hooded figure at the desk can yield a typing take, a frozen hesitation take, and a monitor-flicker reaction take. Reuse reduces drift and is especially useful for alternative takes or short cutaways.

7. Do not reuse a still when the narrative needs new information, a meaningful location change, a new prop, a new character arrangement, or a different emotional turn. A reused frame must not make two different story beats look accidentally identical.

## Worked example: Story 001, Part 1, Scene 2

This example assumes the winning story style is the living notebook test. If another style wins, replace only the first style-anchor sentence with the approved equivalent from that motion sheet. Keep the character and composition rules unchanged.

### Still-image prompt

```text
Vertical 9:16 composed start frame. 2D hand-drawn living notebook animation on
ruled cream paper, blue ballpoint linework, yellow highlighter accents, rough
flipbook texture, visible paper grain. An adult hooded figure in an oversized
charcoal hoodie sits alone at a small desk in a dark bedroom at 2am, viewed
from behind and slightly over the shoulder. The face is fully hidden by the
hood, angle, and shadow. A single monitor casts a cold pale glow onto the
figure's hands and desk, with a simple dark bedroom fading around it. Hands
rest just above an abstract, text-free keyboard. The subject is centered in the
lower half; the top third is clean, dark notebook paper reserved for captions.
Quiet, tense, simple composition. No readable screen text, no captions, no
logos, no extra people, no visible face.
```

### Motion prompt for Flow image-to-video

```text
The figure types two slow short bursts, pauses with fingers hovering, then
presses one final key and leans back slightly. The monitor gives one soft flash
at the final key. Slow, subtle push-in from the existing over-the-shoulder
camera. Keep the face hidden and the upper third empty. Audio: quiet room tone,
slow keyboard clicks, one decisive final click, low hum rising. No text appears.
```

The still prompt establishes the room, character, framing, and style. The motion prompt changes only action, camera, and sound. That separation is the rule to preserve once the motion sheet is locked.
