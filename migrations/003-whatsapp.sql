-- WhatsApp delivery, added 2026-08-04.
--
-- A third way to reach somebody, beside email and Instagram. India only, so a
-- number is stored in exactly one shape and never any other: a plus, 91, then
-- the ten digits. Cleaning happens once, at the door (waNumber in
-- src/index.js), so nothing downstream ever has to guess what shape it got.
--
-- Every message that already exists gets NULL here, which every read treats as
-- "no WhatsApp number" - the same way to_handle has always worked.
--
-- Run once per database:
--   npx wrangler d1 execute beatass-db --local  --file migrations/003-whatsapp.sql
--   npx wrangler d1 execute beatass-db --remote --file migrations/003-whatsapp.sql

ALTER TABLE messages ADD COLUMN to_whatsapp TEXT;
