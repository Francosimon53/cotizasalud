-- Track when day-3 / day-7 "no response" reminder emails were sent to agents,
-- so the lead-reminders cron never sends a duplicate reminder for the same lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reminder_3_sent_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reminder_7_sent_at timestamptz;

-- Partial indexes: the cron only ever scans leads whose reminder is still
-- unsent, so index those rows to keep the daily query cheap as leads grow.
CREATE INDEX IF NOT EXISTS idx_leads_reminder_3_pending
  ON leads(created_at)
  WHERE reminder_3_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_reminder_7_pending
  ON leads(created_at)
  WHERE reminder_7_sent_at IS NULL;
