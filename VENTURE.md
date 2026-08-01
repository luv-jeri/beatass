# VENTURE.md — passport: beatass

| Field | Value |
|---|---|
| **Name / slug** | beatass (beatass.com — anonymous confession + voodoo-doll GIF) / `beatass` |
| **Type** | `product-build` (`~/Claude/Projects/banyan/brain/playbooks/product-build.md`) |
| **Status** | `active` |
| **Born** | 2026-08-02 · **resident graft** — lives at `~/Claude/Projects/banyan/ventures/beatass`, moved the same day from `~/Documents/beatass` on Sanjay's explicit go ("Do all there in correct order", choosing option C). Keeps its own git repo and its own remote. Ledger: `evolution/approved/2026-08-02-graft-beatass-directed.md` |
| **Produces** | One shipped website — `beatass.com`: you write an anonymous confession, take it out on a voodoo doll, the beating is recorded as a GIF + a 1080×1920 MP4, and the confession is emailed to the person you named |
| **Needs** | (a) Sanjay verifies `beatass.com` inside Resend — until then email only reaches `unread.fyi@gmail.com` and everyone else silently gets nothing; (b) his call on GoDaddy → Cloudflare nameservers; (c) his yes before the first real deploy goes public; (d) an OG image for the share/meta tags |
| **Approval chain** | Sanjay — for every deploy, every DNS change, and anything that makes the site publicly reachable (rule 3) |
| **Budget line** | ₹0 / $0 new spend without a fresh yes. Already paid for and in hand: the `beatass.com` domain (GoDaddy). Cloudflare Workers/R2/D1/KV and Resend are on free tiers today; the moment either needs a paid plan it is a fresh conversation, and a human clicks every payment button (rules 6 + 12) |
| **Memory** | Its own docs are the source of truth: `HANDOFF.md` (current state + next jobs) · `DESIGN-PROMPT.md` (the brief and the decisions table — decisions already taken, do not reopen) · `VIRAL-RESEARCH.md` (why the product is shaped this way) · `CLAUDE.md` (house rules) · `README.md` (what it is, how to build and test). Session notes land in the trunk's `memory/daily/` |
| **Skills** | Banyan pack (pointer in `CLAUDE.md`) — no venture-local skills yet. `cloudflare` / `wrangler` / `workers-best-practices` skills apply to the backend work |
| **Vitals** | 🟡 — front end finished and browser-verified; backend written and its Cloudflare infrastructure live, but the two are **not connected** and nothing is deployed. Pressing Send today sends no email · 2026-08-02 |

---

## Notes — how this venture ACTUALLY works

Read in this order, per its own `HANDOFF.md`: `CLAUDE.md` → `README.md` → `HANDOFF.md` → `DESIGN-PROMPT.md` → `VIRAL-RESEARCH.md`.

### Shape

One file, no framework, no bundler. `template.html` is the source you edit; `python3 build.py` inlines the fonts and the GIF library and writes `beatass.html`, which is the finished site. `src/index.js` is the Cloudflare Worker (the backend). `test.mjs` is a real-browser test (`npm test`) across seven screen sizes.

### House rules that will bite (from its `CLAUDE.md` — treat as venture law)

- **Edit `template.html`. Never `beatass.html`** — the latter is generated and any direct edit is destroyed by the next build.
- Run `npm test` after any layout, doll, or export change. It catches the two failures invisible in the source: silent scrolling on small screens, and a broken encoder that still renders a plausible-looking `<img>`.
- No framework, no bundler, no emoji as icons (icons are inline SVG), nothing a perfect rectangle, three inks only.

### Live infrastructure (Cloudflare account `Unread.fyi@gmail.com`)

| Thing | Name / ID |
|---|---|
| Account | `25369d7051a3d996a1bca81f462a1fbc` |
| Worker | `beatass` (created; no code deployed yet) |
| R2 bucket | `beatass-media` |
| D1 database | `beatass-db` — `a9133d8f-4232-4945-99ee-0cbb9c072c77` |
| KV namespace | `RATE` — `54544f05b7204b5ca917b0490ef833f8` |
| D1 schema | applied to remote — tables `messages`, `blocklist` |
| Secrets | `RESEND_API_KEY`, `BLOCK_SECRET` — both set in production |

*(IDs as recorded in `HANDOFF.md` 2026-08-02; not re-verified against the live account at graft time.)*

### Secrets — rule 5 status

Verified clean at graft (2026-08-02): `.dev.vars` is listed in `.gitignore` and is **not** tracked by git. Standing item: the Resend API key was pasted into a chat transcript, so rotating it (`npx wrangler secret put RESEND_API_KEY`) is the careful move — Sanjay's call, and a human does it.

### Open, in priority order (from `HANDOFF.md`)

1. Wire `send()` in `template.html` to `POST /api/send` (multipart: `name`, `email`, `message`, `stats`, files `gif` + `mp4`; handle 403 blocklist / 429 rate-limit / 502 send-failure with their human-readable `error` strings).
2. `python3 build.py && npx wrangler deploy` — **deploy needs Sanjay's yes** (rule 3).
3. Verify `beatass.com` in Resend, then move `MAIL_FROM` off `onboarding@resend.dev` — this is the single biggest blocker on the product actually working.
4. DNS: GoDaddy → Cloudflare nameservers (his decision), then SPF + DKIM + DMARC. Not optional; without them the mail goes to spam.
5. SEO: `robots.txt`, `sitemap.xml`, the OG image (`https://beatass.com/og.png` is referenced but does not exist), structured data.
6. The personal link (`beatass.com/priya`) — lowest priority. If built, store the doll's *choreography* (~500 bytes, seeded generator) and not the video.

### Decisions already taken — do not reopen

No age gate (raised twice, declined twice; an "18+" line in the footer is the extent of it) · the email carries the full confession inline with a personalised subject · `beatass.com` stays, no new domain · anonymity is permanent, never revealed, never hinted at, never sold · never fake a message to make the product look busy · report + block links stay in every email and get more prominent, never less. Full table at the bottom of `DESIGN-PROMPT.md`.

The last two are load-bearing, not preferences: the FTC fined NGL $5M partly for selling "hints" about senders and partly for faking messages. They are also the honesty law (rule 4) in this venture's own words.

### Open question for Sanjay (inherited, still unanswered)

The design handoff's README describes a phone layout where the doll comes first and the page scrolls; the actual `AppScreen.jsx` puts the recipient fields first with `overflow:hidden`. **The code was followed.** Confirm that order, or switch to the README's.

### Git

Own repo, branch `main`, clean tree at graft time, remote `https://github.com/luv-jeri/beatass` (public). Current build published at `https://luv-jeri.github.io/beatass/beatass.html`. Nothing is pushed without Sanjay's word.
