ALTER TABLE leads ADD COLUMN IF NOT EXISTS signature_data text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_ip text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent_timestamp text DEFAULT '';
