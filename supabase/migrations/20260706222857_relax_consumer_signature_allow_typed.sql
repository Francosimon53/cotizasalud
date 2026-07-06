-- Housekeeping: this migration is ALREADY APPLIED on the remote Supabase
-- (version 20260706222857). Registered here so the repo matches the remote
-- schema_migrations history — do not re-run it manually.
--
-- Consent can now be signed either by drawing (consumer_signature) or by
-- typing the name (typed_signature), so consumer_signature alone can no
-- longer be NOT NULL. The CHECK keeps the real invariant: at least one of
-- the two signature forms must be present.
ALTER TABLE consents ALTER COLUMN consumer_signature DROP NOT NULL;
ALTER TABLE consents ADD CONSTRAINT consents_at_least_one_signature
  CHECK (consumer_signature IS NOT NULL OR (typed_signature IS NOT NULL AND typed_signature <> ''));
