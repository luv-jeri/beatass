# beatass — handoff: message templates + open rate + the Instagram issue (2026-08-05, ~23:00 IST)

Read this to continue in a fresh session. The job: make the delivered messages
SHORT and actually get opened, and run down whatever is off with Instagram
sending. Sanjay's words this session:

> "Instagram is not working, there is some issue with the Instagram sending
> message. We need to fix the templates of Instagram, WhatsApp and email as
> nobody is opening it. Make the template short, very short, and the LAST message
> must be the real message so it will be shown. Maybe don't have a link in the
> message - that may be causing the issue. Do the research on the internet and
> find the real issue."

---

## THE ONE-LINE STATUS

Delivery + logging are solid and live (this session shipped the whole
observability layer and fixed two real send bugs). The open problem is now the
CONTENT of the messages - they're too long, the juicy part is buried, and the
link may be hurting deliverability/opens. Plus a proper look at intermittent
Instagram send errors.

## THE MISSION, CONCRETE

1. **Rewrite all three templates SHORT** (Instagram DM, WhatsApp, email).
2. **Put the confession LAST** so the phone's notification preview shows the
   actual message, not an intro or a disclaimer. Sanjay's insight: the preview
   shows the LAST message - make it the one that makes someone tap.
3. **Try removing the link** from the message body (or making it not look like a
   spam link). Research whether links are hurting deliverability/opens.
4. **Research the real Instagram issue** (below) before assuming.

## RESEARCH THIS FIRST (do it in the FRESH session, not carried from here)

