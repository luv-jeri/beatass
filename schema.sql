-- beatass database.
--
-- Two tables. `messages` is what was sent, so a report can be investigated
-- and so the media has an owner. `blocklist` is the promise we make in every
-- email: one click and that address never hears from this site again.

CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,          -- also the R2 filename
  to_email     TEXT NOT NULL,             -- '' when the recipient is handle-only
  to_name      TEXT NOT NULL,
  body         TEXT NOT NULL,
  stats        TEXT NOT NULL DEFAULT '',  -- "14 hits · 6 pins · burned"
  has_gif      INTEGER NOT NULL DEFAULT 0,
  has_mp4      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,          -- unix seconds
  sender_hash  TEXT NOT NULL DEFAULT '',  -- hashed IP. Never the raw address.
  sender_ua    TEXT,                       -- sender's User-Agent (browser + device), for abuse review. Never shown.
  sender_geo   TEXT,                       -- sender's country/region/city . ASN org (Cloudflare), for abuse review. Never shown.
  reports      INTEGER NOT NULL DEFAULT 0,
  sender_email TEXT,                       -- the sender's own address, if they want replies. Never shown.
  to_handle    TEXT,                       -- the recipient's Instagram handle, if given. Never shown.
  to_whatsapp  TEXT,                       -- the recipient's WhatsApp number as '+91XXXXXXXXXX', if given. Never shown.
  view_token   TEXT,                       -- /m link token, minted at send time for the notifiers. Set whenever a handle or a number is.
  -- The sharing lane. A confession is a private letter by default: share_ok is
  -- 0 unless the sender ticked the box on the send screen, and nothing with a 0
  -- may ever be posted anywhere. Everything below is meaningless without it.
  share_ok     INTEGER NOT NULL DEFAULT 0, -- 1 only if the sender said yes, in words, at send time
  score        INTEGER,                    -- 0-100, how well it reads as a post. NULL = not judged yet
  score_reason TEXT,                       -- one line from the classifier, so a number is never the whole story
  scored_at    INTEGER,                    -- unix seconds
  post_state   TEXT,                       -- NULL | 'queued' (Sanjay pressed post) | 'posted' | 'skipped'
  posted_at    INTEGER                     -- unix seconds, set when it actually went out
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_to      ON messages (to_email);

-- Checked before every single send. Permanent by design: there is no
-- "unblock" endpoint, because the person who blocked us is not the person
-- who would be asking to undo it.
CREATE TABLE IF NOT EXISTS blocklist (
  email      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- The single action log (migration 004). One row per thing the system does -
-- a confession received, delivered, failed, retried, viewed, reported, blocked,
-- a sender turned away - written by both the Worker and the laptop notifiers, so
-- a message's whole life is readable from one place and a stuck one is findable.
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          INTEGER NOT NULL,           -- unix seconds
  msg_id      TEXT,                        -- the message this is about, or NULL for site-wide
  channel     TEXT NOT NULL DEFAULT '',    -- '' | 'email' | 'instagram' | 'whatsapp' | 'site'
  action      TEXT NOT NULL,               -- 'received' | 'delivered' | 'failed' | 'retry' | 'viewed' | 'reported' | 'blocked' | 'sender-blocked'
  outcome     TEXT NOT NULL DEFAULT 'ok',  -- 'ok' | 'error' | 'skip'
  detail      TEXT NOT NULL DEFAULT '',    -- freeform: an error, a step, an attempt count, a place
  sender_hash TEXT NOT NULL DEFAULT ''     -- ties an event to a sender fingerprint where one applies
);
CREATE INDEX IF NOT EXISTS idx_events_ts     ON events (ts);
CREATE INDEX IF NOT EXISTS idx_events_msg    ON events (msg_id);
CREATE INDEX IF NOT EXISTS idx_events_action ON events (action);
CREATE INDEX IF NOT EXISTS idx_events_sender ON events (sender_hash);

-- Senders judged to be abusing the service, checked before every /api/send.
-- Keyed by the hashed IP (never a raw address, no cookie). Permanent by design.
CREATE TABLE IF NOT EXISTS sender_blocklist (
  sender_hash TEXT PRIMARY KEY,
  reason      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);
