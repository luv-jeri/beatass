# Instagram insights — data and learning loop

A launchd job (`com.beatass.insights`, installed from
`tools/instagram/com.beatass.insights.plist`) runs
`tools/instagram/insights-loop.sh` at 09:30 and 21:30 daily. It is read-only:
it scrapes the account's own numbers and never posts or clicks anything.

- `snapshots/` — timestamped JSON, one per run. Views come from the reels-grid
  overlay; likes/comments from each reel page's meta description. History
  accumulates here, so growth per reel = diff between snapshots.
- `LATEST.md` — the newest snapshot as a table, for humans and sessions.
- Runtime log: `~/.config/beatass/logs/insights-loop.log`.

How the learning works: any content session starts by reading `LATEST.md`
(and diffing the last few snapshots) to see which hooks/formats/languages are
earning views and which are flatlining, then applies that to the next reel.
Findings worth keeping move to the venture memory and the reel-factory
LEARNINGS, not this folder.

Known limit: true retention curves (where in the reel people drop off) are
only in the Instagram app's professional dashboard — the account must be a
professional/creator account and the numbers are not on the web. Until that
changes, drop-off is inferred: views vs likes ratio, and view growth decay
between snapshots.

First baseline (2026-08-04): six reels, views plateau 140-190 within a day,
likes 2-4%, comments ~0. Single twist stories outperform the 3-part series
(part 1: 179 views; parts 2-3: ~141 each — a 21% series drop).
