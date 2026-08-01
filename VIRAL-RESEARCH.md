# Why beatass isn't viral yet — research and plan

Written 1 August 2026. Read this before the design work; it explains *why* the
design brief asks for what it asks for.

---

## 1. The thing that actually matters

Right now the product works like this:

> I type **your** email address → I write a confession about you → I beat a
> doll → we cold-email you.

One person sends. One person receives. Nobody else ever sees it. There is no
step in that chain where a new user is created. That is not a viral loop — it's
a mail merge with a cartoon attached. You could make this the most beautiful
website on the internet and it would still grow at exactly the rate you pay to
advertise it.

Every app that has actually blown up in the anonymous-message category ran the
loop the **other way round**.

### NGL (2021–2025)

NGL gave each user a personal link. The user posted that link on their own
Instagram Story: *"send me anonymous messages."* Friends clicked it, wrote
something anonymously, and the user then reposted the good replies back to
their Story — with the link visible again. Every repost recruited the next
round of senders.

That loop took NGL to **the #1 downloaded app on the US App Store by June
2022**, and the company later claimed it was approaching 300 million users.
Note the direction of travel: **the recipient does the marketing.** They are
motivated — they *want* messages about themselves — so they share hard and for
free.

### Sarahah (2016–2018)

Same shape. Personal link, anonymous inbound messages. It sat quiet for months
until **5 July 2017**, when Snapchat shipped the ability to put URLs in snaps.
Within about two weeks Sarahah was the #1 app. It reportedly reached 300M+
accounts.

The lesson there is even sharper: the product didn't change. The *sharing
surface* changed. Growth in this category is almost entirely a function of how
easily the link travels on someone else's social feed.

### One risk that does **not** apply to us

beatass is a **website**, not a phone app. That matters. Sarahah died because
Apple and Google removed it from their stores — a website cannot be removed
from a store it was never in. There is no review process, no install, and no
gatekeeper between a shared link and a new user. For a link-sharing loop, the
web is the *better* place to be.

The NGL risk still applies in full, though. The FTC acted against the
*company*, not the app listing. Being a website is no defence against that.

### What both of them prove

| | NGL / Sarahah | beatass today |
|---|---|---|
| Who shares? | The recipient, publicly, to hundreds | Nobody |
| Who is motivated? | The recipient (wants attention) | The sender only |
| Where does the link live? | Instagram/Snapchat Story | Nowhere |
| New users per message | Many (everyone who sees the Story) | Zero |
| Consent | The recipient opted in by posting the link | None — cold email |

---

## 2. The other thing both of them prove: this category kills itself

Read this part twice. It's the difference between a business and a lawsuit.

- **Sarahah was removed from both the Apple and Google stores by 26 February
  2018** after bullying accusations. A petition started by a parent whose
  13-year-old was abused on it gathered close to 470,000 signatures. It also
  got caught quietly uploading users' address books. It shut down permanently
  in December 2021.
- **NGL settled with the FTC and the LA District Attorney in July 2024.** Terms:
  a **$5 million payment**, an **outright ban on serving anyone under 18** —
  reported as the FTC's first total bar of its kind — and a mandatory age gate.
  Two things they were nailed for are worth memorising, because they are both
  tempting:
  1. **They faked messages.** The FTC found NGL generated 1,000+ messages
     itself, including *"I've had a crush on you for years,"* to make the
     product feel alive and push subscriptions.
  2. **They sold "hints" about who the sender was.** Vague, useless hints —
     approximate location, phone type. Internal messages showed staff calling
     paying users "suckers."

**Conclusions for us, non-negotiable:**

1. **18+ age gate from day one.** Not later. This is the single mistake that
   ends the company.
2. **Never fake a message.** Not one, not "just to seed the demo."
3. **Never sell sender identity or hints about it.** Anonymous means anonymous
   forever, including to us and to paying users.
4. **Never cold-email a confession into somebody's inbox.** The README already
   says this and it's right. Blind anonymous mail to people who never opted in
   is how the domain lands on spam blocklists, and it's the exact behaviour
   that got the category regulated.
5. **One-tap block and report, everywhere**, and the recipient can switch their
   own link off instantly.

The existing warning text and the "Report this" / "Block my address" links in
the mock email are correct instincts and must survive the redesign. What has to
change is *where they appear and how they're worded* — see §4.

---

## 3. Our unfair advantage (this is the good news)

NGL's shareable artifact was **a screenshot of a text box**. That's it. Grey
bubble, some words, repost.

Ours is **a hand-drawn animated GIF of a voodoo doll getting punched, pinned,
set on fire or loved, with the stat line burned in.** "14 hits · 6 pins ·
burned." That is a fundamentally better thing to put on a Story. It moves, it's
funny, it's specific to that one message, and nobody else has it.

The doll is not a gimmick bolted onto a confession app. **The doll is the
product.** The confession is the caption.

This has a direct consequence for the design: the GIF is not a preview asset,
it's the export format. It should be the most polished pixel in the whole
product, sized correctly for where it's going to live (Instagram Story 1080×1920,
feed 1080×1080), branded so the URL travels with it, and shareable in one tap.

### ⚠️ A GIF will not work on Instagram or Snapchat

This would silently break the entire growth plan, so it needs saying loudly.
**Instagram Stories and Snapchat do not accept animated GIF uploads.** Hand
either of them a `.gif` from the camera roll and it posts as a frozen still
image — the doll never moves, and the whole point is gone.

The shareable export must be a **video file (MP4)**, not a GIF.

The good news is this is *easier*, not harder. `canvas.captureStream()` plus
the browser's built-in `MediaRecorder` records the doll canvas straight to
video with no library at all — simpler than the current gif.js pipeline. Keep
GIF as a secondary export for email and messaging apps, where it does work.

