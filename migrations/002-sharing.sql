-- The sharing lane, added 2026-08-03.
--
-- Everything here hangs off share_ok. A confession is a private letter unless
-- its sender ticked the box on the send screen, so share_ok defaults to 0 and
-- every message that already existed keeps that 0 forever: those people were
-- never asked, so they never agreed, so their words are not postable. Ever.
--
-- Run once per database:
--   npx wrangler d1 execute beatass-db --local  --file migrations/002-sharing.sql
--   npx wrangler d1 execute beatass-db --remote --file migrations/002-sharing.sql

ALTER TABLE messages ADD COLUMN share_ok     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN score        INTEGER;
ALTER TABLE messages ADD COLUMN score_reason TEXT;
ALTER TABLE messages ADD COLUMN scored_at    INTEGER;
ALTER TABLE messages ADD COLUMN post_state   TEXT;
ALTER TABLE messages ADD COLUMN posted_at    INTEGER;

-- The review queue reads "shared, judged, not posted yet" on every load.
CREATE INDEX IF NOT EXISTS idx_messages_share ON messages (share_ok, score);
