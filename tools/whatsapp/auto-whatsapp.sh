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
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1

# One at a time. Two runs at once would fight over the session folder, and the
# loser silently gets a blank profile that is "not signed in".
if pgrep -f "tools/whatsapp/notify.mjs" >/dev/null 2>&1; then
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') skipped, a run is already going ===" >> "$LOG"
  exit 0
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') auto run ===" >> "$LOG"
exec node tools/whatsapp/notify.mjs --auto >> "$LOG" 2>&1
