# Delivering confessions by WhatsApp

A script that opens a real WhatsApp Web window on our own business account and
sends whoever is waiting the message somebody left them on beatass.com. It
arrives as three messages: an intro, their confession alone in its own bubble,
then the link plus the "this was automated, here is how to stop it" notice.

It only ever sends from **our** account, and it only ever sends to numbers that
a sender typed into the site.

---

## First-time setup

### Step 1 - link the account, once

```
node tools/whatsapp/login.mjs
```

A window opens with a QR code. On the phone that owns the business account:
Settings -> Linked devices -> Link a device, and point it at the code. The
script watches, tells you when it worked, and closes itself.

The session is saved in `~/.config/beatass-whatsapp/`, **outside this project**,
because a saved session is a credential and this repo is public.

Add `--chrome` if WhatsApp complains that the browser is unsupported.

### Step 2 - name the sending account

```
echo '{"account":"+91XXXXXXXXXX","name":"Beat Ass"}' > ~/.config/beatass-whatsapp/config.json
```

- `account` is the number of the phone that scanned the code.
- `name` must match the profile name shown on WhatsApp Settings **exactly**. It
  is the only way the tool can tell which account it is signed in as, because
  WhatsApp Web never prints the phone number anywhere in its interface. If the
  name does not match, every send refuses. Change the profile name on the phone
  and you must change it here too.

Neither value goes in the repo.

---

## Sending

```
node tools/whatsapp/notify.mjs                     what is waiting
node tools/whatsapp/notify.mjs --text <id>         print the 3 messages, no browser
node tools/whatsapp/notify.mjs --dry-run <id>      type all 3, send NOTHING, photograph each
node tools/whatsapp/notify.mjs --send <id>         send one
node tools/whatsapp/notify.mjs --auto              send everything waiting
node tools/whatsapp/notify.mjs --block <number>    never message that number again
```

Useful extras: `--local` reads the local test database instead of the live one,
and `--keep-open` leaves the window up when the run finishes.

Always `--dry-run` first after WhatsApp changes its layout. It types every
message, photographs each one to `tools/whatsapp/dry-run-1..3.png`, and never
presses send.

## On a timer

`com.beatass.whatsapp` runs `auto-whatsapp.sh` every 60 seconds, so a message
goes out within about a minute of being written. It is **not** armed by default.

```
cp tools/whatsapp/com.beatass.whatsapp.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.beatass.whatsapp.plist     # arm it
launchctl unload ~/Library/LaunchAgents/com.beatass.whatsapp.plist   # stop it
```

An empty queue costs one database query and never opens a browser. When there
is something to send, **a WhatsApp window appears** - that is deliberate, not a
bug: WhatsApp Web refuses to restore a login without a real window, tested twice
on 2026-08-04, so a headless timer would fail silently every minute.

---

## The rails, so this never becomes a spam machine

- **Anyone can stop it forever.** Every message carries a link, and that page
  has a block button. A blocked number is checked again in the second before
  each send, and there is no unblock.
- **Never twice.** `~/.config/beatass-whatsapp/.wa-notified.json` records which
  message ids went out. It holds ids only, never numbers.
- **At most 30 unattended sends a day**, with a random 25-75 second pause
  between them so it never fires in a burst.
- **A number that is not on WhatsApp is skipped**, and deliberately *not*
  recorded as sent, because nothing was delivered.
- **Every message says it is automated** and offers the way out. That line is
  covered by the selftest, so it cannot quietly disappear.

---

## The business profile

A stranger getting a message from an unknown business number decides in about
two seconds whether to block. The profile is what they check first, so it has to
say plainly that we are a delivery service and that reporting exists.

**These fields have to be set on the phone app.** WhatsApp Web's profile editor
is a custom widget that automation cannot type into (tried three ways on
2026-08-04), and the greeting message does not exist on the web at all.

In WhatsApp Business on the phone: Settings -> Business tools -> Business
profile, and Settings -> Business tools -> Greeting message.

**About** (Settings -> tap your name -> About), 129 of 139 characters:

```
📩 we only deliver anonymous messages from beatass.com. we did not write them. every message has a link to reply, report or block.
```

**Description** (Business profile -> Description), 244 of 256:

```
📩 beatass.com lets someone write an anonymous message and take it out on a voodoo doll. ⚠️ we only deliver it - we never write the words and never share your number. 🛑 every message has a link to read it, reply, report it, or block us for good.
```

**Website:** `https://beatass.com`
**Email:** `someone@beatass.com`
**Category:** Internet company, or the closest thing offered.

**Greeting message** (sent automatically the first time somebody replies),
190 of 200 characters - this is the one that stops a block, because it answers
the question they are actually asking:

```
👋 *you have not messaged a person.* this is beatass.com - we only deliver anonymous messages, we did not write yours. 👉 the link in it lets you *reply*, *report* it, or *block us for good* 🛑
```

The emoji and the `*bold*` markers are deliberate (Sanjay, 2026-08-05): the
plain version arrived on a phone as a wall of grey text that a reader skims
past, and the whole point of these lines is that they get read. It is a
knowing exception to the no-emoji house rule, which exists for the hand-drawn
website rather than for other people's messaging apps.

---

## When it breaks

WhatsApp redesigns its web interface, and when it does, one of the buttons this
script looks for stops existing. The run stops and writes
**`tools/whatsapp/last-failure.png`** - a screenshot of the exact screen it was
stuck on, plus a message naming the step.

Every selector lives in one file, `tools/whatsapp/wa-send.mjs`, with a comment
recording what was on the live page when it was written. Fix it there.

What was actually true on 2026-08-04:

| Thing | What it is |
|---|---|
| signed in | `#pane-side` exists |
| open a stranger's chat | `web.whatsapp.com/send?phone=<digits>` |
| the message box | `footer div[role=textbox]`, placeholder "Type a message" |
| the send button | `footer button[aria-label="Send"]`, only once there is text |
| a dead number | a dialog: "The number ... isn't on WhatsApp", no message box |
