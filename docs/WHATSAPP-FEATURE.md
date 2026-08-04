# Sending a confession by WhatsApp

The plan for adding WhatsApp as a third delivery channel, next to email and
Instagram. Written 2026-08-04, before any code.

---

## What a person using the site sees

One more field under "who's it for?":

```
their whatsapp   [ +91 ] [ 98765 43210 ]
```

The `+91` is printed into the field as a fixed label, not typed. We only
support Indian numbers, so there is no country picker and no way to get the
country code wrong.

The rule stays what it is today: **at least one** of email, Instagram, or
WhatsApp. Any one of the three is enough to deliver.

---

## How it works, end to end

```
the website (Cloudflare)                    your laptop (every 60 seconds)
-------------------------                   ------------------------------
someone fills the form
        |
        v
   POST /api/send
        |
   saves a row:  to_whatsapp = +919876543210
                 view_token  = minted now
        |
   sends NO WhatsApp message                 whatsapp/notify.mjs wakes up
                                                     |
                                             asks the database:
                                             "anything with a number,
                                              not blocked, not sent yet?"
                                                     |
                                             nothing?  ->  exits, browser
                                                           never opens
                                                     |
                                             something?  ->  opens the real
                                                             browser, already
                                                             logged in
                                                     |
                                             web.whatsapp.com/send?phone=...
                                                     |
                                             types and sends 3 messages
                                                     |
                                             writes the message id into a
                                             "already sent" log so it can
                                             never go out twice
```

### Why the sending happens on your laptop and not on the website

The website runs on Cloudflare Workers. A Worker is a small program that runs
in Cloudflare's data centres for a few milliseconds per request. It cannot hold
a WhatsApp login, cannot run a browser, and cannot keep a phone session alive.
So the website's only job is to write the message down. A script on your laptop
does the sending, because that is where the logged-in browser lives.

This is exactly how Instagram delivery already works here, and it is the reason
we can reuse most of it.

WhatsApp does have an official API (the Cloud API). It is not an option for
this: cold-messaging a stranger through it requires message templates that Meta
has to approve in advance, plus business verification. That is weeks of review
for a hackathon weekend. Browser automation it is.

---

## What we copy, piece by piece

The Instagram notifier is a working version of this same idea. Almost nothing
is new work; it is mostly a second copy with the words changed.

| Instagram, today | WhatsApp, new |
|---|---|
| `to_handle` column | `to_whatsapp` column (migration `003-whatsapp.sql`) |
| handle validated in `/api/send` | number validated and normalised in `/api/send` |
| blocklist key `ig:their_handle` | blocklist key `wa:+919876543210` |
| `/block?h=handle` | `/block?w=+919876543210` |
| `tools/instagram/notify.mjs` | `tools/whatsapp/notify.mjs` |
| `tools/instagram/ig-dm.mjs` (typing, threads) | `tools/whatsapp/wa-send.mjs` |
| session in `~/.config/beatass-instagram` | session in `~/.config/beatass-whatsapp` |
| `com.beatass.notify` every 120s | `com.beatass.whatsapp` every 60s |
| `.notified.json` (message ids only) | `.wa-notified.json` (message ids only) |
| refuses to run if signed in as the wrong account | refuses to run if the session is not the expected number |

---

## The number rules

People paste phone numbers in every shape there is, so we accept all of them
and clean up:

| They type | We store |
|---|---|
| `9876543210` | `+919876543210` |
| `98765 43210` | `+919876543210` |
| `098765-43210` | `+919876543210` |
| `+91 98765 43210` | `+919876543210` |
| `919876543210` | `+919876543210` |

The cleaning is one rule: throw away everything that is not a digit, drop a
leading `91` if 12 digits are left, drop a leading `0` if 11 are left. What
must remain is 10 digits starting with 6, 7, 8, or 9, which is every Indian
mobile number. Anything else gets "that WhatsApp number looks wrong".

Checked in two places, the browser and the Worker, because the browser check is
for the person's benefit and the Worker check is the one that actually holds.

---

## What the message says

Three separate messages, same as the Instagram DM, and for the same reason you
gave on 2026-08-03: one blob buries the confession between a greeting and a
legal footer, so the words get their own bubble.

```
1 |  hey - someone left you an anonymous message on beatass.com.
  |  this is what they said:

2 |  "i have never told anyone this, but i still keep the letter you wrote"

3 |  see what they did to the doll (and reply to them) here:
  |  https://beatass.com/m?id=...&t=...
  |
  |  this is an automated message from beatass.com. open the link to read it,
  |  reply, report it, or block us so we never message you again.
```

Bubble 3 is not optional. It says out loud that a machine sent this and offers
the way out, which is the honesty rule and the thing that stops this being an
abuse pipe. Long confessions get clipped at 280 characters in bubble 2, with
the rest on the linked page. That is the existing `dmPreview` logic, reused
as-is.

---

## Safety rails, all carried over

- **The block list works across every channel.** A number that blocks us is
  stored as `wa:+91...` and is re-checked in the second before each send, not
  just when the message was written.
- **Never twice.** A local log records which message ids have gone out. It
  holds ids only, never names or numbers.
- **A daily ceiling** on unattended sends, same as the DM cap.
- **A random pause between sends** so it never fires in a burst.
- **If the number is not on WhatsApp**, WhatsApp Web says so. The script must
  read that and skip the message, not claim it was delivered. "It went out"
  has to mean it went out.
