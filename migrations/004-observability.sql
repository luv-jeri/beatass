-- 004: observability + sender fingerprinting.
--
-- Two goals Sanjay set (2026-08-05):
--   1. Log EVERY action the system takes, in one place, so a failure is found by
--      reading a table and a stuck message is retried by a script - not by asking
--      an AI to go look.
--   2. Capture enough about the SENDER of a confession (browser, device, rough
--      location, a stable hash of their IP) to identify an abuser and block them.
--
-- Privacy: no raw IP is ever stored. sender_hash stays the hashed IP, exactly as
-- before. The browser/location fields below are non-identifying context a human
-- reads to decide who is abusing the service. None of it is ever shown to the
-- recipient - a confession stays anonymous to the person who receives it.

-- The single action log. Everything the Worker AND the laptop notifiers do lands
-- here: a confession received, a delivery attempt, delivered, failed, retried, a
-- recipient block/report, a view, a sender blocked. One row per event, so a
-- message's whole life reads back from one place and a stuck one is findable.
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

-- Senders judged to be abusing the service. Checked before every /api/send.
-- Keyed by the hashed IP - the one stable-ish signal we hold without storing a raw
-- address or setting a cookie (mobile IPs rotate, so this is a floor, not a wall;
-- the fingerprint fields below are what a human uses to spot the same abuser again).
-- Permanent, like the recipient blocklist.
CREATE TABLE IF NOT EXISTS sender_blocklist (
  sender_hash TEXT PRIMARY KEY,
  reason      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

-- The sender fingerprint, stored beside the confession it came with. sender_hash
-- (the hashed IP) already exists on messages; these add the human-readable context
-- a person reviews to judge abuse. Never shown to the recipient. These ALTER lines
-- come last on purpose: on a fresh/test DB the columns already exist from
-- schema.sql, so these fail as "duplicate column" and the test harness tolerates
-- it - putting them after the CREATEs means nothing important is skipped if the
-- runner aborts the file on that tolerated error.
ALTER TABLE messages ADD COLUMN sender_ua  TEXT;   -- User-Agent: browser + device.
ALTER TABLE messages ADD COLUMN sender_geo TEXT;   -- "country/region/city . ASN org" from Cloudflare.
