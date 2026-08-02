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
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') auto run ===" >> "$LOG"
exec node tools/instagram/notify.mjs --auto >> "$LOG" 2>&1