---

## 4. What's wrong with the UI, specifically

Observed in a real browser at 1470×812 and read from `template.html`.

**The order of operations is backwards.** The very first thing on screen asks
for a stranger's name and email address. That is the highest-friction request
in the entire product and it's placed before the user has had one second of
fun. Nobody types an email address for a website they haven't enjoyed yet. The
doll — the only reason anyone would stay — is parked on the right, second in
reading order.

**Everything is small and nothing is a hero.** Section labels are 13px. The
gauges are 10px bars with 11px labels. The tool buttons are a thin toolbar. The
tagline is smaller than the logo. At 1470px wide there is a large empty region
and yet every element is competing to be tiny. There is no focal point, so the
eye has nowhere to land and the page reads as "busy but empty."

**The handwriting fonts are being asked to do a job they can't do.** Caveat and
Permanent Marker at 11–13px are genuinely hard to read — that's the complaint
you raised and it's correct. The hand-drawn charm is a real asset and should
stay, but it has to come from *the drawing*, not from setting functional UI text
in a script face.

**The lined-paper background is noise at desktop width.** Blue rules run
edge-to-edge across the full 1470px viewport, including the dead space either
side of the content, and the red margin line floats at an arbitrary position.
Full-bleed, it stops reading as "a page" and starts reading as "wallpaper."

**The "must fit on one screen with no scrolling" rule is the root cause of most
of the above.** It's an elegant constraint and it's strangling the product:
everything has to shrink to fit, so nothing can be big. Worst case is mobile,
where the confession textarea collapses to three lines (`height: calc(var(--rule-h)*3)`).
You cannot write a two-year-old secret in a three-line box.

**The doll is passive.** Thin strokes, blank face at rest, sitting still in a
large empty frame. Nothing about it says "hit me." First-time users don't know
it's interactive — hence the hint text having to explain it.

**The safety warning is an engineering note leaking into the UI.** It currently
reads: *"Blind anonymous mail is what gets a domain blocklisted; a plain
'someone left you a message' link they choose to open is the safer build."*
That's a note from the developer to themselves, printed above the send button,
telling the user that the thing they are about to do is bad practice. The
*substance* is right and must be kept. The *voice and placement* are wrong.

**There is no share surface at all.** No link, no copy button, no "share to
story," nothing to post. For a product whose entire growth depends on sharing,
this is the biggest single omission.

**No proof and no example.** A first-time visitor never sees what the finished
thing looks like before being asked to make one.

---

## 5. Recommended product change: turn the loop around

Keep everything that's good — the doll, the physics, the hand-drawn boil, the
GIF — and change who starts the interaction.

### Door A — the growth engine (new, and the default)

1. I claim my link: `beatass.com/priya`
2. I get **my own doll** and a share card
3. I post the link: *"anonymously tell me what you really think — then beat my
   ass"*
4. Friends open it, write a confession, and punch / pin / burn / love **my**
   doll
5. I get an inbox of confessions, each with its own GIF
6. I share the best ones to my Story — **with my link burned into the image**
7. Their followers see it → back to step 1

This is the NGL loop with a far better artifact. The recipient does the
marketing because they want the attention, and every share is a recruitment ad.

### Door B — sending to a specific person (the current flow, made safe)

Keep it, but change the delivery, exactly as the README already recommends:
the email is a neutral **"someone left you something at beatass.com"** with a
link the person chooses to open — not the confession dumped into their inbox.

The page they land on then converts them into Door A: *"want your own doll?"*
So Door B stops being a spam cannon and becomes an acquisition channel.

---

## 6. What we need to build (beyond the redesign)

Today there is **no backend at all** — nothing is stored and nothing is sent.
The inbound loop needs one. Minimum viable:

| Piece | What it does |
|---|---|
| Link/handle store | maps `beatass.com/priya` to an owner |
| Message store | confessions + a pointer to the GIF |
| File hosting | the GIFs (they're ~600 KB each; do **not** inline them in email) |
| Email sending | the neutral "you have something waiting" notification |
| Age gate | 18+, recorded, enforced |
| Moderation | word filter, rate limit, block, report, kill-switch per link |
| Auth | just enough for someone to own and check their link |

This is small — a single Cloudflare Worker with D1 (database) and R2 (file
storage) covers all of it cheaply. But it is a real scope step up from "one HTML
file," and it should be planned, not discovered mid-build.

---

## 7. Two flags worth a decision

**The domain name.** Since the whole plan is now "people post this URL to
Instagram and Snapchat," the name matters *more*, not less. `beatass.com` will
be filtered by school and workplace wifi, rejected by most ad networks, and is
the kind of domain social platforms flag once it starts being posted at volume
— Instagram and Snapchat both block links they classify as spam or abuse, and
once a domain is blocked the loop stops dead with no appeal.

Recommended fix: keep `beatass.com` as the brand, but buy a clean, neutral
second domain that redirects to it, and use *that* one in everything people
share. Cheap insurance against a single point of failure.

**The logo.** The current mark is a figure hanging from a rope. It reads as a
gallows / hanging. That's a different and much darker joke than "voodoo doll on
a string," and it's the kind of thing that gets screenshotted uncharitably.
Suggest re-drawing so the string clearly attaches to the doll's back or head as
a *puppet*, not a noose.

---

## Sources

- [NGL (app) — Wikipedia](https://en.wikipedia.org/wiki/NGL_(app))
- [Sarahah — Wikipedia](https://en.wikipedia.org/wiki/Sarahah)

Live web search was unavailable in this session; the two case studies above were
fetched directly. Figures sourced to company press releases (NGL's 300M) are
flagged as such in the source and should not be quoted as independent fact.
