# Raw tutorial lessons for the AI reel factory

Research date: 2026-08-03

This is a transcript digest, not a verification of current product capability, pricing, licensing, or terms. Tool names, model names, availability, and prices below are what the creators said in the videos. Rolling captions repeat fragments, so sentences have been joined before summarising them. A **beat** is one short story moment that gets its own visual. A **reference sheet** is an image or written style specification that keeps repeated shots visually alike.

## Video 1: paper-cut Vox-style videos on autopilot with Claude

Source: `t1.txt`  
Title: `Create FREE & UNLIMITED VOX-Style Videos on AUTOPILOT With Claude ( Free plan )`  
Length: 13:55

### Exact workflow taught

1. Get the creator's master prompt and paste the whole thing into a reasoning chatbot. The creator uses Claude, but says DeepSeek and ChatGPT also work.
2. Choose a niche and story topic. The example is how the pyramids were built because it promises a satisfying visual flow.
3. Choose the script length. The example is 45 seconds, but the creator says the process can be used for one to 20 minute stories.
4. Let the chatbot write a script with every sentence numbered. Each numbered sentence is a visual beat, so the script is also a shot list.
5. Copy the script into a Google Doc to keep the source text orderly.
6. Make the voice-over. Choose a voice, copy the script in small blocks, generate and preview each block, download each acceptable audio file, then repeat until the script is complete.
7. Return to the chatbot and type `next`. It produces a TXT file of detailed image prompts, one start-frame prompt for each beat.
8. Create the start-frame images. For manual work, paste each prompt into Gemini's image creator. For batch work, create a Google Flow project, configure the image model, connect the Zappy Flow Chrome extension, upload the TXT file, and start generation.
9. Let Zappy Flow submit every beat and save the generated images locally. Review the results and use the images as each clip's starting frame.
10. Type `next` in the chatbot again. It produces the image-to-video animation prompt.
11. In Flow, switch from image to video, choose the video settings, paste the animation prompt, attach a start-frame image, and submit. Repeat for every beat, keeping several candidates when possible.
12. Generate two candidate instrumental tracks in Suno from the master prompt's music-prompt variants, compare them, and download the preferred MP3.
13. Put all audio and video assets in one folder. Import that folder into CapCut, then assemble music, narration, and clips in beat order. Trim clips to narration, add limited transitions and a subtle vignette, then export.

### Image-first generation, consistency, and prompt techniques

- Build the script as numbered sentences so every line becomes a discrete image and video beat. This makes the visual pipeline traceable back to the narration.
- Choose topics with a clear visual sequence. The creator chose pyramid construction rather than an abstract topic because each step is easy to depict.
- Generate images before video. Each paper-cut image is a start frame, meaning the video model is asked to animate a defined composition rather than invent the entire scene from text.
- Keep the same paper-cut look through the master prompt and chatbot-produced image prompts. The transcript does not provide the prompt text itself, so the exact style wording is not recoverable from captions.
- Ask for multiple candidate images and regenerate clips when needed. The creator says he generated some clips several times to have choices during editing.
- Use a shared aspect ratio throughout. The example image workflow uses 16:9, so the subsequent video and edit should not mix vertical and landscape assets without a deliberate crop plan.
- Keep one narrated visual idea per beat. The practical benefit is that a clip can be trimmed to the matching sentence without trying to force several story events into one generated shot.

### Tools, settings, and costs mentioned

| Area | Mentioned tools or settings | Cost or availability claim in the transcript |
|---|---|---|
| Planning | Claude, DeepSeek, ChatGPT | DeepSeek is described as free, open source, no credit card, and unlimited. No price is given for Claude or ChatGPT. |
| Script archive | Google Docs | No cost stated. |
| Voice | Microsoft Clipchamp; CapCut text-to-speech; Noise AI; ElevenLabs | Clipchamp and CapCut are described as unlimited/free options. Noise AI is said to provide about 2,000 free credits daily, about 60,000 monthly. ElevenLabs is said to provide 10,000 free monthly credits. |
| Voice settings | ElevenLabs, V3 model; one chosen voice; generate in small text blocks | V3 is presented as the best-quality setting. Large pasted blocks are said to cause distorted or glitchy speech. |
| Images | Google Gemini image creator; Google Flow; Nano Banana 2 | Flow example: image mode, 16:9, four images, Nano Banana 2. Flow is described as offering advanced models free. |
| Image batching | Zappy Flow Chrome extension | Connect it to the Flow project, upload the chatbot TXT, click Start Generating. It is said to download images automatically. No price stated. |
| Video | Google Flow; Omni Flash | Example: video mode, one video output per batch, 10-second duration. The creator later refers to four outputs per prompt, which conflicts with the earlier one-output setting. |
| Music | Suno AI | Sign in with Google, choose Create, turn on Instrumental, paste prompt, generate two candidates, download MP3. No cost stated. |
| Edit | CapCut | Music at about -20 to -25 dB, narration at about +10 dB, Blink transition, Vignette effect reduced by about 40 percent to a value around 60. |

