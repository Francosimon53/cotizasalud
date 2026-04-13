-- Expanded contact/enrollment fields for HealthSherpa
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dob text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS street_address text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state_form text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS apt_number text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_insurance text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS current_insurance_name text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contact_preference text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS best_call_time text DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS household_dobs text DEFAULT '';
