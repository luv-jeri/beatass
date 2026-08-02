# Review prompt

Paste the block below into a fresh session (Claude, Codex, whatever you like). It is written to be hostile on purpose: it asks the reviewer to find what is wrong, not to admire what is there.

---

```
You are reviewing beatass, a small website at /Users/sanjaykumar/Claude/Projects/banyan/ventures/beatass.

WHAT IT IS
Someone writes an anonymous message, takes it out on a hand-drawn voodoo doll
in the browser, and the site emails the message plus a recording of the doll to
the person they named. One static page plus one Cloudflare Worker. It is live at
https://beatass.unread-fyi.workers.dev and is NOT yet on its real domain.

YOUR JOB
Find what is broken, wrong, or dishonest. Do not summarise what the code does
and do not praise it. If you find nothing at a given severity, say so in one
line and move on.

READ THESE, IN THIS ORDER
1. HANDOFF.md          - what was built and what is deliberately unfinished
2. src/index.js        - the whole backend, about 260 lines
3. pages/*.html        - privacy, terms, about, contact, 404 (source text only)
4. build.py            - generates the side pages, robots.txt, sitemap.xml
5. tools/instagram/post.mjs - the Instagram poster
6. template.html       - 1900 lines, DO NOT read whole. Use grep and read
                         ranges. It is the source; beatass.html and public/
                         are generated - never review those.

CHECK THESE SPECIFICALLY

A. Does the privacy page tell the truth?
   Every factual claim in pages/privacy.html about what is stored, what is not
   stored, who receives it, and what the block link does must be checked line by
   line against src/index.js. Two claims were already corrected for overstating
   (the IP hash is pseudonymous, not irreversible; the blocklist matches an exact
   string). Look for any remaining claim the code does not actually deliver.

B. The block and report links.
   These are reachable by anyone holding the signed URL. They act on POST, with a
   GET showing a confirmation page, because corporate mail scanners open links
   before a human sees them. Verify that reasoning still holds and that no other
   route in the Worker acts destructively on a GET.

C. Untrusted input.
   Everything in the POST /api/send form comes from a stranger's browser: name,
   email, message, stats, caption, and two files. Trace each one to where it is
   stored and where it is rendered into the email HTML. Anything that reaches
   HTML unescaped is a finding.

D. Abuse limits.
   There is a rate limit, a blocklist check, and size caps. Try to think of the
   cheapest way to get around each one, and whether the D1 or R2 write happens
   before or after the check that is supposed to prevent it.

E. The Instagram poster.
   It signs into a real account. Check that credentials and sessions cannot end
   up in the repo, that the handle check cannot be bypassed, and that a failure
   part-way through cannot post twice or mark something posted that was not.

F. SEO and crawl files.
   robots.txt, sitemap.xml, canonical tags, OG tags, and the JSON-LD structured
   data. One known issue: the legal-crawl gate fails check L6 because it cannot
   parse a homepage's own URL - that is the checker's bug, and the sitemap was
   deliberately left correct. Confirm that judgement was right, and look for real
   SEO defects it hides.

KNOWN AND ACCEPTED - do not re-report these
- No framework, no bundler, one HTML file. Deliberate.
- The page must never scroll; npm test enforces it at 7 screen sizes.
- beatass.com is not yet verified in Resend, so real email only reaches the
  account owner. Known, and it is a manual step for the owner.
- hello@beatass.com on the legal pages does not route anywhere until DNS moves.
- Instagram DM sending was refused on purpose. Do not propose it.

OUTPUT
One line per finding:
  path:line: BLOCKER|MAJOR|MINOR: what is wrong. what to do about it.
Sort by severity. No preamble, no summary, no praise. Cap at 40 lines.

Then, separately, answer one question in no more than five lines: if this site
got 100,000 visitors tomorrow, what breaks first?
```

---

## What to do with the answer

Findings marked BLOCKER or MAJOR should be fixed before the site goes on the real domain. MINOR ones can wait.

If the reviewer reports something already in the "known and accepted" list, it did not read the prompt properly and the rest of its output is worth less.
