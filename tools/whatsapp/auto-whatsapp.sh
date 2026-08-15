#!/bin/sh
# Sends every waiting WhatsApp message, unattended. Scheduled by
# com.beatass.whatsapp (launchd, every 60 seconds).
#
# An empty queue costs one database query and never opens a browser, which is
# what makes a one-minute timer cheap. When there IS something to send, a
# WhatsApp Web window appears: headless does not work (WhatsApp will not restore
# the login without a real window - tested 2026-08-04), so this is deliberate.
#
# The log lives OUTSIDE the repo, beside the saved session, because it can name
# real recipients. To stop the automation:
#   launchctl unload ~/Library/LaunchAgents/com.beatass.whatsapp.plist
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.config/beatass-whatsapp/auto.log"
COOLDOWN="$HOME/.config/beatass-whatsapp/.cooldown"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1
. tools/lib/backoff.sh

# A run that fails as a WHOLE (logged-out session, WhatsApp redesign) used to
# repeat every 60 seconds forever, and this sender runs VISIBLE - so it opened a
# browser window on screen once a minute. See tools/lib/backoff.sh for the whole
# story. Quiet on purpose when skipping: logging it would be 1,440 lines a day.
backoff_skip "$COOLDOWN" && exit 0

# One at a time. Two runs at once would fight over the session folder, and the
# loser silently gets a blank profile that is "not signed in".
if pgrep -f "tools/whatsapp/notify.mjs" >/dev/null 2>&1; then
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') skipped, a run is already going ===" >> "$LOG"
  exit 0
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') auto run ===" >> "$LOG"
node tools/whatsapp/notify.mjs --auto >> "$LOG" 2>&1
STATUS=$?

# notify.mjs only exits non-zero when the run itself broke; a message that failed
# on its own is caught, recorded, and still exits 0. So this is exactly the
# "nothing can be sent right now" signal the backoff wants.
backoff_note "$COOLDOWN" "$LOG" "$STATUS"
exit "$STATUS"
