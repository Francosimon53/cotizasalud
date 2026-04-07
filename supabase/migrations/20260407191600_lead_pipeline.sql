-- Add pipeline timestamp columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacted_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quoted_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrolled_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup_date date;

-- Create lead_activity table
CREATE TABLE IF NOT EXISTS lead_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  lost_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_id ON lead_activity(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activity_created_at ON lead_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_next_followup ON leads(next_followup_date) WHERE next_followup_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
