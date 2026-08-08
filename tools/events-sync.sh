#!/bin/sh
# Carries the laptop's delivery events into the D1 `events` table, unattended.
# Scheduled by com.beatass.eventsync (launchd, every 120 seconds).
#
# The Worker logs site-side actions straight to D1; this is the other half -
# the Instagram/WhatsApp notifiers write to a local events.jsonl (fast, offline),
# and this flushes the new lines into the same table so the whole delivery log is
# one query. It is cheap: an up-to-date lane is a single file read, no wrangler
# call. A failed sync leaves the offset untouched and retries next run.
#
# Stop it: launchctl unload ~/Library/LaunchAgents/com.beatass.eventsync.plist
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG="$HOME/.config/beatass-logs/events-sync.log"
mkdir -p "$HOME/.config/beatass-logs"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1

# One at a time, so two runs never race on the offset file and double-insert.
if pgrep -f "tools/events-sync.mjs" >/dev/null 2>&1; then
  exit 0
fi

echo "=== $(date '+%Y-%m-%d %H:%M:%S') sync ===" >> "$LOG"
exec node tools/events-sync.mjs >> "$LOG" 2>&1
