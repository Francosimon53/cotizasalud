-- Enable RLS on 3 tables that were missing protection.
-- Backend uses createServiceClient() (service_role) which BYPASSES RLS,
-- so no policies are needed. Anon key is now correctly denied by default.
-- Closes data-breach risk on lead_activity, ai_conversations, renewal_reminders.
--
-- Applied to production via Supabase MCP on 2026-04-20 17:57:20 UTC.
-- Re-running via CLI (supabase db push) is idempotent — ALTER TABLE ENABLE RLS
-- on an already-enabled table is a no-op warning, not an error.

ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renewal_reminders ENABLE ROW LEVEL SECURITY;
