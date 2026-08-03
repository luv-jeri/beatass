#!/usr/bin/env bash
#
# Sets the live admin login for beatass.com/admin.
#
# You fill in admin-login.txt, then run this. It uploads ADMIN_EMAIL and
# ADMIN_PASSWORD to Cloudflare as encrypted secrets, then deletes the file so
# your password is never left on disk or committed. The values go straight from
# the file to Cloudflare - they are never printed.
#
#   bash set-admin.sh
#
set -euo pipefail
cd "$(dirname "$0")"

f="admin-login.txt"
if [ ! -f "$f" ]; then
  echo "Can't find $f. Ask Claude to open it, fill it in, then run this again."
  exit 1
fi

# pull the value after the first = on each line; trims a trailing CR if the file
# was saved with Windows line endings.
email=$(grep -E '^ADMIN_EMAIL='    "$f" | head -1 | cut -d= -f2- | tr -d '\r')
pass=$( grep -E '^ADMIN_PASSWORD=' "$f" | head -1 | cut -d= -f2- | tr -d '\r')

if [ -z "$email" ] || [ -z "$pass" ]; then
  echo "Both ADMIN_EMAIL and ADMIN_PASSWORD need a value in $f (nothing after the = sign yet)."
  exit 1
fi

printf '%s' "$email" | npx wrangler secret put ADMIN_EMAIL
printf '%s' "$pass"  | npx wrangler secret put ADMIN_PASSWORD

rm -f "$f"
echo
echo "Done. Admin login is set and $f was deleted."
echo "Go to https://beatass.com/admin and sign in."
