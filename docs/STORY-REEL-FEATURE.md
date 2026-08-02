# Stories + Reels — spec (Sanjay, 2026-08-02, in conversation)

Today the automation makes one square-ish feed post per message. He wants the
same message to also come out as:

1. **A story** — 1080x1920 static image. Same visual family as the post
   template (taped card + message + doll), taller crop, bigger type. Cheap:
   a second layout in tools/instagram/make-post.mjs (`--story` flag writing
   `<slug>-story.png`).
2. **A reel** — short vertical video. Two sources, in order of punch:
   - the site already records a 1080x1920 MP4 of the doll actually being
     beaten (the thing we email). A reel = that clip + the message card as
     an overlay + a beatass.com end-card. This needs NO new art pipeline.
   - a Remotion template for marketing reels (the trunk has purchased
     motion/remotion/shot-builder skills — resolve via the trunk, rule 11:
     cross-venture flow goes through the trunk, never by reading another
     venture's folder).

**Choosing the format:** the message's tone tag (the chips: fury/petty/sad/
soft) decides what gets produced — e.g. fury → reel of the beating, soft →
story card. Start with a simple map in config.json.

**Posting:** the web composer's file input already accepts video/mp4 (checked
live 2026-08-02). Stories/reels may need their own composer flow — capture the
real DOM first (G27), do NOT guess selectors.

**Order of build:** story template → reel from recorded MP4 → Remotion
marketing reels → tag-based routing.
