-- ============================================================================
-- Cleanup: remove duplicate agent records
-- ============================================================================
-- Two agents in public.agents were duplicates created during initial signup
-- experiments. The canonical records (the ones being kept) are the ones with
-- valid NPN values, complete names, and (where relevant) auth linkage:
--
--   KEEP:   slug='delbert'      (NPN 18748069, real name "Delbert Useches")
--   DELETE: slug='delbertuseches' (NPN null, lowercase no-space name)
--
--   KEEP:   slug='liliana-vera' (NPN 18168849, name "Liliana Vera", with auth)
--   DELETE: slug='liliana'      (NPN 18168849, name "Liliana Vera Feo", no auth)
--
-- Pre-flight verification (Claude via MCP, 2026-05-01):
--   - Both doomed agents have ZERO referencing rows in leads, consents, ai_queries.
--   - 'liliana' has auth_user_id = NULL, so no auth.users row to remove.
--   - 'delbertuseches' has auth_user_id mapped to delbertuseches@gmail.com.
--     That auth row was created on 2026-04-17 and only ever signed in once
--     (same day, signup). Removing it keeps auth.users in sync.
--   - No other public.* table has a FK to auth.users, so dropping that auth
--     row is safe.
--
-- Applied to remote via MCP apply_migration on 2026-05-01.
-- ============================================================================

BEGIN;

DELETE FROM public.agents
WHERE id IN (
  'bcd8d7c1-90bc-478a-ac58-e24a272e33f1',
  '58715581-5c2b-4c00-b800-3e05813ae8ca'
);

DELETE FROM auth.users
WHERE id = '7e92c4f4-a341-4321-940f-074e5ceb9286';

DO $$
DECLARE
  agent_count INT;
BEGIN
  SELECT COUNT(*) INTO agent_count FROM public.agents;
  IF agent_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 agents after cleanup, got %', agent_count;
  END IF;
END $$;

COMMIT;
