# Posting to Instagram automatically

A script that opens a real browser, signs into our own Instagram account, and posts the next video or image waiting in a folder. You drop files in, it posts them one at a time.

It only ever posts to **our** account. It does not message anyone.

---

## Change which account it posts to

Open `tools/instagram/config.json` and change one line:

```json
"handle": "beatass.app"
```

That is the only place the account is named. The script signs in, checks which account it is actually signed in as, and **refuses to run** if it does not match — so a leftover session from another account cannot accidentally post to the wrong place.

While you are in that file you can also change the default caption and the hashtags.

---

## First-time setup — about 3 minutes

### Step 1 — log in once

```
IG_USERNAME=your_handle IG_PASSWORD=your_password node tools/instagram/post.mjs --login
```

A browser window opens and signs in. If Instagram asks for a two-factor code, type it in that window yourself — the script waits.

After this, the session is remembered and you never pass the password again. It is saved in `~/.config/beatass-instagram/`, **outside this project**, because a saved session is a credential and credentials never go in a repo.

### Step 2 — put something in the queue

Drop a video or image into `content/instagram/`.

The MP4 that beatass exports is already 1080×1920, which is exactly the size Instagram wants for a Reel or a Story, so those files work as they are.

Want a specific caption for one file? Put a `.txt` next to it with the same name:

```
content/instagram/doll-fire.mp4
content/instagram/doll-fire.txt     ← this file's caption
```

No `.txt` means it uses the default caption from `config.json`. Hashtags are added automatically either way.

### Step 3 — try it without posting

```
node tools/instagram/post.mjs --dry-run
```

This does **everything** except press Share — signs in, opens the composer, uploads the file, types the caption — then stops and saves a screenshot to `tools/instagram/dry-run.png` so you can see exactly what would have gone out.

Always do this first with a new account or after Instagram changes its layout.

---

## Posting for real

```
node tools/instagram/post.mjs
```

It picks the oldest file that has not been posted yet, posts it, and records it in `content/instagram/.posted.json` so the same file never goes out twice.

Nothing to post means it says so and exits. It never posts the same file again.

---

## Posting on a schedule

Once a dry run looks right, run it automatically. On a Mac, `crontab -e` and add one line — this posts every day at 6pm:

```
0 18 * * * cd /Users/sanjaykumar/Claude/Projects/banyan/ventures/beatass && /usr/local/bin/node tools/instagram/post.mjs >> /tmp/beatass-ig.log 2>&1
```

Check `which node` first and use the path it prints, because scheduled jobs do not know about your shell's setup.

Fill the folder with a week of videos and it drips them out by itself.

---

## When it breaks

Instagram redesigns its web interface every few months, and when it does, one of the buttons this script looks for stops existing. The run stops and writes **`tools/instagram/last-failure.png`** — a screenshot of the exact screen it was stuck on, plus a message naming the step.

Open that image, see which button moved, and the fix is usually one line in `post.mjs`.

Set `"headless": false` in the config (it already is) to watch it work in a real window. That makes almost every problem obvious in seconds.
