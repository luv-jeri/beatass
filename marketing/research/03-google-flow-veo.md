# Google Flow and Veo: practical reel production

Research date: 2026-08-03

## Live-access note

This environment could not resolve `labs.google` on 2026-08-03 (`curl: (6) Could not resolve host`). Google changes Flow models, availability, credit prices, controls, and output specifications frequently. The official URLs below are the places to re-check immediately before a production batch. Claims marked **From-memory, verify in Flow** were not live-fetched in this session and must not be treated as fixed product specifications.

## What Flow is useful for here

Flow is useful for the opener, an exaggerated scene change, and a clean ending card background. It is not the product proof. The doll recording from beatass should be in every reel by about second two, because that is the asset nobody else can copy.

Use Flow to create a single simple shot, then assemble the reel in a free editor or the existing content-template workflow. Put all legible meme copy, subtitles, CTA, and URL on top after generation. Generated video systems are unreliable at exact spelling and stable small text.

## Capability check before each batch

| Need | Best current working assumption | Production instruction |
|---|---|---|
| Clip duration | **From-memory, verify in Flow:** standard Veo 3/3.1 Flow generations are commonly an 8-second clip. Extend/scene tools may produce longer sequences, but availability changes by model and plan. | Write one self-contained 8-second beat. Join clips only after the first version works. |
| Vertical video | **From-memory, verify in Flow:** 9:16 is offered in current Flow/Veo flows or model variants, alongside landscape options. | Choose 9:16 in the UI. Prompt for a centered subject with headroom and leave an uncluttered top third for overlay text. Do not crop a landscape result into a Reel. |
| Native audio | **From-memory, verify in Flow:** Veo 3 introduced synchronized native audio, including dialogue, effects, ambience, and music, but exact availability depends on the selected model/mode. | Select a Veo mode that explicitly shows audio. Ask for one or two simple sound cues and no music if platform-native music will be added later. |
| Output quality | **From-memory, verify in Flow:** resolution, export options, and daily credit limits vary with plan and model. | Generate one test, inspect it full screen on a phone, then decide whether an upscale/export step is needed. Never promise "1080p Veo" in the plan unless the running UI says it. |
| References and consistency | **From-memory, verify in Flow:** Flow offers image/reference-driven modes and scene tools, but persistent characters still drift. | Use an existing branded doll asset as the reference when the UI allows it. Use the real product capture for continuity rather than depending on a generated doll. |

Relevant primary source URLs:

- Google Labs, Flow: https://labs.google/flow/about/
- Google DeepMind, Veo: https://deepmind.google/models/veo/
- Google Cloud, Veo prompt guide: https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide
- Google Cloud, Veo model documentation: https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/overview

All were selected and recorded on 2026-08-03, but live fetch was unavailable in this environment.

## Prompt structure that produces usable short clips

Use this order. It reduces contradictory instructions.

1. **Format and duration:** "Vertical 9:16, 8 seconds."
2. **One subject and setting:** Who/what is visible, where, and at what time of day.
3. **One action arc:** Start state, one escalation, end state.
4. **Camera:** Fixed close-up, slow push-in, handheld, or overhead. Pick one.
5. **Look:** "Handmade dark-comedy miniature, high contrast, slightly absurd." Avoid trying to name a living artist.
6. **Audio:** One ambient bed and one or two effects; at most one short spoken line.
7. **Boundaries:** "No captions, no logos, no readable signs, no gore, no real people." Add the meme copy later.

For this brand, define the subject safely: a soft cloth voodoo doll or a clearly toy-like puppet. The joke is catharsis, not a realistic assault. Do not prompt for a real person, a named private individual, graphic injury, or a scene that could read as self-harm.

### A copy-paste prompt template

```text
Vertical 9:16, 8 seconds. A handmade cloth voodoo doll hangs from a small
cardboard stage in a dim bedroom. Dark-comedy miniature style, clearly a toy,
not a real person. Start with the doll looking smug. A single oversized foam
finger taps its forehead, the stage shakes, and the doll spins with an
embarrassed expression. Fixed close-up camera, centered subject, clean empty
top third for later text overlay. Warm lamp light, paper textures, no gore.
Audio: one soft creak, one comic thump, then a tiny triumphant bell. No music,
no dialogue, no captions, no logos, no readable text.
```

### Three repeatable variations

**1. Petty roommate**

```text
Vertical 9:16, 8 seconds. A miniature kitchen at night. A soft cloth voodoo
doll wearing a tiny housemate robe hides an empty oat-milk carton behind its
back. A paper receipt drops from above, then a harmless red yarn pin lands in
the cardboard counter beside it and the doll freezes. Stop-motion dark comedy,
not realistic, no gore. Slow push-in camera. Empty upper third for text added
in editing. Audio: refrigerator hum, paper flutter, one comic boing. No words,
no captions, no logos.
```

**2. Situationship**

