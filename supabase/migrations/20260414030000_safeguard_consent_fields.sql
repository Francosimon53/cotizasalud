-- Add new Safeguard-style consent fields to the consents table
ALTER TABLE consents ADD COLUMN IF NOT EXISTS consumer_phone text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS consumer_email text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS consumer_dob text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS consumer_income numeric DEFAULT 0;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS typed_signature text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS agent_phone text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS plan_name text DEFAULT '';
ALTER TABLE consents ADD COLUMN IF NOT EXISTS plan_premium numeric DEFAULT 0;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS plan_deductible numeric DEFAULT 0;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS plan_max_oop numeric DEFAULT 0;
ALTER TABLE consents ADD COLUMN IF NOT EXISTS effective_date text DEFAULT '';
