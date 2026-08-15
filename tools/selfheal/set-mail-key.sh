#!/usr/bin/env bash
# Give this laptop permission to send the bug-loop reply emails.
#
#   1. Copy the Resend API key (resend.com -> API keys)
#   2. Run:  bash tools/selfheal/set-mail-key.sh
#
# The key goes clipboard -> one file outside the repo, and nowhere else. It is
# never printed, never written into the repo, and never becomes a line in your
# shell history - which is why this takes it from the clipboard instead of from
# an argument you would have to type.
#
# WHY A FILE HERE AT ALL, when tools/set-resend-key.sh deliberately keeps the
# key off this machine and pipes it straight into Cloudflare:
#
# Those are two different senders. The Worker sends the confession emails and
# holds its own copy of the key in Cloudflare's secret store. This is the laptop
# sending the bug-loop replies, and a launchd job cannot reach into Cloudflare's
# secret store - so it needs its own copy, on disk, readable only by you.
#
# That is a real widening of where this key lives. Two ways to close it again:
#   - delete the file:  rm ~/.config/beatass-mail/config.json
#   - or rotate the key on resend.com, which invalidates both copies at once.
set -euo pipefail

DIR="$HOME/.config/beatass-mail"
FILE="$DIR/config.json"
FROM_DEFAULT="Someone <someone@beatass.com>"

KEY="$(pbpaste | tr -d '[:space:]')"

if [ -z "$KEY" ]; then
  echo "Your clipboard is empty. Copy the Resend key first, then run this again."
  exit 1
fi

# Same shape check the Worker uses (src/index.js). A pasted key picks up
# whitespace and stray characters, and a bad key fails as a total outage rather
# than as an obvious mistake - so it is worth catching here, before anything
# depends on it.
if ! printf '%s' "$KEY" | grep -Eq '^re_[A-Za-z0-9_]+$'; then
  echo "That does not look like a Resend key."
  echo "  it should start with re_ and contain only letters, digits and underscores"
  echo "  what is on the clipboard is ${#KEY} characters starting \"$(printf '%s' "$KEY" | cut -c1-3)\""
  exit 1
fi

mkdir -p "$DIR"
chmod 700 "$DIR"

FROM="${1:-$FROM_DEFAULT}"

umask 077
cat > "$FILE" <<EOF
{
  "_what": "Lets this laptop send the bug-loop reply emails. Outside the repo on purpose. Delete this file to take the permission away.",
  "resendApiKey": "$KEY",
  "mailFrom": "$FROM"
}
EOF
chmod 600 "$FILE"

echo "Saved. ${#KEY} characters, readable only by you:"
echo "  $FILE"
echo "  from: $FROM"
echo ""
echo "Check it works without sending anything:"
echo "  node tools/selfheal/notify.mjs --dry"
echo ""
echo "To take the permission away again:  rm $FILE"
