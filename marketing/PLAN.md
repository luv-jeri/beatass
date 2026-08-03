# beatass.com Viral Launch Plan

**Prepared:** 2026-08-03. Research and draft by GPT-5.6 Terra (xhigh) via the Codex bridge; reviewed, live-verified, and finalized by Fable. The Flow/Veo production assumptions (8-second native 9:16 clips with native audio) were confirmed against live sources on 2026-08-03; see the note at the end of `research/03-google-flow-veo.md`.
**Goal:** Get real people to make and share real beatass messages without paid reach, fake social proof, or spam.

This is a short-life entertainment launch plan. Reels and TikToks are the fast layer. Search is the slower layer. Every public number, quote, message, and result must be real. Fictional confession stories are allowed only when they are clearly labelled as fictional entertainment.

## 1. Positioning

**The one-line promise**

"Write what you would never say. Take it out on a doll. Send it anonymously."

**What makes it different**

Most anonymous-message products ask a receiver to put a personal link in their bio, then wait for messages. beatass starts with one person who wants to say something now. They write the confession, beat the doll, and send a real email containing the actual confession and the doll GIF. The recipient is then the natural second sender: they can choose to share the MP4 replay or make a doll for someone else.

**The viral loop to build and measure**

```text
Reel or TikTok -> beatass.com -> sender creates a real message
-> recipient receives real email and GIF -> recipient opens private replay
-> recipient voluntarily shares the MP4 or makes another message
-> a new sender arrives at beatass.com
```

The loop is voluntary at every sharing step. No email, DM, share, invite, or testimonial is created by beatass unless a real person takes that action.

## 2. Non-negotiable launch rules

- Never create a fake message, testimonial, user count, inbox screenshot, or reaction.
- Every scripted confession video carries "Fictional reenactment" in the first frame and caption. It must never look like a received beatass message.
- Keep the recipient email's full real confession and GIF inline. This is a locked product decision.
- Keep report and permanent block links prominent in every email and private replay.
- Never reveal, imply, sell, or tease the sender's identity.
- Do not buy followers, views, likes, comments, engagement pods, or use bots.
- Do not expand the approved Instagram recipient notifier. It remains disclosed automated text, exact-handle only, block-list checked, never-twice, and capped at 30 per day from @_beatAss_. It is not a marketing cold-DM tool.
- Spend no new money. Use Flow/Veo already owned, the existing Instagram account, platform-native editing, and free analytics.
- Do not target or seed youth-focused accounts. Keep launch content away from school and teen communities.

## 3. Content pillars

| Pillar | What viewers get | Repeating format | CTA |
|---|---|---|---|
| Fictional confessions | The line someone wishes they could send | Text hook, quick doll reaction, end card | "What would you write?" |
| Petty payback | A harmless, darkly funny way to vent | Everyday irritation becomes an absurd doll consequence | "Take it out on the doll" |
| Inbox aftermath | The recipient-side moment, always dramatized | Fictional actor opens the replay, chooses to share or send one back | "If you got this, who gets the next one?" |
| The doll is the joke | Tactile, satisfying hitting and animation | Punch, pin, burn, love, then clean MP4 payoff | "Make your own replay" |
| Comment bait with a boundary | A question people can answer without naming a target | "What is the pettiest harmless thing?" | "Keep names out of it" |

For every fictional video, use this caption footer: `Fictional skit. beatass only sends messages written by real people. Keep it funny, not cruel.`

## 4. Production system

**v2 update (2026-08-03, after tearing down 4 viral Reddit-confession compilations - see `research/06-reference-videos.md`):** the primary format is now a **30-35 second narrated confession story**, not an 8-second gag. Sanjay's call. What changed and why:

- Those compilations win on AUDIO retention: a voice reads a first-person confession (mundane setup -> escalation -> dark payoff) while a cheap visual keeps the eyes busy. We keep that engine and replace their lazy dark text box with our animated doll - the doll acts out each story beat (pin = petty grievance, punch = escalation, burn = dark turn, love = plot twist).
- Story arc per reel: 0-2s hook card (the confession one-liner) -> 2-20s setup + escalation -> 20-27s payoff synced to the doll -> 27-30s verdict bait ("Guilty or justified?") + beatass.com card. Verdict bait is the comment engine: every story must be morally ARGUABLE, not purely evil.
- Story supply chain: viral compilation transcripts (in `research/transcripts/`) -> GPT mines and scores every story (`research/07-story-catalog.md`) -> top stories REWRITTEN as original fictional composites (`REEL-SCRIPTS-30S.md`) - never verbatim, new names and details, always labeled fictional.
- Assembly line: Flow/Veo generates the 8-second doll/story clips (3-4 per reel, stitched); **Remotion** (a tool that renders video from code) is the compositor - one locked template does the hook card, word-synced captions, confession text in our notebook style, doll clip slots, verdict card, and 1080x1920 export. A reel becomes a data file: script + VO audio + clip paths in, finished MP4 out. Template lives in `marketing/remotion/` once built (remotion-builder skill).
- Content boundary learned from the references: their killing/abuse-level stories fly on YouTube long-form but die in Reels/TikTok RECOMMENDATIONS. Our controversial = cheating, revenge, betrayal, sabotage, family secrets. Nothing sexual-explicit, no graphic violence, nothing involving kids or animals being harmed.