### Automation and removal of repetitive work

- The master prompt turns a topic into a numbered script, then turns `next` into a beat-level TXT prompt file and then into an animation prompt. This is the creator's main automation chain.
- Zappy Flow removes the repetitive copy-paste job for a long beat list. The creator estimates that a 20-minute script could make roughly 300 to 450 beats, which would be impractical to submit one by one.
- The extension is claimed to both submit the prompts and store image files on the computer, avoiding a separate download step.
- Repetition remains in voice generation and image-to-video submission. The creator manually generates voice blocks and manually attaches each start image to a video prompt, though he queues several requests while prior ones process.
- A single asset folder reduces manual asset hunting when importing into the editor.

### Quotable one-line lessons

> "Every single line in your story gets turned into a beat."

> "If you paste too much text into ElevenLabs at once, the voice starts to sound glitchy and distorted."

> "Zappy Flow now starts creating all the images for us without us needing to do anything."

## Video 2: a Claude generation skill as a Higgsfield alternative

Source: `t2.txt`  
Title: `This 1 Claude Skill fully replaces your Higgsfield Subscription`  
Length: 15:41

### Exact workflow taught

1. In the Claude desktop app, invoke a custom `/generate` skill.
2. Give it the creative brief, reference images, desired output variety, a total generation budget, and routing rules. The example asks for green-apple Ketone IQ image ads.
3. Ask for several image models so the skill can make variants and reveal which model suits the creative direction.
4. The skill selects the cheapest available connected provider, loads references, writes prompts, submits jobs to the selected model, and returns the generated media.
5. Compare the model outputs and choose the preferred design direction. The example creates three ads for each of three models.
6. If needed, provide the chosen image file path to Claude Code and ask it to build a related website, animate the image into a video with Kling, match the website colours to that image, and generate more images in the same style.
7. Retain the locally stored media and generated prompts so a team can revisit, reuse, or delete them on its own terms.
8. For a new model, copy its provider documentation formatted for an LLM, ask Claude to add it to `/generate`, and paste the documentation. Continue tailoring the skill's model list and rules.
9. Optionally build a gallery-wall micro-app: a visual canvas for reviewing generated images and videos, plus a styles area that stores reusable style prompt text and reference paths.

### Image-first generation, consistency, and prompt techniques

- Give reference images with the brief so Claude can infer the brand's previous design system. A design system here means the repeated colours, layout logic, visual motifs, and finish that make assets look like one brand.
- Generate deliberately different variants across several models before locking a direction. The creator uses variation to find the style worth pursuing instead of asking for near duplicates immediately.
- After choosing an image, use its local file path as the source of truth for the next step: animate it, make a website around it, align colours to it, and request further images in that style.
- Store a reusable style preset with both prompt text and paths to reference images. Clicking a preset copies both, making consistency repeatable rather than dependent on memory.
- Make hard rules part of the prompt system: total budget, model variety, cheapest-provider routing, and an optional prompt-review step before jobs run.
- Preserve the actual prompts sent to models. Prompt logging makes a successful look reproducible and lets a team compare why one image worked better than another.
- The transcript has no character-specific technique beyond using reference images and style references. It does not show a named character sheet, identity-lock setting, seed, or consistency parameter.

### Tools, settings, and costs mentioned