```text
Vertical 9:16, 8 seconds. A toy-sized phone lights up on a desk beside a soft
cloth voodoo doll. The doll sees an unread late-night message, sighs in an
exaggerated comic way, then pulls a tiny blanket over its head. Handmade
miniature, darkly funny but gentle, no real people, no readable phone text.
Locked-off medium shot, centered subject, blank top third for later overlay.
Audio: phone buzz, tiny sigh, blanket rustle. No dialogue, no captions, no logos.
```

**3. Fake office drama, explicitly fictional**

```text
Vertical 9:16, 8 seconds. A cardboard office cubicle, a soft cloth voodoo doll
wearing an oversized tie, and a comically huge stamp marked with an abstract
symbol, not words. The stamp comes down beside the doll, puffs a small cloud of
paper confetti, and the doll hides behind a filing card. Playful dark comedy,
toy scale, no violence or injury, no real company branding, no readable text.
Overhead camera. Office air conditioner hum, stamp thump, tiny squeak. No music,
no captions, no logos.
```

Label the resulting social post `FICTIONAL SCENE` where needed. The prompt itself does not make a scenario a real confession and must never be paired with copy claiming a real user sent it.

## Audio workflow

- Generate effects or a simple spoken line only if the current Flow mode visibly supports audio. Watch and listen to every render before exporting.
- Prefer no generated music. Add a platform-licensed sound natively in Instagram or TikTok if the post needs a trend signal. This preserves the original product effect while avoiding a baked-in unlicensed track.
- Keep dialogue to one short, self-contained line. Lip sync, speaker identity, timing, and word accuracy are more fragile as the sentence gets longer.
- Add captions and all readable text in the edit. Do not use generated on-screen messages, email screens, or message bubbles as product evidence.

## Known limits and safe workarounds

| Likely limit | Safe workaround |
|---|---|
| Text in a generated shot is misspelled or changes frame to frame. | Leave blank space and overlay text in the edit. |
| A doll or room changes identity between takes. | Use a single take, a reference image if available, or cut to the real product recording. |
| Several actions happen at once or the final gag is missed. | One subject, one camera, one action progression, one punchline. |
| Audio contains wrong words, unwanted music, or strange timing. | Regenerate with effects only, mute it, and add native platform audio. |
| The clip looks generic or overly polished for the joke. | Use a deliberately tactile, paper-and-cloth miniature look and show the real doll capture almost immediately. |
| The generated action looks violent or uncomfortable. | Use comic, toy-scale consequences: spin, fall into paper confetti, foam finger tap, yarn pin landing nearby. No gore or real people. |
| Credits/limits prevent iteration. | Make low-cost/simple test generations first, retain only the usable takes, and build multiple caption/hook variants from the same approved clip. |

## Pre-publish checklist

- Confirm the exact Flow model, aspect ratio, duration, audio toggle, credits, export resolution, and commercial-use terms shown in the live UI. Record them in the content folder for that batch.
- Watch the full clip with sound and muted. Reject wrong text, a visual artifact, a real-looking person, accidental brand marks, or a joke that looks like a threat.
- Add `FICTIONAL` or `DRAMATIZED` in the post if the situation could look like a real customer confession.
- Apply current platform AI labels/disclosures when required. Do not assume an invisible provenance tag is enough.
- Place the product doll recording and a plain `beatass.com` action line in the final edit. Do not state user counts, invent testimonials, or fake product messages.

## Source list

- Google Labs, "Flow," https://labs.google/flow/about/ (primary source URL; accessed 2026-08-03; live fetch unavailable).
- Google DeepMind, "Veo," https://deepmind.google/models/veo/ (primary source URL; accessed 2026-08-03; live fetch unavailable).
- Google Cloud, "Video generation prompt guide," https://cloud.google.com/vertex-ai/generative-ai/docs/video/video-gen-prompt-guide (primary source URL; accessed 2026-08-03; live fetch unavailable).
- Google Cloud, "Veo overview," https://cloud.google.com/vertex-ai/generative-ai/docs/models/veo/overview (primary source URL; accessed 2026-08-03; live fetch unavailable).

## Live verification (2026-08-03, added after review)

The from-memory claims above were checked against a live web search on 2026-08-03. Confirmed:

- Veo 3.1 (updated January 13, 2026) generates NATIVE 9:16 vertical video - composed for vertical, not cropped - available in Flow, the Gemini app, and YouTube Shorts.
- Clip lengths are 4, 6, or 8 seconds per generation, extendable by chaining; resolution up to 4K.
- Native synchronized audio (dialogue, sound effects, music) is generated with the clip.
- New since May 2026: Gemini Omni Flash in Flow combines text, image, audio, and video in one output, capped at 10 seconds per clip.
- Every generation carries a SynthID watermark, so platforms may auto-label our reels as AI-generated. This is acceptable for clearly fictional skits, but do not fight or strip the label - stripping it would break platform rules.

Sources: blog.google (Veo 3.1 Ingredients to Video), ai.google.dev Gemini API Veo docs, superprompt.com Veo 3.1 January 2026 update roundup.
