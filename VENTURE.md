# VENTURE.md — passport: beatass

| Field | Value |
|---|---|
| **Name / slug** | beatass (beatass.com — anonymous confession + voodoo-doll GIF) / `beatass` |
| **Type** | `product-build` (`~/Claude/Projects/banyan/brain/playbooks/product-build.md`) |
| **Status** | `active` |
| **Born** | 2026-08-02 · **resident graft** — lives at `~/Claude/Projects/banyan/ventures/beatass`, moved the same day from `~/Documents/beatass` on Sanjay's explicit go ("Do all there in correct order", choosing option C). Keeps its own git repo and its own remote. Ledger: `evolution/approved/2026-08-02-graft-beatass-directed.md` |
| **Produces** | One shipped website — `beatass.com`: you write an anonymous confession, take it out on a voodoo doll, the beating is recorded as a GIF + a 1080×1920 MP4, and the confession is emailed to the person you named |
| **Needs** | (a) his wording for the Instagram-automation disclosure on the privacy page; (b) his sign-off on the new `@_beatAss_` profile bio text. *(The four items that used to sit here — Resend verification, GoDaddy → Cloudflare nameservers, the first-deploy yes, the OG image — are all DONE; verified 2026-08-06, see Vitals.)* |
| **Approval chain** | Sanjay — for every deploy, every DNS change, and anything that makes the site publicly reachable (rule 3). **Standing exception, directed 2026-08-03:** the Instagram DM notifier (`tools/instagram/notify.mjs --auto`, scheduled by `com.beatass.notify`) may send disclosed "someone left you a message" DMs automatically, unattended, without a per-message yes — his words, "make it automatic, don't skip the yes things." Bounded to: disclosed text only ("automated message from beatass.com"), the `ig:` block list honoured before every send, exact-handle match or skip, never-twice, ≤30/day, from `@_beatAss_` only. Kill switch: `launchctl unload ~/Library/LaunchAgents/com.beatass.notify.plist`. Ledger: `evolution/approved/2026-08-03-beatass-auto-instagram-dm-directed.md` |
| **Budget line** | ₹0 / $0 new spend without a fresh yes. Already paid for and in hand: the `beatass.com` domain (GoDaddy). Cloudflare Workers/R2/D1/KV and Resend are on free tiers today; the moment either needs a paid plan it is a fresh conversation, and a human clicks every payment button (rules 6 + 12) |
| **Memory** | Its own docs are the source of truth: `HANDOFF.md` (current state + next jobs) · `DESIGN-PROMPT.md` (the brief and the decisions table — decisions already taken, do not reopen) · `VIRAL-RESEARCH.md` (why the product is shaped this way) · `CLAUDE.md` (house rules) · `README.md` (what it is, how to build and test). Session notes land in the trunk's `memory/daily/` |
| **Skills** | Banyan pack (pointer in `CLAUDE.md`) — no venture-local skills yet. `cloudflare` / `wrangler` / `workers-best-practices` skills apply to the backend work |
| **Vitals** | 🟡 — **LIVE and working end to end at `https://beatass.com`.** Re-verified from the outside 2026-08-06: site returns HTTP 200 serving the real app (not a placeholder); Worker `beatass` deployed 2026-08-04, version `71f5b1fa` at 100% traffic; `MAIL_FROM` is `someone@beatass.com`, so Resend domain verification is DONE; nameservers are Cloudflare (`camilo`/`carrera`), SPF + DMARC (`p=quarantine`) + Resend DKIM all present; `og.png` serves 200 (92 KB). Delivery runs over email, WhatsApp and Instagram with an events action-log, sender fingerprinting, a block list, and retry/status/stuck tooling. Yellow — not green — because two items wait on Sanjay (privacy-page disclosure wording, new profile bio) and the message templates are still too long to get opened · 2026-08-06 |

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
| Worker | `beatass` — **deployed** 2026-08-04, version `71f5b1fa-09bf-4323-82cf-a76184189502` at 100% (`npx wrangler deployments list`, 2026-08-06) |
| R2 bucket | `beatass-media` |
| D1 database | `beatass-db` — `a9133d8f-4232-4945-99ee-0cbb9c072c77` |
| KV namespace | `RATE` — `54544f05b7204b5ca917b0490ef833f8` |
| D1 schema | applied to remote — tables `messages`, `blocklist` |
| Secrets | `RESEND_API_KEY`, `BLOCK_SECRET` — both set in production |

*(Verified live 2026-08-02 with `wrangler d1 list` / `r2 bucket list` / `kv namespace list`: the R2 bucket, the D1 database and the KV namespace all exist under this account with these exact IDs. The D1 schema and the two production secrets are as recorded in `HANDOFF.md` and were not separately re-checked.)*

### Secrets — rule 5 status

Verified clean at graft (2026-08-02): `.dev.vars` is listed in `.gitignore` and is **not** tracked by git. Standing item: the Resend API key was pasted into a chat transcript, so rotating it (`npx wrangler secret put RESEND_API_KEY`) is the careful move — Sanjay's call, and a human does it.

### Open, in priority order

*Rewritten 2026-08-06. The previous list (wire `send()`, deploy, Resend verification, DNS + SPF/DKIM/DMARC, SEO + OG image) was written 2026-08-02 and every item on it has since shipped — each one re-verified against the live system before this rewrite, not taken from prose.*

Live work, from the 7-item list Sanjay set 2026-08-05 (detail in `HANDOFF-TEMPLATES-OPENRATE.md`):

1. **Shorten the message templates** (email / WhatsApp / Instagram) so they actually get opened — the juicy line must come LAST, and the link may be hurting deliverability. Active task.
2. Intermittent Instagram send errors — findings already captured, do not re-derive.
3. Redesign the reply-email step (people miss it) — remove the checkbox: `template.html` `#f-sender`, then `build.py`.
4. Conversation feature: `/reply` relays one email today, Sanjay wants a back-and-forth thread.
5. Favicon + `<title>` showing correctly in Google search results.
6. The personal link (`beatass.com/priya`) — lowest priority. If built, store the doll's *choreography* (~500 bytes, seeded generator) and not the video.

Waiting on Sanjay: privacy-page Instagram-automation disclosure wording · new `@_beatAss_` profile bio text.

### Decisions already taken — do not reopen

No age gate (raised twice, declined twice; an "18+" line in the footer is the extent of it) · the email carries the full confession inline with a personalised subject · `beatass.com` stays, no new domain · anonymity is permanent, never revealed, never hinted at, never sold · never fake a message to make the product look busy · report + block links stay in every email and get more prominent, never less. Full table at the bottom of `DESIGN-PROMPT.md`.

The last two are load-bearing, not preferences: the FTC fined NGL $5M partly for selling "hints" about senders and partly for faking messages. They are also the honesty law (rule 4) in this venture's own words.

### Open question for Sanjay (inherited, still unanswered)

The design handoff's README describes a phone layout where the doll comes first and the page scrolls; the actual `AppScreen.jsx` puts the recipient fields first with `overflow:hidden`. **The code was followed.** Confirm that order, or switch to the README's.

### Git

Own repo, branch `main`, clean tree at graft time, remote `https://github.com/luv-jeri/beatass` (public). Current build published at `https://luv-jeri.github.io/beatass/beatass.html`. Nothing is pushed without Sanjay's word.
