-- 005 — the bug reporter's case file.
--
-- One row per report, and the row IS the case: it carries the report, the
-- verdict, the issue, the pull request, and whether the person who reported it
-- has been told. Nothing about a report lives anywhere else, so "what happened
-- to report X" is one SELECT and never a hunt through logs.
--
-- Run against the live database with:
--   npx wrangler d1 execute beatass-db --remote --file migrations/005-bug-reports.sql

CREATE TABLE IF NOT EXISTS bug_reports (
  id            TEXT PRIMARY KEY,           -- 16 hex, same shape as a message id
  ts            INTEGER NOT NULL,           -- unix seconds, when it arrived

  -- the report itself. bundle_json holds the sanitised capture; it has already
  -- been through the browser's scrubber before it ever reached us, and the
  -- Worker checks it again on the way in.
  kind          TEXT NOT NULL DEFAULT '',   -- bug | doll | send | look | wording | feature
  note          TEXT NOT NULL DEFAULT '',   -- what the person typed
  reply_email   TEXT NOT NULL DEFAULT '',   -- theirs, only if they asked for an answer
  route         TEXT NOT NULL DEFAULT '',   -- which page, path only, never a query string
  bundle_json   TEXT NOT NULL,              -- logs, network shapes, steps, environment
  shot_keys     TEXT NOT NULL DEFAULT '[]', -- R2 keys for any attached image
  truncated     INTEGER NOT NULL DEFAULT 0, -- 1 if the 512 KB ceiling dropped anything
  sender_hash   TEXT NOT NULL DEFAULT '',   -- hashed IP, for rate limiting and abuse review

  -- where the case has got to. Every move is one of these, in this order:
  --   received -> triaged -> issue_ready -> issue_open -> fixing
  --            -> pr_ready -> pr_open -> shipped -> closed
  -- with dismissed as the early exit for anything that is not a real defect.
  state         TEXT NOT NULL DEFAULT 'received',

  -- what the triage decided, and why. verdict is one of:
  --   real_bug | user_error | cache_cookie | feature_request
  --   duplicate | abuse | unactionable | needs_human
  verdict       TEXT,
  verdict_why   TEXT,                       -- one line, in words a person can read
  confidence    INTEGER,                    -- 0-100. Anything low enough becomes needs_human
  triaged_at    INTEGER,
  duplicate_of  TEXT,                       -- the earlier report id, when verdict = duplicate

  -- the outward artefacts. Each one only ever gets filled in AFTER a human
  -- said yes, which is why they are nullable and why nothing derives state
  -- from their absence.
  issue_url     TEXT,
  pr_url        TEXT,
  shipped_sha   TEXT,                       -- the commit proven live, not merely merged
  notified_at   INTEGER                     -- when the reporter was told it was fixed
);

-- the queue reads by state, oldest first
CREATE INDEX IF NOT EXISTS idx_bugs_state ON bug_reports (state, ts);
CREATE INDEX IF NOT EXISTS idx_bugs_ts    ON bug_reports (ts);
-- duplicate detection groups by what and where
CREATE INDEX IF NOT EXISTS idx_bugs_route ON bug_reports (route, kind);
