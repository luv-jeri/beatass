#!/bin/bash
# Proves the shared backoff actually gates a run, for BOTH senders.
#
# It runs the REAL scripts, with one line rewritten so a stub `node` stands in
# for the sender (nothing is sent, no browser opens). That one-line difference
# is asserted first: if the copy ever drifts further from the original, the test
# says so instead of quietly testing something else.
#
#   bash tools/lib/backoff-test.sh
set -u
REPO="$HOME/Claude/Projects/banyan/ventures/beatass"
TMP=$(mktemp -d); STUB="$TMP/bin"; mkdir -p "$STUB"
CALLS="$TMP/calls"; : > "$CALLS"
fail=0
ok()  { echo "  PASS: $1"; }
bad() { echo "  FAIL: $1"; fail=1; }

cat > "$STUB/node" <<EOF
#!/bin/sh
echo call >> "$CALLS"
exit \$(cat "$TMP/exitcode")
EOF
chmod +x "$STUB/node"
calls() { wc -l < "$CALLS" | tr -d ' '; }

check() {                       # check <name> <real script> <cooldown file>
  name=$1; real=$2; cool=$3
  echo "$name"
  sed "s|^export PATH=\"|export PATH=\"$STUB:|" "$real" > "$TMP/under-test.sh"
  chmod +x "$TMP/under-test.sh"
  d=$(diff "$real" "$TMP/under-test.sh" | grep -c '^[<>]')
  [ "$d" -eq 2 ] && ok "control: differs from the real script by exactly 1 line" \
                || bad "control: $((d/2)) lines differ - not testing the real logic"

  rm -f "$cool"; : > "$CALLS"
  echo 1 > "$TMP/exitcode"

  "$TMP/under-test.sh" >/dev/null 2>&1
  [ "$(calls)" = 1 ] && ok "1. first run calls the sender" || bad "1. sender never ran"
  [ "$(cat "$cool" 2>/dev/null)" = 1 ] && ok "2. the failure is recorded" || bad "2. no cooldown written"

  "$TMP/under-test.sh" >/dev/null 2>&1
  [ "$(calls)" = 1 ] && ok "3. THE BUG: a second run inside the window does nothing" \
                    || bad "3. ran again during cooldown - the loop is NOT fixed"

  touch -t "$(date -v-31M '+%Y%m%d%H%M')" "$cool"
  "$TMP/under-test.sh" >/dev/null 2>&1
  [ "$(calls)" = 2 ] && ok "4. retries once the window expires" || bad "4. never retried - permanently silent"
  [ "$(cat "$cool")" = 2 ] && ok "5. backoff escalates (2 = 60 min)" || bad "5. count did not escalate"

  touch -t "$(date -v-61M '+%Y%m%d%H%M')" "$cool"
  "$TMP/under-test.sh" >/dev/null 2>&1
  [ "$(calls)" = 3 ] && ok "6. the longer window expires too" || bad "6. stuck after the second failure"

  echo 0 > "$TMP/exitcode"
  touch -t "$(date -v-3H '+%Y%m%d%H%M')" "$cool"
  "$TMP/under-test.sh" >/dev/null 2>&1
  [ ! -f "$cool" ] && ok "7. a good run clears the backoff" || bad "7. cooldown survived a success"
  rm -f "$cool"
}

check "WhatsApp sender"  "$REPO/tools/whatsapp/auto-whatsapp.sh"  "$HOME/.config/beatass-whatsapp/.cooldown"
echo
check "Instagram sender" "$REPO/tools/instagram/auto-notify.sh"   "$HOME/.config/beatass-instagram/.cooldown"

rm -rf "$TMP"
echo; [ "$fail" = 0 ] && echo "ALL PASS" || { echo "FAILURES ABOVE"; exit 1; }
