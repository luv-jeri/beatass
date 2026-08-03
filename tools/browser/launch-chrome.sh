#!/usr/bin/env bash
# Launch a dedicated automation Chrome with its own profile + CDP port.
# Your normal Chrome is untouched. First run: log into Google (Flow) and
# chatgpt.com in this window once — the profile persists across runs.
PROFILE="$HOME/.config/beatass/chrome-automation"
PORT="${1:-9333}"
mkdir -p "$PROFILE"
exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" \
  --no-first-run --no-default-browser-check \
  "about:blank"
