# Shared backoff for the unattended senders (WhatsApp, Instagram).
#
# The problem it solves. Both senders are on a short launchd timer, and both
# skip out instantly when the queue is empty - which is what makes a 1-2 minute
# timer cheap. But when a run fails as a WHOLE (the saved session logged out,
# WhatsApp or Instagram redesigned a screen) nothing counts that failure: the
# per-message retry counter inside notify.mjs is never reached, because the run
# dies before the first message. The queue stays non-empty, so the timer tries
# again in 60 seconds, and again, forever.
#
# Found live 2026-08-08: the WhatsApp session had logged out, and because that
# sender must run VISIBLE (headless cannot restore the login - tested 2026-08-04)
# a browser window showing the QR page opened on Sanjay's screen once a minute
# for hours. The Instagram sender runs headless, so the same loop there is
# invisible - which is worse in one way: hundreds of failed sign-ins a day is
# exactly what gets an account flagged.
#
# The rule: 30 minutes of quiet per consecutive whole-run failure, capped at 6
# hours. Linear rather than doubling because the number that matters is the
# first one; the cap is what stops it being an all-day annoyance. Any run that
# exits clean clears the count, so a fixed session resumes the normal timer by
# itself with nothing to remember.
#
# Deliberately NOT here: giving up permanently. A logged-out session is fixed by
# a human scanning a QR code, and there is no way for this script to know when
# that happened - so it has to keep asking, just slowly.

BACKOFF_STEP=1800     # 30 minutes per consecutive failure
BACKOFF_CAP=21600     # never wait longer than 6 hours
BACKOFF_FAILS=0

# How long to stay quiet after $1 consecutive failures.
_backoff_wait() {
  w=$((BACKOFF_STEP * $1))
  [ "$w" -gt "$BACKOFF_CAP" ] && w=$BACKOFF_CAP
  echo "$w"
}

# backoff_skip <statefile> - true (exit 0) when this run should not happen yet.
# Reads the consecutive-failure count into BACKOFF_FAILS as a side effect, so
# backoff_note can carry on counting from it.
backoff_skip() {
  BACKOFF_FAILS=$(cat "$1" 2>/dev/null || echo 0)
  case "$BACKOFF_FAILS" in ''|*[!0-9]*) BACKOFF_FAILS=0 ;; esac
  [ "$BACKOFF_FAILS" -eq 0 ] && return 1
  [ $(( $(date +%s) - $(stat -f %m "$1") )) -lt "$(_backoff_wait "$BACKOFF_FAILS")" ]
}

# backoff_note <statefile> <logfile> <exit code> - record how the run ended.
backoff_note() {
  if [ "$3" -eq 0 ]; then
    [ -f "$1" ] && { rm -f "$1"; echo "  (recovered - back to the normal timer)" >> "$2"; }
  else
    BACKOFF_FAILS=$((BACKOFF_FAILS + 1))
    echo "$BACKOFF_FAILS" > "$1"
    echo "  run failed (exit $3), failure $BACKOFF_FAILS - quiet for $(( $(_backoff_wait "$BACKOFF_FAILS") / 60 )) minutes" >> "$2"
  fi
}