- **No phone numbers in this repo.** The repo is public. The sending account's
  own number lives in `~/.config/beatass-whatsapp/config.json` on your laptop,
  next to the session, and the script refuses to run without it. Recipients'
  numbers live only in the database.

---

## Build order

Seven steps. Steps 1 to 3 send nothing to anybody, so they are safe to do in
one go. Nothing reaches a real stranger until step 5, and that is your call.

### Step 1 - the website side (about 45 min, nothing outward)

| File | Change |
|---|---|
| `migrations/003-whatsapp.sql` | new: adds the `to_whatsapp` column |
| `schema.sql` | the column, documented like its neighbours |
| `src/index.js` | `/api/send` accepts, cleans and validates the number; mints `view_token` for a WhatsApp-only send too; blocklist check includes `wa:`; `/block?w=` branch; `/m` page offers "block my number" when that is how they were reached |
| `template.html` | the field, the `+91` label, validation, the "at least one" rule, and the confirmation line telling them it is headed for WhatsApp |

The Instagram and WhatsApp fields go **side by side in one row** rather than
stacked. The whole layout is built to fit on one screen with no scrolling, and
`npm test` measures that at seven screen sizes down to a 360x640 Android. A
fourth stacked field would likely break the smallest one.

Proof it works: `npm test` green, plus a real send against the local database
that writes a row with the number in it.

### Step 2 - log in to WhatsApp Web once (3 minutes, yours)

I open a browser window, you scan the QR code with the business account's
phone. The session is then remembered in `~/.config/beatass-whatsapp` (outside
the repo, because a saved session is a credential). You never do this again
unless WhatsApp logs the session out.

I will also need, typed into the terminal by you and not into any file I
commit: the business number that sends, and your own number for the first test.

### Step 3 - capture the real buttons (about 20 min, nothing outward)

I open a chat, photograph the live page, and write down the actual selectors
for the message box and the send button. I will not guess these from memory.
Guessed selectors are how automation "passes" without ever having clicked
anything, and it has bitten this project before.

### Step 4 - write the sender (about 1 hour, nothing outward)

`tools/whatsapp/notify.mjs`, with the same five modes the DM tool has:

```
node tools/whatsapp/notify.mjs                  list what is waiting
node tools/whatsapp/notify.mjs --selftest       check the logic, no browser, no database
node tools/whatsapp/notify.mjs --text <id>      print the 3 messages, send nothing
node tools/whatsapp/notify.mjs --dry-run <id>   open the chat, type it, DON'T press send
node tools/whatsapp/notify.mjs --send <id>      send one
node tools/whatsapp/notify.mjs --auto           work the whole queue, unattended
```

`--selftest` joins `npm test`, so the message wording is checked on every build
forever.

### Step 5 - prove it on your own number (about 15 min, your yes required)

1. `--dry-run` first: the chat opens, the text is typed, send is never pressed,
   and a screenshot shows exactly what would have gone out.
2. Then one real send, to **your own number**. You read the three messages on
   your own phone, click the link, and check the block button works.
3. Only after that does anything go to anybody else.

### Step 6 - the one-minute timer (about 10 min)

A launchd job (macOS's built-in scheduler) runs the script every 60 seconds. An
empty queue costs one database query and never opens a browser, so a short
timer is cheap. It means a message goes out within about a minute of being
written.

Off switch, one line:
`launchctl unload ~/Library/LaunchAgents/com.beatass.whatsapp.plist`

### Step 7 - write it down (about 20 min)

`WHATSAPP.md` in the same shape as `INSTAGRAM.md`: how to log in, how to dry
run, how to read a failure screenshot, how to stop the automation.

**Total: about 3 hours of my work, about 10 minutes of yours** (the QR scan,
the two numbers, and reading the test message on your phone).

---

## Two things to decide

**1. Does the doll clip ride along?**

- **A. Text and a link only** (what the Instagram DM does). The clip plays on
  the linked page. Faster, and the message looks less like spam.
- **B. Attach the MP4 to the WhatsApp message.** More impact, since the video
  plays right in the chat, but it is an extra hour of work: file upload through
  WhatsApp Web needs the same in-page trick the Flow tooling needed, and a 40
  MB video is slow to attach.

Recommendation: **A** now, B later if the clip in the chat turns out to matter.

**2. Which channels can a message use at once?**

- **A. All of them.** Email plus Instagram plus WhatsApp if the sender fills
  all three, so it gets there whatever happens.
- **B. One only**, the most reliable one they gave.

Recommendation: **A**, because the block list already sweeps across channels,
so someone who blocks one is not left getting the others.

---

## Not doing

- No other country codes. India only, so `+91` can be printed rather than
  picked.
- No WhatsApp Cloud API. See above; template approval kills it for now.
- No reply-by-WhatsApp. Replies keep going through the `/m` page, which already
  relays to the sender's email if they left one.
- No group messages, no broadcast lists.

---

## The one thing worth saying out loud

You said not to worry about the account getting banned, and this plan does not.
But a phone number is a heavier thing to hold than an email address: it is
somebody's actual pocket. Two consequences are baked into the plan above rather
than left to remember later. Recipients' numbers never leave the database, and
the sending account's own number never enters this public repo. The
already-built parts (the permanent block list, the "this is automated" line,
the report link) are what keep this on the right side of the product's own
promises, and they all apply to WhatsApp on day one, not later.