| Area | Mentioned tools or settings | Cost or availability claim in the transcript |
|---|---|---|
| Controller | Claude desktop app; custom `/generate` skill; Claude Code | The skill is described as a written instruction document that can be customised. |
| Image models | GPT Image 2, Nano Banana 2, Nano Banana Pro, Nano Banana 2 Light | Example asks for three images from each of three models, all made different. |
| Video | Kling; C-dance 2 Fast | Kling is used in the website follow-on example. C-dance comparison refers to 720p, 8-second video generations. |
| Providers | Fall.ai, WaveSpeed, Kie.ai | Presented as pay-as-you-go model aggregators. The creator describes Fall and WaveSpeed as broad catalogs and Kie as often cheapest but sometimes less reliable. |
| Budget controls | $3 total generation budget; cheapest-provider-first routing; prompt inspection before running | The creator says a hard cost rule matters because an unattended request for 100 images could consume credits. |
| Subscription comparison | Higgsfield Plus and Max | The creator reports $49/month Plus and $79/month Max in Australia, and earlier contrasts the skill with $100+/month. Treat these as creator-reported, time-sensitive prices. |
| Image price comparison | GPT Image 2 at 1:1 and 2K | Higgsfield is said to cost about $0.31 to $0.34 per image. Kie is said to list $0.03 for 1K, $0.05 for 2K, and $0.08 for 4K. |
| Other price claim | ChatGPT subscription | The creator speculates, without confirmation, about a $20/month subscription being related to Kie's low price. This is not evidence of Kie's implementation and should not guide product claims. |

### Automation and removal of repetitive work

- `/generate` consolidates model selection, provider routing, reference loading, prompt writing, job submission, output logging, and local asset loading into one command.
- Fallback routing avoids manually retrying a provider: the creator's flow is Kie first, then Fall, then WaveSpeed if an earlier provider is unavailable.
- Prompt inspection creates a human checkpoint before a large batch spends money. This is automation with a budget guardrail, not blind batch generation.
- The gallery wall avoids reviewing work in a text terminal or chat transcript. It groups images and videos visually so a human can make a design decision quickly.
- A reusable styles panel turns a previously manual copy-paste operation into a click that supplies the style prompt and its reference files.

### Quotable one-line lessons

> "Use a variety of image models because I want to see GPT Image 2 versus Nano Banana 2 versus Nano Banana Pro."

> "If you ask it to generate 100 images, it will actually go into it and drain your credits."

> "First it routes the model, then it loads all of the references and crafts the prompts, then it generates the media."

## Video 3: usable Vox-style motion graphics with Gemini Omni Flash

Source: `t3.txt`  
Title: `AI Vox Style Motion Graphics Are Finally Usable (Gemini Omni)`  
Length: 17:05

### Exact workflow taught

1. Decide whether the shot needs generated motion or code-based motion. Use Remotion when exact charts, figures, fine type, repeatable personalisation, and programmatic scale matter. Use Omni Flash when speed, dynamic movement, and fast visual experimentation matter.
2. Make one reference sheet that defines the visual system for the whole reel. It can be a written style sheet or a reference image.
3. Lock the reference-sheet/style portion of the prompt. For each new clip, change only the action block, and change the background block only when the shot truly needs a different background.
4. Use either a two-stage image-first route or a direct route. Two-stage: make an image from the reference sheet, then animate that image. Direct: submit the reference image straight to video when it is already adequate.
5. For logos and faces, prefer reference image to image first, then use the resulting image as the video input. The creator considers this more reliable than generating the entire clip from a loose text prompt.
6. In the video prompt, repeat the style-lock instruction even when attaching a reference image. The creator found that omitting the written style block caused the model to change style mid-video.
7. Keep motion simple for longer or continuous clips. Use more elaborate movement only where a short dynamic insert can tolerate imperfect frames.
8. Generate, review closely, reject visible errors, and keep testing prompt structure across providers. The creator says he made many failed and successful tests before refining the prompt structure.
9. If Gemini blocks a clip with a known public person, create a stylised intermediary image with GPT, add black bars if useful to obscure the person, then use the image-to-image and reference-image-to-video chain. Continue applying the same reference sheet across the film.
10. Assemble a hybrid reel when needed: generated Omni shots for dynamic visual metaphors; Remotion for exact data, numbers, charts, and scalable variable-based output; After Effects for further finishing.

### Image-first generation, consistency, and prompt techniques

- A single reference sheet is the primary consistency device. It locks the colour palette, typography treatment, layout elements, and visual language before individual shot actions vary.
- Structure the prompt as stable blocks plus one variable block: style reference, locked style details, optional background details, then the shot action. Change the action per clip, not the whole prompt.
- Explicitly name the desired style in the video prompt even if the matching image is attached. Reference attachment alone did not prevent style drift in the creator's tests.
- Generate an intermediate image when a logo or face needs better control. This is image-first generation: make the composition and identity more stable before asking a video model to animate it.
- A direct reference-image-to-video route can skip the intermediate image when the reference already has the necessary composition and style.
- Include colours, broad font treatment, and the specific graphic elements in the reference sheet. In the Vox example, the creator points to colour, all-caps-like typography, and graphic elements as enough for Omni to understand the look.
- Think in large blocks. Large type is more reliable than tiny type; simple components are more reliable than micro-detail. Do not depend on AI video for small, exact text.
- Keep camera and movement modest for long clips. Simple motion improves reliability; more complex, dynamic motion is better reserved for short cutaway material where only selected moments must be usable.
- Start with inspiration images from sources such as Pinterest, then use AI to help turn the visible style into a written prompt. The creator tested blueprint, clay, Vox, glass, and other visual directions with the same system.
- Review at close range. Omni is said to handle reference images and typography better than alternatives in these tests, but it still makes visual and motion mistakes. The creator calls the result 80 to 90 percent usable, not perfect.

