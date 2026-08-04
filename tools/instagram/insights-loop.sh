#!/bin/bash
# Nightly Instagram insights snapshot (runs from launchd: com.beatass.insights).
# Read-only scrape -> marketing/insights/snapshots/ + LATEST.md. Skips the run
# entirely if the posting browser is busy so it can never corrupt an upload.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PATH="/Users/sanjaykumar/.local/share/fnm/aliases/default/bin:/usr/bin:/bin"
LOG_DIR="$HOME/.config/beatass/logs"
mkdir -p "$LOG_DIR"

if pgrep -f "tools/instagram/post.mjs" > /dev/null; then
  echo "$(date -u +%FT%TZ) skipped: poster is running" >> "$LOG_DIR/insights-loop.log"
  exit 0
fi
# stale profile locks from a crashed run block the launch; clean read-only-safe
pgrep -f "Google Chrome for Testing" > /dev/null || rm -f "$HOME/.config/beatass-instagram/Singleton"* 2>/dev/null

cd "$ROOT" || exit 1
node tools/instagram/insights.mjs --quiet >> "$LOG_DIR/insights-loop.log" 2>&1
echo "$(date -u +%FT%TZ) snapshot exit=$?" >> "$LOG_DIR/insights-loop.log"
