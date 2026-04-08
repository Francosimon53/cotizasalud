ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name text DEFAULT '';

-- Migrate existing data: split contact_name on first space
UPDATE leads SET
  first_name = CASE WHEN position(' ' in contact_name) > 0 THEN left(contact_name, position(' ' in contact_name) - 1) ELSE contact_name END,
  last_name = CASE WHEN position(' ' in contact_name) > 0 THEN substring(contact_name from position(' ' in contact_name) + 1) ELSE '' END
WHERE contact_name IS NOT NULL AND contact_name != '';
