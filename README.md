# beatass

A prototype for beatass.com — write an anonymous confession, take it out on a
voodoo doll, and the doll's beating gets recorded as a GIF that goes with the
message.

Everything runs in the browser. There is no server, no database, and nothing is
actually sent anywhere yet.

---

## Open it

Double-click **`beatass.html`**. That's the whole website — one file, no
internet needed. The fonts and the GIF library are baked inside it.

## Change it

**Edit `template.html`, not `beatass.html`.**

`beatass.html` is generated. Anything you type into it gets wiped the next time
you build. `template.html` is the readable source — same file, but with short
placeholders (`__FONT_CAVEAT__`, `__GIFJS__`) where the huge font and library
data will be dropped in.

After editing, rebuild:

```bash
python3 build.py
```

That reads `template.html`, swaps the placeholders for the real fonts and
library, and writes a fresh `beatass.html`.

## Test it

```bash
npm install          # first time only — downloads a headless browser
npm test
```

The test opens the real site in a real browser and checks:

- it fits on one screen with **no scrolling** at seven sizes, from a 1440×900
  monitor down to a 360×640 Android
- the form refuses to continue when a field is empty or the email is malformed
- hitting the doll starts the recording
- the GIF that comes out is a real, valid GIF file
- the preview and "sent" overlays open, close, and reset properly

Screenshots land in `shots/`.

---

## What's in here

| | |
|---|---|
| `template.html` | **the source you edit** — layout, styling, and all the code |
| `build.py` | swaps placeholders for fonts + library, writes `beatass.html` |
| `beatass.html` | the finished site (generated — don't edit) |
| `fonts/` | three handwriting fonts, embedded at build time |
| `vendor/` | gif.js, the GIF encoder (MIT licence) |
| `test.mjs` | the browser test described above |
| `sample.gif` | an example of what the doll produces |

---

## How the tricky parts work

**The doll** hangs from a string on pendulum physics. Punch him from the right
and he swings left, with his limbs lagging behind the body so they read as
having weight. Pins are stored in the doll's own coordinate space, which is why
they rotate with him for free.

**Why he looks hand-drawn:** every stroke is drawn *twice* with a small random
wobble, and the wobble is re-rolled about nine times a second. That's called
"boil" in hand-drawn animation. It's the single thing that stops him looking
like clip art. See `sLine`, `sCircle`, and `sPath` in `template.html`.

**The GIF** is encoded in the browser by gif.js. Recording starts the moment you
first touch the doll and captures 32 frames over ~4.8 seconds. It's rendered at
260×260 on purpose: the first version was 440×440 and came out at 2.1 MB, which
bounces off most email providers. It's now around 600 KB.

**Why the site is one file:** so it works with zero setup and zero internet —
you can email it to someone and they can just open it.

---

## Known limits and open decisions

- **Nothing is actually sent.** The send button shows a confirmation and stops
  there. Real sending needs a backend and an email provider.
- **~600 KB is still heavy for an inline email GIF.** The real fix is hosting
  the GIF and putting a linked thumbnail in the email instead.
- **Delivery method is still an open call.** Right now the mock email drops the
  confession straight into the recipient's inbox. Blind anonymous mail to people
  who never opted in is the standard way these domains end up on spam
  blocklists. The safer pattern is a neutral "someone left you a message" email
  with a link the recipient chooses to open.
- **Instagram DMs were removed and should stay removed.** Instagram's Messaging
  API only lets a business *reply* within 24 hours of being messaged first.
  There is no supported way to cold-DM a handle; tools that claim otherwise run
  on scraped logins and get accounts banned.
- **Landscape phones scroll.** Below 470px of viewport height there isn't room
  for the form, the doll, and the button at once, so the no-scroll rule is
  deliberately dropped there rather than squashing everything.

---

gif.js © Johan Nordberg, MIT. Fonts: Patrick Hand, Caveat, Permanent Marker —
all SIL Open Font License.
