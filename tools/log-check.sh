#!/bin/sh
# Hourly delivery-log check, scheduled by com.beatass.logcheck. Detects and
# notifies; never changes anything.
export PATH="$HOME/.local/share/fnm/aliases/default/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd "$HOME/Claude/Projects/banyan/ventures/beatass" || exit 1
exec node tools/log-check.mjs >> "$HOME/.config/beatass-logs/launchd.log" 2>&1
