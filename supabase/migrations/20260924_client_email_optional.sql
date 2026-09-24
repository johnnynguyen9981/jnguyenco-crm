-- Allow clients without an email address (e.g. enquiries that come in via
-- Messenger/Instagram DMs). The contract signing link can be shared directly
-- and the client's email is captured on the signing page instead.
--
-- The (owner_id, email) unique index still applies to real addresses;
-- Postgres treats NULLs as distinct, so any number of email-less clients is fine.
ALTER TABLE clients ALTER COLUMN email DROP NOT NULL;

-- Normalise any blank strings to NULL so they don't collide on the unique index.
UPDATE clients SET email = NULL WHERE email IS NOT NULL AND btrim(email) = '';
