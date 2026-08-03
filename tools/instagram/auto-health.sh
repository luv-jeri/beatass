#!/bin/sh
# Checks, once a day, that the Instagram automation can still do its job, and
# makes noise on Sanjay's screen if it cannot.
#
# The failure this exists for is a quiet one. Instagram renames something on
# its website, the notifier stops finding it, and DMs simply stop going out.
# Nothing crashes, no error appears, and the only symptom is silence - which
# looks exactly like "nobody sent a message today".
#
# Scheduled by com.beatass.health (launchd, daily at 09:30).
#   stop:  launchctl unload ~/Library/LaunchAgents/com.beatass.health.plist
#   now:   node tools/instagram/health.mjs
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.config/beatass-instagram/health.log"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1

echo "=== $(date '+%Y-%m-%d %H:%M:%S') health check ===" >> "$LOG"
node tools/instagram/health.mjs >> "$LOG" 2>&1
rc=$?

if [ $rc -ne 0 ]; then
  # what broke, in one line, for the notification bubble
  what=$(node -e '
    try {
      const r = require(process.env.HOME + "/.config/beatass-instagram/health.json");
      console.log(r.failures.slice(0, 2).join("; ").slice(0, 180) || "unknown");
    } catch (e) { console.log("could not read the report"); }
  ' 2>/dev/null)
  echo "FAILED: $what" >> "$LOG"
  osascript -e "display notification \"$what\" with title \"beatass: Instagram automation is broken\" subtitle \"DMs are probably not going out\" sound name \"Basso\"" 2>/dev/null
fi
exit $rc
