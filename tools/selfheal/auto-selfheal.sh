#!/bin/sh
# One pass of the bug loop, unattended. Scheduled by com.beatass.selfheal.
#
# Turn it on and off, and change how often it runs, with:
#   node tools/selfheal/auto.mjs status | on | off | every <minutes>
#
# WHAT THIS IS ALLOWED TO DO
#   read new bug reports, write a verdict, and write a sanitised draft issue to
#   content/bugs/drafts/. That is all.
#
# WHAT IT CANNOT DO, EVEN IF SOMEBODY FLIPS EVERY SWITCH IN config.json
#   publish a GitHub issue  - prepare-issue.mjs holds no GitHub call at all, and
#                             approve-issue.mjs is never run from here
#   open or merge a PR      - fix.mjs is never run from here
#   deploy                  - nothing here touches wrangler deploy
#   send an email           - the notify step is off by default AND needs a key
#                             that is not on this laptop. Two locks, not one.
#
# The log lives outside the repo, beside the other senders' logs, because it
# quotes what people wrote in their bug reports.
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.config/beatass-logs/selfheal.log"
COOLDOWN="$HOME/.config/beatass-logs/.selfheal-cooldown"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1
mkdir -p "$HOME/.config/beatass-logs"
. tools/lib/backoff.sh

# A run that fails as a whole - Claude Code missing, wrangler logged out, the
# database unreachable - must not retry every few minutes forever. Same rule the
# WhatsApp and Instagram senders use: 30 minutes of quiet per consecutive
# failure, capped at 6 hours, cleared by the first clean run. Quiet on purpose
# when skipping; logging a skip every few minutes is how a log becomes unread.
backoff_skip "$COOLDOWN" && exit 0

# One at a time. Triage claims each case with a conditional UPDATE so two runs
# could not corrupt each other, but they WOULD both pay for the same model call,
# and a slow run on a big queue should not stack up behind itself.
if pgrep -f "tools/selfheal/triage.mjs" >/dev/null 2>&1; then
  exit 0
fi

# The switches. Read here rather than in launchd so that turning the loop off
# works instantly and does not depend on the job having been unloaded properly.
eval "$(node -e '
  const fs = require("fs");
  let c = {};
  try { c = JSON.parse(fs.readFileSync("tools/selfheal/config.json", "utf8")); } catch (e) {}
  const s = c.steps || {};
  const q = Array.isArray(c.quietHours) ? c.quietHours : null;
  let quiet = 0;
  if (q) {
    const h = new Date().getHours();
    quiet = q[0] <= q[1] ? (h >= q[0] && h < q[1]) : (h >= q[0] || h < q[1]);
  }
  const b = (v) => (v ? 1 : 0);
  console.log(`ENABLED=${b(c.enabled)}; DO_TRIAGE=${b(s.triage)}; DO_DRAFT=${b(s.draftIssues)}; DO_NOTIFY=${b(s.notify)}; QUIET=${b(quiet)}`);
' 2>/dev/null || echo 'ENABLED=0; DO_TRIAGE=0; DO_DRAFT=0; DO_NOTIFY=0; QUIET=0')"

[ "$ENABLED" = "1" ] || exit 0
[ "$QUIET" = "1" ] && exit 0

STATUS=0
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') selfheal run ==="

  if [ "$DO_TRIAGE" = "1" ]; then
    node tools/selfheal/triage.mjs --remote || STATUS=$?
  fi

  # Drafting is skipped when triage failed: without a fresh verdict there is
  # nothing new to draft, and running on a broken database just fails twice.
  if [ "$DO_DRAFT" = "1" ] && [ "$STATUS" -eq 0 ]; then
    node tools/selfheal/prepare-issue.mjs || STATUS=$?
  fi

  # --send is NOT passed here and must never be added to this line. Turning the
  # notify step on gives you the dry run: it prints who would be told what, so
  # you can read a week of it before anything is sent for real. Sending is a
  # human running notify.mjs with --send --i-mean-it, at a keyboard.
  if [ "$DO_NOTIFY" = "1" ] && [ "$STATUS" -eq 0 ]; then
    node tools/selfheal/notify.mjs --dry || STATUS=$?
  fi
} >> "$LOG" 2>&1

backoff_note "$COOLDOWN" "$LOG" "$STATUS"
exit "$STATUS"