Do the web research with fresh context - fetched pages fill context fast, so
it's better done at the start of the new session than dragged through this one.
Questions to answer, with my starting hypotheses (VERIFY, don't trust):

- **Do links in cold DMs/emails hurt opens?** Hypothesis: yes.
  - Email: links + image-heavy HTML + "unsubscribe"-style footers push cold mail
    to spam. Plain-text-feeling, few/no links, personal tone deliver better.
  - Instagram: a link in a DM to someone who doesn't follow you lands in their
    Requests folder and can be filtered harder; link-heavy cold DMs can get an
    account action-blocked. Text-only first touch tends to land better.
  - WhatsApp: a link in the first message from an unknown number raises spam-
    report and block risk, and can get the sender number flagged.
- **What's the notification-preview length** on WhatsApp/Instagram/email so the
  confession isn't cut off? Design the last message to fit the preview.
- **Is the Instagram account rate-limited / action-blocked?** `outreach.mjs` has
  a cool-off state; `tools/instagram/health.mjs` runs selector checks. Check both.

## THE INSTAGRAM ISSUE - WHAT I ACTUALLY FOUND (don't re-derive)

Checked live at ~23:00 IST 2026-08-05:
- The timer `com.beatass.notify` is loaded and running every 2 min.
- Last 24h: **5 delivered, 14 bubbles sent, 0 gave-up** - so it is NOT fully
  broken. Real DMs are going out.
- `auto.log` shows repeated "auto: nothing waiting" - the queue is currently
  empty, so a fresh send hasn't been exercised in the last little while.
- There ARE intermittent `skip`/`retry` events with `outcome=error` in the log.
  I could not read the full error text in the time I had (a JSON parse in my
  one-liner returned nothing). **Next session: read them properly** -
  `node tools/status.mjs status <id>` on a recent Instagram message, or:
  `npx wrangler d1 execute beatass-db --remote --json --command "SELECT ts,action,detail FROM events WHERE channel='instagram' AND outcome='error' ORDER BY ts DESC LIMIT 10;"`
  then read each `detail.error`.
- **Ask Sanjay which specific send he saw fail** (a name/@handle). With an id,
  `status.mjs status <id>` shows its whole timeline in one command - that is the
  fastest path to the real symptom instead of guessing.
- Note: this session fixed a real Instagram bug (a wrong @handle used to retry a
  browser launch every ~3 min forever; commit 7af594f). If "not working" means
  something stopped delivering AFTER that, check whether a message is now
  (correctly) giving up after 3 tries when it should still be trying - if so the
  fix is right and the handle/target is the problem, not the sender.

## THE TEMPLATES - WHERE THEY LIVE AND HOW THEY'RE SHAPED NOW

All three currently send the SAME 3-part shape, in this order:
`1) intro  ->  2) the confession  ->  3) link + automated-message + block/report`.
Sanjay wants: SHORT, and the CONFESSION moved to LAST (link/disclaimer earlier or
gone).

| Channel | File | Function | Notes |
|---|---|---|---|
| Instagram DM | `tools/instagram/notify.mjs` | `dmParts(m, link)` ~line 192 | plain text, no emoji; 3 bubbles |
| WhatsApp | `tools/whatsapp/notify.mjs` | `waParts(m, link)` ~line 125 | emoji + bold (deliberate here); 3 bubbles |
| Email | `src/index.js` | `emailHtml({...})` ~line 100 | full HTML: header image, doll GIF, "Reply to them" button, links |

Reordering gotchas the next session must respect:
- **The confession is UNFORMATTED on purpose** (no bold/emoji around the quote) -
  keep that; it's what makes it read as a real message, not an ad.
- If the confession goes LAST, the block/report + "this is automated" safety line
  still has to appear somewhere - it's the product's anti-abuse defence (see
  `CLAUDE.md` "Things decided on purpose"). Don't delete it; move it earlier.
- WhatsApp keeps emoji/bold (documented exception); the SITE stays no-emoji.
- Instagram bubbles are sent by `sendBubble()`; email is one HTML doc. Changing
  the number/order of Instagram/WhatsApp parts touches `dmParts`/`waParts` only -
  the send loops iterate whatever the parts array holds.
- After ANY change: `npm test` (dm 38, whatsapp 62, browser no-scroll+GIF, all
  must stay green). The notifier selftests assert the parts array SHAPE (e.g.
  "a clipped body still splits in three") - update those assertions to match the
  new shape or they'll fail.

## HOW MUCH OF THE ORIGINAL (WHITEBOARD) GOALS ARE DONE

From the 7-item list Sanjay set 2026-08-05:
- **1. Log + track all data incl. device info -> compliant log — DONE.** Shipped
  the `events` action-log + sender fingerprint (browser/device/geo/hashed-IP),
  live on beatass.com.
- **2. Fallback + retry for messages — DONE.** Retry model + `status`/`retry`/
  `stuck` scripts; both send bugs fixed.
- **3. Robust pipelines, log each — DONE.** One D1 `events` table; laptop
  notifiers flush into it via `events-sync` (timer armed).
- **4. Change the templates (email/insta/WhatsApp) — THIS TASK, not started.**
- **5. Redesign the reply-email step (people miss it) -> remove checkbox —
  PENDING.** Touches `template.html` `#f-sender`, then `build.py`.
- **6. Conversation feature for replies — PENDING.** Today `/reply` relays one
  email; Sanjay wants a back-and-forth thread.
- **7. Favicon + <title> in Google search — PENDING.**

So: items 1-3 shipped this session, item 4 is the active task, 5-7 still open.

## WHAT SHIPPED THIS SESSION (all committed, NOT pushed - Sanjay's rule)

- `235c725` observability foundation (events log, sender fingerprint, sender-block) - DEPLOYED
- `76f5525` events-sync + admin fingerprint/block + status/retry/stuck - DEPLOYED
- `7af594f` Instagram: wrong handle no longer retries forever
- `2e588ea` WhatsApp: a partial send no longer marked delivered (root cause of a real broken message)
- Inderjeet (+91 7509618457) got his full message re-sent by hand and verified.
- 6 commits ahead of origin; **do not `git push`** until Sanjay says so.

Open decision left on the table: **abhay** (msg `5dd2e7ef2565c7e7`) - his WhatsApp
got the same partial, but he already has the full message via email + Instagram.
A = leave it (recommended), B = re-send his WhatsApp. Unanswered.

## FIRST FIVE MINUTES OF THE NEXT SESSION

```
git status                                   # clean? (sample.gif predates us, ignore)
git log --oneline -8                          # the commits above
node tools/log-check.mjs --hours 12           # what the pipelines did overnight
node tools/status.mjs stuck                   # anything stuck?
launchctl list | grep beatass                 # all 6 timers loaded?
```
Then: (1) ask Sanjay which Instagram send he saw fail, (2) do the link/opens
research fresh, (3) redesign the three templates short with the confession last,
(4) `npm test`, (5) show him the new copy BEFORE deploying (Outward law).

## THE FILES THAT MATTER

- Templates: `tools/instagram/notify.mjs` (`dmParts`), `tools/whatsapp/notify.mjs`
  (`waParts`), `src/index.js` (`emailHtml`).
- Diagnosis tools (built this session): `tools/status.mjs`, `tools/log-check.mjs`,
  `tools/events-sync.mjs`.
- The rules that bite: `CLAUDE.md` (never edit `beatass.html`; no-emoji site; keep
  the anti-abuse block/report line; run `npm test`).
- Prior handoff (observability, now largely done): `HANDOFF-DELIVERY-PIPELINE.md`.
- Durable memory: the auto-memory `delivery-pipeline.md` has the architecture,
  the retry model, and the two bugs fixed.