### Tools, settings, and costs mentioned

| Area | Mentioned tools or settings | Cost or availability claim in the transcript |
|---|---|---|
| Main generated-motion model | Gemini Omni Flash / Omni Flash | The creator calls it the strongest tested model for reference understanding, typography, motion graphics, and video physics. He also calls it the cheapest top-tier option, but gives no price. |
| Comparisons | Veo 3, Kling 2.6, Kling 3.0, Seedance 2, Hailuo / "Happy Horse" as captioned, SeaArt 2 | The comparison is explicitly not fully fair because Kling in Artlist used only a start-frame mode, while other models had reference mode. |
| Image generation | Google Nano Banana, GPT-2 as captioned | Artlist's unlimited option is described as allowing unlimited image experiments with these models. No subscription price is stated. |
| Generation platform | Artlist | Sponsor platform used for many prompt and provider tests. It is said to include Omni Flash plus an unlimited image option. |
| Exact motion | Remotion; After Effects | Remotion is described as free for motion graphics and better for accurate data, charts, fine typography, and programmatic volume. After Effects is proposed as part of a hybrid workflow. |
| Unsupported-person workaround | GPT image generation; image-to-image; black bars | Gemini is said to block known people. The creator used GPT to create an image and added black bars before moving to video. |

### Automation and removal of repetitive work

- The locked style sheet turns a multi-shot reel into a parameterised production system: keep the style fixed and swap only the action instruction for each clip.
- A single reference image can sometimes go straight to video, removing the extra image-generation step.
- Remotion is the automation choice for exact repeatable output. The creator's example replaces a name or chart value and renders a thousand personalised assets for very little incremental cost.
- Store prompt structures and test them across providers rather than rebuilding each shot from zero. The creator's workflow comes from repeated experimentation, not a one-shot perfect prompt.
- Use the hybrid split deliberately: automated code for exact repeated fields; image-first AI video for dynamic, difficult-to-code visual movement.

### Quotable one-line lessons

> "First lock your style. Generate a good-looking reference image."

> "If you have big fonts then AI is struggling less than if you are looking at micro tiny fonts."

> "If you want numbers, charts, really fine typography, or scale, Remotion is still the way to go."

## Ten production lessons to carry into beatass.com

1. Write the narration as short, numbered visual beats before generating anything. One beat should support one clear image and one clear motion action.
2. Make the frame before the clip. A controlled start image gives the video model composition, palette, subject, and scale to preserve.
3. Treat a reference sheet as a production asset. Store it with the reel, apply it to every shot, and make the variable action the only routine change.
4. Repeat the style instruction in the video prompt. Attaching a reference image is helpful but does not reliably prevent style drift.
5. Keep generated type large and non-critical. Add exact captions, names, numbers, URLs, and calls to action in editing or code.
6. Create several image and video candidates, then choose. Variation is a deliberate design-selection step, not evidence that every output will be usable.
7. Put firm cost limits and a review checkpoint before batch generation. Automation should stop spend from outrunning judgment.
8. Log prompt, reference files, model, provider, settings, cost, and final selection for every keeper. That is how a good reel becomes repeatable.
9. Use code-based motion for exact data and high-volume personalised assets. Use image-to-video for visual energy, paper-cut movement, and short dynamic transitions.
10. Keep the human edit. Match clips to narration, choose takes, balance music and voice, and add reliable final text after generation.

## Research limits

- The transcript captions do not show the creators' full master prompts or the on-screen prompt screenshots. This file records every concrete technique spoken in the captions, but cannot reproduce prompt text that appeared only visually.
- Product prices, free limits, model names, availability, output duration, commercial rights, and platform terms may have changed. Re-check these directly in the live tool before using them in Beatass product copy or a production budget.
- The creators' performance comparisons and provider claims are opinions based on their own tests. They are useful hypotheses for a Beatass test matrix, not proof of current quality or safety.