**v3 update (2026-08-03, after studying 3 production tutorials - see `research/08`, `research/09`, `research/10`):** the pipeline is IMAGE-FIRST. Per scene: generate a still start-frame image (style-locked via the motion sheet reference), then have Flow animate that image with an action-only prompt. Narration is ONE continuous VO track generated separately (ElevenLabs free tier / local Voice Box, in small text blocks) and laid over the clips - generated clips carry sound effects only, never voice. Music from Suno (instrumental). Exact text (captions, hook cards, verdict cards, URLs) is never generated - it is added in Remotion/edit. Batch automation candidates: the Zappy Flow Chrome extension (existing tool, batches Flow image generation - verify price/permissions live) and/or a small supervised queue runner per `research/09` (AMBER: automating a Google account is a ToS gray zone, Sanjay's call).

The original 8-second single-gag flow below still applies to the "doll is the joke" pillar and remains the fallback for quick posts:

1. Generate the visual plate in Flow/Veo: an 8-second, vertical, text-free dark-comedy shot.
2. Add every readable hook, confession, subtitle, and end card in the existing reel compositor or a free editor. Do not ask a video model to render the words. It will make them unstable or wrong.
3. Use a platform-native sound, an original voiceover, or simple effects. Do not reuse copyrighted movie or television audio outside the platform's licensed library.
4. Export a clean 1080x1920 master. Upload the clean master separately to Reels and TikTok. Never cross-post a visible watermark.
5. Write a short caption with the exact searchable phrase once, then a question. Use three to five precise hashtags, not a hashtag wall.
6. Reply to real comments with real answers. If a comment asks for the link, answer publicly with "link in bio". Do not start a mass-DM flow.

## 5. Twenty ready-to-make reels

### 1. Cereal dinner

- **Hook line:** "Fictional confession: I know you eat cereal for dinner."
- **Script:**
  1. Show the hook as an oversized note for 0.8 seconds.
  2. A deadpan roommate opens a cupboard full of cereal.
  3. Cut to a hand-drawn doll getting one theatrical punch.
  4. Show "1 hit. 0 judgement." as an edit overlay.
  5. End on the doll clip and `beatass.com`.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second deadpan dark-comedy skit in a warm messy apartment kitchen at night. A fictional adult roommate silently opens a cupboard stuffed only with cereal boxes, looks at camera, then lightly taps a handmade cloth voodoo doll hanging on a string. Handheld phone realism, ink-and-paper visual accents, one soft comedic impact sound, no logos, no readable text, no subtitles.`
- **Sound suggestion:** Dry whispered voiceover, cupboard squeak, one soft thud.
- **Pillar:** Fictional confessions.

### 2. Calendar invite revenge

- **Hook line:** "Fictional confession: your 4:59 PM meeting changed me."
- **Script:**
  1. Hook over a phone calendar at 4:59 PM.
  2. An adult worker slowly closes a laptop.
  3. Their desk doll is pinned to a tiny calendar invite.
  4. Overlay: "declined emotionally."
  5. Doll replay and end card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second dark-comedy office skit with an adult worker at a home desk at sunset. They see a fictional 4:59 PM calendar alert, stare into camera, then place a tiny paper calendar square beside a handmade cloth doll. Warm desk lamp, subtle paper texture, believable phone video, quiet notification ping and comic paper rustle, no text or logos.`
- **Sound suggestion:** Calendar ping, exhausted sigh, paper crinkle.
- **Pillar:** Petty payback.

### 3. The borrowed hoodie

- **Hook line:** "Fictional confession: that is my hoodie. It has always been my hoodie."
- **Script:**
  1. Put the hook over a familiar oversized hoodie.
  2. A fictional adult friend wears it with no shame.
  3. Cut to a doll in a tiny hoodie getting a gentle pin.
  4. Overlay: "return by Friday."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second playful dark-comedy skit. An adult friend in an oversized hoodie smiles guiltily at the camera, then a close-up of a handmade cloth doll wearing a tiny hoodie receives one harmless decorative pin on its sleeve. Cozy bedroom, flash photography feel, gentle fabric sounds, no injury, no readable text, no brand logos.`
- **Sound suggestion:** Playful bass pluck and fabric rustle.
- **Pillar:** Fictional confessions.

### 4. The "k" reply

- **Hook line:** "Fictional confession: a single 'k' can ruin a whole evening."
- **Script:**
  1. Show the hook, then a giant edited `k` bubble.
  2. A fictional adult stares at it in disbelief.
  3. The doll gets three tiny paper punches.
  4. Overlay: "three hits. one letter."
  5. End card asks: "What is your worst text reply?"
- **Flow/Veo prompt:** `Vertical 9:16, 8-second dark-comedy phone reaction. An adult sits on a sofa, sees an implied short text reply on a phone without showing screen text, slowly looks at camera, then uses a small plush doll as a harmless stress toy with three exaggerated gentle taps. Snappy jump cuts, playful impact sounds, natural room audio, no readable text or logos.`
- **Sound suggestion:** Three toy squeaks and a record scratch.
- **Pillar:** Comment bait with a boundary.

### 5. The group-chat ghost

- **Hook line:** "Fictional confession: you saw the plan. You just chose chaos."
- **Script:**
  1. Show a fictional group plan on paper, with one empty seat.
  2. The empty chair creaks.
  3. A doll is made to "read" a tiny apology note.
  4. Overlay: "seen at 2:04."
  5. End on the reel replay.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second cinematic dark-comedy scene at a cafe table with three adult friends and one empty chair. One friend puts a tiny folded note in front of a handmade cloth doll, then the doll gently topples over. Natural cafe ambience, handheld close-ups, funny rather than hostile, no readable text, no logos.`
- **Sound suggestion:** Cafe murmur, chair squeak, tiny drum sting.
- **Pillar:** Fictional confessions.

### 6. The fridge shelf war

- **Hook line:** "Fictional confession: the top shelf is not a democracy."
- **Script:**
  1. Hook over an absurdly organized fridge shelf.
  2. A roommate moves one yogurt by one inch.
  3. Cut to a doll balanced on a tiny fridge shelf.
  4. Overlay: "territory disputed."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second hyper-specific domestic dark-comedy skit. Close-up of an organized refrigerator shelf, an adult hand moves one yogurt one inch, then cut to a handmade cloth doll balanced on a miniature fridge shelf that wobbles safely. Bright fridge lighting, close-up phone video, cartoonish wobble sound, no text or logos.`
- **Sound suggestion:** Refrigerator hum, spring boing, small laugh.
- **Pillar:** Petty payback.

### 7. Read receipts

- **Hook line:** "Fictional confession: blue ticks are a character test."
- **Script:**
  1. Hook appears over two edited blue ticks.
  2. An adult checks their phone, then checks it again.
  3. They give a doll a dramatic side-eye.
  4. Overlay: "message received. peace denied."
  5. Show the doll MP4 end frame.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second clean dark-comedy phone skit. An adult in a dim bedroom repeatedly checks a phone without showing any readable screen, notices a handmade cloth doll on the bedside table and gives it an exaggerated side-eye. Blue phone glow, crisp close-ups, restrained comedy, subtle notification sound, no text or logos.`
- **Sound suggestion:** Notification ping slowed down, then silence.
- **Pillar:** Fictional confessions.

### 8. The apology with conditions

- **Hook line:** "Fictional confession: 'sorry you felt that way' is not an apology."
- **Script:**
  1. Hook in black type on paper.
  2. A fictional actor hands over an apology card.
  3. The card unfolds into a very long disclaimer.
  4. The doll receives one comic burn-mark sticker, not flame.
  5. End: "write it. hit send."
- **Flow/Veo prompt:** `Vertical 9:16, 8-second paper-craft dark-comedy skit. Two adults at a neutral cafe table. One slides an apology card across; it unfolds into an absurdly long accordion paper strip. Cut to a handmade cloth doll receiving a harmless red paper sticker. Paper texture, handcrafted stop-motion feel, light comedic percussion, no fire, no text, no logos.`
- **Sound suggestion:** Accordion-paper unfold and tiny cymbal.
- **Pillar:** Petty payback.

### 9. Birthday with no plan

- **Hook line:** "Fictional confession: you remembered my birthday at 11:58 PM."
- **Script:**
  1. Start with a birthday candle almost burned out.
  2. Fictional friend looks at their phone too late.
  3. A doll wears a tiny party hat and gets a sad party blower.
  4. Overlay: "technically remembered."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second bittersweet dark-comedy birthday skit with adult friends. A single cake candle is nearly out, a friend notices their phone too late, then a handmade cloth doll in a tiny party hat gets a comically sad party blower sound. Warm low light, close-up phone video, kind and harmless, no text or logos.`
- **Sound suggestion:** Deflated party horn and soft piano note.
- **Pillar:** Fictional confessions.

### 10. The playlist betrayal

- **Hook line:** "Fictional confession: you skipped the song I sent you."
- **Script:**
  1. Hook over a pair of headphones.
  2. Fictional friend skips forward after one second.
  3. Doll is spun gently like a record scratch.
  4. Overlay: "unforgivable at track two."
  5. End card asks viewers for their no-skip song.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second stylish dark-comedy music skit. An adult wears headphones, dramatically skips an imagined song after one beat, then a handmade cloth doll gently spins on a small turntable. Moody colored lamp, one record-scratch sound, safe playful motion, no lyrics, no readable text, no logos.`
- **Sound suggestion:** Platform-cleared beat interrupted by a record scratch.
- **Pillar:** Comment bait with a boundary.

### 11. The fictional inbox reveal

- **Hook line:** "POV: you get an anonymous confession with a doll GIF."
- **Script:**
  1. Put `Fictional reenactment` above the hook.
  2. An adult fictional recipient opens a generic email mockup with no real message.
  3. Their face changes from concern to laughter.
  4. They tap "share" on a clearly fake, edited replay card.
  5. End: "Would you share it or send one back?"
- **Flow/Veo prompt:** `Vertical 9:16, 8-second fictional reaction skit featuring an adult at home. They open a laptop with an intentionally blank generic email layout, react with surprise then laughter, and hold up a phone showing only abstract animated shapes. Bright natural light, fast reaction cuts, no readable screens, no brand logos, no text.`
- **Sound suggestion:** Audible inhale, laugh, camera shutter.
- **Pillar:** Inbox aftermath.

### 12. Love mode plot twist

- **Hook line:** "Fictional confession: I am mad because I miss you."
- **Script:**
  1. Open on the severe-looking doll.
  2. Reveal the tool is "love," not punch.
  3. Add a tiny paper heart to the doll.
  4. Overlay: "0 hits. feelings everywhere."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second warm dark-comedy reversal. A handmade cloth doll hangs against a paper background and looks severe, then an adult hand adds a small red paper heart and gently rocks the doll. Hand-drawn ink style, warm lighting, tiny heart flutter sound, no text or logos.`
- **Sound suggestion:** Suspense sting turning into a soft pop.
- **Pillar:** The doll is the joke.

### 13. The overexplainer

- **Hook line:** "Fictional confession: this voice note has chapters."
- **Script:**
  1. Show a fictional 9-minute waveform, made in edit.
  2. The listener ages one second with a paper beard sticker.
  3. Doll gets a tiny microphone and keeps talking.
  4. Overlay: "chapter 7: still not the point."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second absurd dark-comedy skit. An adult listening to a long implied voice note gains a silly paper beard in a jump cut, then a handmade cloth doll holds a tiny cardboard microphone and gestures enthusiastically. Paper-craft styling, fast comedic timing, one muffled chatter sound, no text or logos.`
- **Sound suggestion:** Fast-forward audio warble and a tiny microphone squeal.
- **Pillar:** Petty payback.

### 14. The "on my way" lie

- **Hook line:** "Fictional confession: you sent 'on my way' from your bed."
- **Script:**
  1. Hook over a blanket lump.
  2. The fictional friend types from under the covers.
  3. Doll waits by a miniature door with a tiny suitcase.
  4. Overlay: "ETA: emotional damage."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second cozy dark-comedy skit. An adult under blankets uses a phone with a guilty expression, while a handmade cloth doll waits beside a miniature cardboard front door holding a tiny paper suitcase. Morning bedroom light, cute handmade props, gentle comic music, no screen text, no logos.`
- **Sound suggestion:** Alarm clock, suitcase wheel squeak, short bass drop.
- **Pillar:** Fictional confessions.

### 15. The shared password

- **Hook line:** "Fictional confession: you changed the streaming password again."
- **Script:**
  1. Hook over a frozen television remote.
  2. An adult sees a generic sign-in screen with no text.
  3. Doll gets a tiny locked padlock sticker.
  4. Overlay: "friendship on trial."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second domestic dark-comedy skit. An adult on a couch points a remote at a television displaying abstract login shapes with no readable text, then places a tiny cardboard padlock beside a handmade cloth doll. Evening light, familiar phone-video realism, small lock click and comic sting, no logos.`
- **Sound suggestion:** Remote click, error blip, mock courtroom gavel.
- **Pillar:** Petty payback.

### 16. The loud chewer

- **Hook line:** "Fictional confession: your chewing has a soundtrack."
- **Script:**
  1. Show the hook with tiny animated sound waves.
  2. A fictional adult takes one absurdly loud chip bite.
  3. Nearby doll vibrates from the sound.
  4. Overlay: "bass boosted crunch."
  5. End card asks for harmless pet peeves.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second light dark-comedy dinner-table skit with adults. One person takes an exaggeratedly crunchy chip bite, and a handmade cloth doll near the plate vibrates comically from the sound. Clean close-up food photography, one amplified crunch, friendly expressions, no text or logos.`
- **Sound suggestion:** Comically amplified crunch with low bass rumble.
- **Pillar:** Comment bait with a boundary.

### 17. The reply-all disaster

- **Hook line:** "Fictional confession: your reply-all belongs in evidence."
- **Script:**
  1. Hook above a paper airplane marked "all," added in edit.
  2. Adult worker notices the send icon too late.
  3. Doll is buried under harmless paper notes.
  4. Overlay: "sent to everyone."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second office dark-comedy skit with adult coworkers. One realizes an email was sent too broadly without showing a readable screen, then a handmade cloth doll is gently covered by many blank sticky notes. Clean desk, paper flutter, quick guilty reaction, no text, no logos.`
- **Sound suggestion:** Whoosh, multiple notification blips, tiny gasp.
- **Pillar:** Fictional confessions.

### 18. The borrowed charger

- **Hook line:** "Fictional confession: you return chargers with 3 percent left."
- **Script:**
  1. Open on a red 3 percent battery icon, edit overlay.
  2. A friend hands back a charger too casually.
  3. Doll's tiny battery icon falls flat.
  4. Overlay: "charged with betrayal."
  5. End card.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second simple dark-comedy skit with adult friends. One hands back a phone charger casually, the other looks horrified, then a handmade cloth doll's tiny cardboard battery prop tips over. Bright daylight, crisp closeups, cable rustle and low battery beep, no readable text or logos.`
- **Sound suggestion:** Low-battery beep followed by a toy fall.
- **Pillar:** Petty payback.

### 19. The fictional share decision

- **Hook line:** "Would you put this anonymous doll replay on your Story?"
- **Script:**
  1. State `Fictional prompt` over the hook.
  2. Show an abstract doll replay with no confession text.
  3. Cut between a "share" and "make one back" button, both edit overlays.
  4. Ask viewers to choose A or B in comments.
  5. End card says `beatass.com`.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second polished fictional product-style skit. A handmade cloth doll swings gently against lined paper, with an adult hand hovering indecisively over a generic phone that shows abstract colored buttons and no readable interface. Fast clean edits, paper texture, short rising sound, no text or logos.`
- **Sound suggestion:** Ticking clock, then a bright button pop.
- **Pillar:** Inbox aftermath.

### 20. The harmless honesty test

- **Hook line:** "Name a harmless thing you would confess anonymously."
- **Script:**
  1. Put "No names. Keep it kind." under the hook.
  2. Show three fictional examples: cereal, hoodie, playlist.
  3. Doll gets one different reaction to each.
  4. Overlay: "funny, not cruel."
  5. End on a prompt to make a real message only if it is safe to send.
- **Flow/Veo prompt:** `Vertical 9:16, 8-second fast handmade montage. A cloth doll appears in three playful paper-craft scenes: beside cereal, inside a tiny hoodie, then next to a tiny turntable. Friendly dark-comedy tone, stop-motion feeling, clean background, three small comic sound effects, no readable text, no logos.`
- **Sound suggestion:** Three quick pop sounds and an original voiceover question.
- **Pillar:** Comment bait with a boundary.

## 6. Thirty-day calendar

**Cadence**

- Instagram: one Reel daily at a consistent test window for the first 20 days, then one winner remix or reply Reel daily for ten days. Add one or two Stories daily: a Reel reshare, a real comment response, or a poll. Do not invent replies for Stories.
- TikTok: post the same clean master on the same day, with a TikTok-native caption and cover. On days 21 to 30, add a second post only when replying to a real high-signal comment or remaking a proven hook. Do not pad volume with weak posts.
- Feed: two simple still or carousel posts each week, built from the strongest real Reel frames. No need to post separately every day.
- Community and directories: one careful, rule-checked launch submission per week. Never spray the same copy everywhere.

| Day | Reel and TikTok | Instagram Story | Learning goal |
|---|---|---|---|
| 1 | Concept 1, Cereal dinner | Poll: cereal dinner yes or no | Test instantly specific hook |
| 2 | Concept 2, Calendar invite revenge | Reshare Reel | Test work-relatability |
| 3 | Concept 3, Borrowed hoodie | Poll: return it or keep it | Test friendship stakes |
| 4 | Concept 4, The k reply | Ask for worst harmless text reply | Test comment prompt |
| 5 | Concept 5, Group-chat ghost | Question box: harmless flake story | Test social-plan hook |
| 6 | Concept 6, Fridge shelf war | Vote top shelf or bottom shelf | Test domestic petty hook |
| 7 | Concept 7, Read receipts | Reshare best real comment | Test short, universal frustration |
| 8 | Concept 8, Conditional apology | Poll: apology accepted yes or no | Test opinion split |
| 9 | Concept 9, Late birthday | Question: too late or still counts | Test soft emotional edge |
| 10 | Concept 10, Playlist betrayal | Ask for no-skip song | Test music-related comments |
| 11 | Concept 11, Fictional inbox reveal | A or B: share or send one back | Test recipient-loop framing |
| 12 | Concept 12, Love mode plot twist | Heart reaction slider | Test warmth against anger |
| 13 | Concept 13, Overexplainer | Poll: voice note or call | Test visual absurdity |
| 14 | Concept 14, On my way lie | Question: latest believable ETA | Test concise confession |
| 15 | Concept 15, Streaming password | Poll: fair or foul | Test shared-life scenario |
| 16 | Concept 16, Loud chewer | Keep names out reminder | Test sensory comedy |
| 17 | Concept 17, Reply-all disaster | Reshare an actual safe comment | Test workplace-adjacent premise |
| 18 | Concept 18, Borrowed charger | Poll: charger return rules | Test simple visual payoff |
| 19 | Concept 19, Fictional share decision | A or B question | Test direct viral-loop question |
| 20 | Concept 20, Harmless honesty test | Invite kind answers only | Test safety-forward engagement |
| 21 | Remake best hook with a new fictional line | Explain it is a remake | Confirm winner is repeatable |
| 22 | Reply Reel to one real safe comment | Show exact comment with permission if identifiable | Test comment-to-content |
| 23 | Doll-only satisfying montage | Behind-the-scenes Story | Test product curiosity |
| 24 | Remake second-best hook | Poll chooses ending | Compare endings |
| 25 | Fictional inbox aftermath sequel | Share or send-back question | Test recipient conversion framing |
| 26 | Best visual gag, tighter 7-second cut | Retention screenshot only if real | Test completion rate |
| 27 | Best comment prompt with a new scenario | Safety reminder | Test comment quality |
| 28 | Product demonstration using a deliberately fictional sample | Show actual output format, labelled demo | Test site-click intent |
| 29 | Remake top video with a different first frame | A/B in caption, not fake poll results | Test first 1.5 seconds |
| 30 | Month recap made only from real posts and real metrics | Thank viewers without fake claims | Pick next ten experiments |

## 7. In-product share-loop changes

These are product recommendations, not permission to deploy. They preserve the current locked flow: the email has the full confession and GIF inline, anonymity is permanent, and block/report stay prominent.

### Sender result page

1. Make the MP4 the hero, already encoded and ready to share at 1080x1920.
2. Put one primary button first: `Share the replay`. It invokes the native share sheet with the MP4. Do not say "share to go viral."
3. Put two secondary buttons beside it: `Save video` and `Copy caption`.
4. Default copy caption: `Someone had feelings and took it out on a doll. Make one at beatass.com`.
5. Add `Make another` below the share controls. It starts a fresh blank message, not a prefilled fake confession.
6. Say exactly what will happen before send: `They will receive your exact words and this doll GIF. You stay anonymous.`
7. Add a short boundary near the form: `Keep it funny, not cruel. No threats, private facts, or dogpiles.`

### Recipient email

Keep the actual confession and GIF inline. Add a clean, optional bridge below them:

```text
Someone wrote this. We did not.

[Open the replay]
Share it if you want, or make a doll for someone else.

[Make a doll]

Report this message | Block my address forever
```

`Open the replay` must lead to the recipient's private message page, not a public page. That page can offer the MP4 and native share sheet. `Make a doll` leads to the normal blank creator page. It must not reveal or hint at the sender.

Subject line candidates, filled only with the real recipient name:

- `[Name], someone took it out on a doll`
- `[Name], this came with a tiny amount of chaos`
- `[Name], someone finally wrote it down`
- `[Name], your anonymous confession has a replay`
- `[Name], this is awkward in GIF form`

Use one subject per send, never an A/B test with fake or altered confession content. Test subject performance only after delivery, spam, complaint, and block safeguards are confirmed.

### Share-card rules

- Brand the exported MP4 with `beatass.com`, small but readable, from the start of the clip.
- Do not put the recipient's email, full name, sender data, a public message token, or a fake "sent to X" counter on the card.
- Let the recipient decide whether the full confession appears in a share card. A safer default is the doll plus a short, editable quote or no quote.
- Give public Reel content a visible `Fictional reenactment` label. Never use a real private confession as promotional content without the recipient's explicit written permission.

## 8. SEO checklist

### Realistic keyword targets

Start with intent clusters, not invented search-volume claims. As of 2026-08-03, live keyword-tool access was unavailable in this research environment. Validate volume and difficulty in the free Google Keyword Planner before prioritising pages, then validate actual impressions and queries in Google Search Console after launch.

| Intent | Start with these phrases | Page target |
|---|---|---|
| Direct tool | `send anonymous email`, `anonymous confession`, `send a confession anonymously` | Homepage |
| Distinctive format | `voodoo doll online`, `make a voodoo doll gif`, `anonymous message gif` | Homepage and FAQ |
| Situation help | `anonymous confession to ex`, `anonymous message to roommate`, `anonymous apology to friend` | Situation pages |
| Educational | `how to send an anonymous message safely`, `anonymous message etiquette` | Short guide or FAQ |

Avoid trying to rank first for broad terms such as `anonymous app` or `confession app` before the domain has authority. They are competitive and ambiguous. The better early wins are long, exact situation phrases that match a real page and a Reel caption.

### Homepage and technical work

- Use one plain H1: `Send an anonymous confession with a voodoo doll replay`.
- Add 250 to 400 words of useful, visible copy beneath the tool: what it does, what the recipient receives, permanent anonymity, and the funny-not-cruel boundary.
- Add a short FAQ with real answers: is it free, what does the recipient receive, can I share the replay, can I block messages, and can beatass reveal the sender. Do not invent a user count or review schema.
- Give the page a specific title and description. Example title: `beatass - Send an anonymous confession with a doll GIF`. Example description: `Write an anonymous confession, take it out on a hand-drawn doll, and send the message with a replay.`
- Ensure the canonical URL, sitemap, robots file, Open Graph image, Twitter card, mobile viewport, HTTPS, and fast 9:16 media previews work.
- Use `WebApplication` structured data only for facts the page can prove. Do not add aggregate ratings, reviews, prices, or download counts unless they are real and displayed.
- Track only needed, consent-aware events: landing view, start, export ready, share-sheet opened, send success, recipient replay open, and recipient chooses `Make a doll`.

### Situation-page test

Build only after the homepage is stable and the first 20 videos establish which situations people care about. Each page must have unique advice and a non-abusive prompt, not a mass-produced synonym page.

Good first candidates:

- `/confession/roommate`
- `/confession/ex`
- `/confession/best-friend`
- `/confession/coworker`
- `/confession/apology`

Each needs a distinct title, 250 or more useful words, a situation-specific but editable starter prompt, a link back to the tool, and the same safety, block, and anonymity policy. Do not create pages for minors, schools, revenge, humiliation, or threats.

## 9. Directory-launch checklist

Submit one at a time, using the actual live product and an honest maker description. Do not claim traction that has not happened.

| Place | Action | Guardrail |
|---|---|---|
| Product Hunt | Prepare gallery, short demo video labelled as demo or fictional, maker story, and support plan before scheduling. | Launch once, answer real comments, and never ask for paid or coordinated upvotes. |
| Uneed | Submit the real tool with concise screenshots and its privacy/block promise. | Check current submission terms before posting. |
| Peerlist Launchpad | Submit as a small web product with an honest one-line description. | No fake maker story or user claim. |
| BetaList | Submit only if its current editorial process accepts consumer web tools. | Do not represent an unlaunched feature as live. |
| AlternativeTo | Request listing only if beatass is genuinely comparable to anonymous-message tools and the profile can be accurate. | Do not create misleading competitor comparison pages or vote rings. |
| Indie Hackers Product | Share the build and lessons in a maker context. | Do not turn a discussion into repeated link drops. |

Before each submission: confirm the domain is reachable, recipient email works for real addresses, block/report works, privacy and terms pages exist, the demo does not look like a real received message, and the platform's rules were checked that day.

### Community list and self-promotion checks

Reddit rules change frequently. Re-open the linked rules page immediately before any post and obey the current wording. Make a useful native post first and treat a link as optional.

| Community | Possible angle | Current-safe reading of self-promotion posture | Rules link |
|---|---|---|---|
| r/SideProject | Build story and a short demo | Usually welcomes original side projects, but check flair and any posting frequency limit. | https://www.reddit.com/r/SideProject/about/rules/ |
| r/IMadeThis | Show the doll interaction and explain the build | Use only if the work is genuinely yours and current rules allow the format. | https://www.reddit.com/r/IMadeThis/about/rules/ |
| r/InternetIsBeautiful | Submit only when the site is fully public and immediately useful | High moderation risk. Do not post if current rules exclude self-promotion or require a specific title format. | https://www.reddit.com/r/InternetIsBeautiful/about/rules/ |
| r/indiehackers | Share a candid launch retrospective after data exists | Do not use it as a launch-day traffic dump. | https://www.reddit.com/r/indiehackers/about/rules/ |
| r/startups | Ask a specific product or growth question, not for clicks | Treat direct promotion as likely disallowed unless the current rules explicitly permit it. | https://www.reddit.com/r/startups/about/rules/ |

Do not post in youth, school, relationship-advice, revenge, or harassment communities. Do not make alt accounts, manipulate votes, or repost after removal.

## 10. Seeding and outreach

### Who belongs on the seed list

Prioritise creators and meme pages that meet all of these:

- Their audience is adult and broad enough for relationship, roommate, work, or friend humor.
- They posted original, short-form comedy or reaction content in the last 14 days.
- Their comment section is active and reasonably moderated.
- Their bio or contact page says pitches, submissions, collaborations, or business contact are welcome, or they have already opted in by asking for tools to try.
- Their humour is teasing and situational, not humiliation, doxxing, or teen drama.
- The proposed clip is an original fictional scenario made for them. It is not a fake user confession.

Keep a simple spreadsheet with handle, platform, audience fit, public-contact basis, date contacted, response, opt-out, and one follow-up maximum. Stop immediately when someone says no or asks not to be contacted.

### Tactic safety board

| Tactic | Status | What to do |
|---|---|---|
| Post original Reels and TikToks from @_beatAss_ | GREEN | Use the calendar, clear fictional labels, original media, and real conversation. |
| Reply publicly to someone who asks for the link | GREEN | Say `link in bio` or answer the specific question once. |
| Email through a creator's public contact form that specifically invites pitches or submissions | GREEN | Send one relevant, personal note with identity, purpose, and no automatic follow-up. |
| Email a generic public business address | AMBER | Human decides. Send one relevant, lawful message with a real opt-out path and do not follow up unless invited. |
| Give a creator an original fictional clip they asked to see | GREEN | Label it fictional and make clear they are free to ignore it. |
| Post to a directory or subreddit that currently permits the post | GREEN | Check the rules on the day and disclose you made the product. |
| Manually send a one-off cold DM to a highly relevant adult creator with a public "DM for collabs" invitation | AMBER | Human decides case by case. One message, no automation, no follow-up unless invited. |
| Offer a free custom fictional reel to a meme page | AMBER | Human decides. Keep it original and do not ask for access, post guarantees, or an undisclosed endorsement. |
| Ask a happy recipient for written permission to feature their real replay | AMBER | Human decides. Get clear, specific consent and offer an easy no. Never use silence as consent. |
| Run the approved recipient notifier for marketing prospects | RED | It is approved only for recipients of a real message, not growth outreach. |
| Bulk DM people, scrape handles, use DM automation for acquisition, or message a list of commenters | RED | Unsolicited mass outreach risks platform enforcement and violates the approved notifier boundary. |
| Send bulk cold email or buy a mailing list | RED | Spam, deliverability harm, and possible legal violations. |
| Buy followers, likes, views, comments, or join engagement pods | RED | Fake engagement damages reach quality and violates the launch rules. |
| Seed fake confessions, reactions, screenshots, user counts, or testimonials | RED | Deceptive and specifically prohibited by venture law. |

### Outreach messages

Only use these when the person publicly invites submissions or has opted in. Replace every bracket with a real fact. Do not send the same message at volume.

**Creator email or DM**

```text
Hi [Name], I am [Your name], the maker of beatass.com.

I saw your [specific recent post]. I made a free, anonymous-confession tool where the sender writes the message and takes it out on a hand-drawn doll. It creates a GIF and vertical replay.

I think a fictional [roommate/playlist/etc.] skit could fit your style. No payment, no posting obligation, and no account access needed. If you want, I will send one original fictional concept. If not, no follow-up from me.
```

**Reply after they ask for a sample**

```text
Thanks. Here is a fictional concept, not a real user message: "[one harmless line]." I can make it as a clean 9:16 clip with no watermark, then you can decide whether it is useful. I will not publish it or describe you as a partner unless you say yes in writing.
```

**Directory or community disclosure**

```text
I made beatass.com. It lets a person write an anonymous confession, take it out on a hand-drawn doll, and send the real message with a replay. It is free. We do not fake messages or reveal senders, and recipients can report or block messages. I would value feedback on [one specific question].
```

## 11. Metrics and kill-or-scale rules

Start with a spreadsheet, Instagram Insights, TikTok Analytics, Search Console, and privacy-respecting first-party events. Compare a test with the account's own rolling median, not a celebrity benchmark.

| Experiment | Measure | Scale when | Kill or change when |
|---|---|---|---|
| First-frame hook | 3-second view rate and average watch time | Three posts beat the 10-post median by 25% or more | Five posts are 20% below the median: replace the first 1.5 seconds |
| Short comedy format | Completion rate for clips under 12 seconds | Completion is at least 40% and shares are at least 1% of reach on three posts | Five posts have completion below 25% and shares below 0.3% of reach |
| Comment prompt | Meaningful, safe comments per 1,000 reach | At least 10 relevant comments per 1,000 reach without moderation issues | Mostly name-calling, targeting, or no relevant replies: retire the prompt |
| Reel to site | Profile visits, bio-link clicks, and landing sessions per 1,000 reach | Link-click rate exceeds the account median by 25% | A high-view clip gets no relative click lift: change CTA or match product closer to hook |
| Landing page | Start rate and send-success rate | At least 20% of sessions start and at least 25% of starters successfully send | Five hundred sessions with low starts: move the doll/demo above form and shorten copy |
| Recipient loop | Private-replay opens, voluntary share-sheet opens, and new sends after recipient open | At least 10% open replay and at least 3% choose a share action or make another message | After 100 successful sends, under 1% choose either action: rewrite email bridge and improve replay payoff |
| Outreach | Positive replies and voluntary creator posts | Three relevant positive replies per 25 carefully qualified contacts | Fewer than one positive reply per 25: tighten creator fit or stop, never increase volume |
| Search pages | Impressions, indexed pages, clicks, and engaged sessions | A situation page earns impressions and useful engagement within 90 days | Thin pages have no impressions after 90 days: consolidate rather than mass-produce pages |

### Weekly decision ritual

Every seven days, make three decisions only:

1. Keep the two hooks with the best share rate and retention relative to median.
2. Rewrite or stop the two weakest formats.
3. Ship one small, measurable product-loop improvement only if real sends and recipient behavior show the bottleneck.

Reach without real sends is entertainment, not product growth. Real sends without recipient replay opens show an email or deliverability problem. Recipient shares or repeat sends are the strongest proof that the loop has life.

## 12. First seven days, in order

1. Verify the live product path with a real internal send: form, email, full inline confession, GIF, private replay, MP4, report, and permanent block.
2. Add UTM names for Instagram, TikTok, directories, and each creator experiment. Do not put recipient tokens in public URLs.
3. Produce concepts 1 through 7, keeping all of them fictional and text overlays editable.
4. Configure the Instagram queue with seven clean MP4s and captions. Run a dry run before every change to the poster.
5. Publish day 1 manually or through the existing post queue. Do not modify the approved DM notifier.
6. Check comments twice daily, remove/report abuse using platform tools, and answer only genuine safe questions.
7. Review day 1 through 3 data before producing the next seven. Double down on a clear winner, not on the loudest opinion.

## Research base

See the five companion files in `marketing/research/`. Their source lists record URLs and 2026-08-03 access dates. Where direct browsing was blocked, they explicitly mark the finding as From-memory rather than presenting it as live-verified.
