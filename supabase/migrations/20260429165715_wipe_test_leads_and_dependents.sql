-- Wipe test leads and all dependent rows.
--
-- All 18 production leads were test data and confirmed by the user as
-- safe to delete in full. Done before shipping the agent_id-resolution
-- fix so the new code captures agent_id on every future insert without
-- having to backfill orphan slugs.
--
-- FK behavior reference:
--   lead_activity        CASCADE   (auto-deleted with leads — 6 rows)
--   renewal_reminders    CASCADE   (auto, 0 rows)
--   ai_conversations     SET NULL  (rows kept; we wipe explicitly anyway)
--   ai_queries           NO ACTION (would block; pre-clear)
--   consents             NO ACTION (would block; pre-clear)

-- 1. NO ACTION FKs must be empty before deleting leads.
DELETE FROM public.consents;
DELETE FROM public.ai_queries;

-- 2. ai_conversations is SET NULL but the user explicitly wants it wiped.
DELETE FROM public.ai_conversations;

-- 3. Leads — CASCADE handles lead_activity + renewal_reminders.
DELETE FROM public.leads;
