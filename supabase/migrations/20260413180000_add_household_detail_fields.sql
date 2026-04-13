-- Add per-member household detail fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS genders text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS household_members jsonb;
