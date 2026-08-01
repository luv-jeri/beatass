-- beatass database.
--
-- Two tables. `messages` is what was sent, so a report can be investigated
-- and so the media has an owner. `blocklist` is the promise we make in every
-- email: one click and that address never hears from this site again.

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,          -- also the R2 filename
  to_email    TEXT NOT NULL,
  to_name     TEXT NOT NULL,
  body        TEXT NOT NULL,
  stats       TEXT NOT NULL DEFAULT '',  -- "14 hits · 6 pins · burned"
  has_gif     INTEGER NOT NULL DEFAULT 0,
  has_mp4     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,          -- unix seconds
  sender_hash TEXT NOT NULL DEFAULT '',  -- hashed IP. Never the raw address.
  reports     INTEGER NOT NULL DEFAULT 0
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
