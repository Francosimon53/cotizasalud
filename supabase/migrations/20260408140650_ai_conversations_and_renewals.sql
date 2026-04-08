-- Feature 1: AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  agent_slug text,
  messages jsonb DEFAULT '[]'::jsonb,
  selected_plan_hios_id text,
  selected_plan_name text,
  conversation_summary text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'ready_to_enroll', 'abandoned')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_lead ON ai_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_agent ON ai_conversations(agent_slug);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_status ON ai_conversations(status);

-- Feature 4: Add enrollment fields to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrollment_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS renewal_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_plan_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS selected_premium numeric;

-- Feature 4+5: Renewal reminders
CREATE TABLE IF NOT EXISTS renewal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  renewal_date date NOT NULL,
  reminder_60_sent boolean DEFAULT false,
  reminder_30_sent boolean DEFAULT false,
  reminder_15_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_renewal_reminders_date ON renewal_reminders(renewal_date);
CREATE INDEX IF NOT EXISTS idx_renewal_reminders_lead ON renewal_reminders(lead_id);

-- Feature 3: Auto-WhatsApp toggle on agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS auto_whatsapp boolean DEFAULT false;
