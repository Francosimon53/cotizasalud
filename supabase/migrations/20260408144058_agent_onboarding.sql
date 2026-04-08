ALTER TABLE agents ADD COLUMN IF NOT EXISTS licensed_states text[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS appointed_carriers text[] DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'es';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
