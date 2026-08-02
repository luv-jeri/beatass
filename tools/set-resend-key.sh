#!/usr/bin/env bash
# Put the Resend API key into Cloudflare, straight from the clipboard.
#
#   1. Copy the key from resend.com (API keys -> it is shown once)
#   2. Run:  bash tools/set-resend-key.sh
#
# The key never appears on screen, never lands in a file, and never enters a
# shell history entry. It goes clipboard -> Cloudflare and nowhere else.
#
# Why this exists: `pbpaste | wrangler secret put` accepts whatever happens to
# be on the clipboard. Once, that was 403 characters of terminal output, which
# Cloudflare stored happily and which then broke every send with a header error
# that named nothing useful. This checks the shape before storing it.

set -euo pipefail
cd "$(dirname "$0")/.."

# strip every space and line break: a wrapped copy is still a good key
KEY="$(pbpaste | tr -d '[:space:]')"

if [ -z "$KEY" ]; then
  echo "Your clipboard is empty."
  echo "Copy the key from resend.com first, then run this again."
  exit 1
fi

if ! printf '%s' "$KEY" | grep -Eq '^re_[A-Za-z0-9_]+$'; then
  # describe it without revealing it
  echo "That is not a Resend key."
  echo
  echo "  what is on your clipboard:  ${#KEY} characters, starting \"$(printf '%s' "$KEY" | cut -c1-3)\""
  echo "  what a Resend key is:       starts \"re_\", then letters and digits only"
  echo
  echo "Go to resend.com -> API keys -> Create API Key, click the copy button,"
  echo "then run this again. Do not copy anything else in between."
  exit 1
fi

echo "Key looks right (${#KEY} characters, starts \"re_\"). Storing it..."
printf '%s' "$KEY" | npx wrangler secret put RESEND_API_KEY

echo
echo "Done. Tell Claude and it will send a real test message."
