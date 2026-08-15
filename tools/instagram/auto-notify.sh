#!/bin/sh
# Runs the Instagram DM notifier over the whole waiting queue, unattended.
# Scheduled by com.beatass.notify (launchd, every 2 min). Sends the disclosed
# DM for every message that carries a handle, honouring the block list, the
# daily cap, and the never-send-twice log inside notify.mjs.
#
# The log lives OUTSIDE the repo, beside the saved session, because it can name
# real recipients. To stop the automation:
#   launchctl unload ~/Library/LaunchAgents/com.beatass.notify.plist
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.config/beatass-instagram/auto.log"
COOLDOWN="$HOME/.config/beatass-instagram/.cooldown"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1
. tools/lib/backoff.sh

# A run that fails as a WHOLE (logged-out session, Instagram redesign) used to
# repeat every 2 minutes forever. This sender is headless, so nobody would see
# it - but hundreds of failed sign-ins a day is what gets an account flagged.
# Same fix as the WhatsApp sender; the story is in tools/lib/backoff.sh.
backoff_skip "$COOLDOWN" && exit 0

echo "=== $(date '+%Y-%m-%d %H:%M:%S') auto run ===" >> "$LOG"
node tools/instagram/notify.mjs --auto >> "$LOG" 2>&1
STATUS=$?
backoff_note "$COOLDOWN" "$LOG" "$STATUS"
exit "$STATUS"
