-- ============================================================================
-- Security cleanup: revoke EXECUTE and drop ABA Sensei orphans
-- ============================================================================
-- Closes 5 Supabase Security Advisor warnings:
--   1. anon_security_definer_function_executable on reset_agent_monthly_leads
--   2. authenticated_security_definer_function_executable on reset_agent_monthly_leads
--   3. rls_policy_always_true on aba_video_queue (INSERT)
--   4. rls_policy_always_true on aba_video_queue (UPDATE)
--   5. public_bucket_allows_listing on aba-audio (bucket deleted via Dashboard)
--
-- Investigation completed (Claude Code, 2026-05-01):
--   - reset_agent_monthly_leads has zero callsites in src/, supabase/migrations/,
--     vercel.json. Function is currently unused legacy code. The original migration
--     comment claims "Backend calls this before each lead insert" but that logic
--     was never connected. service_role retains EXECUTE for future server-side use.
--   - aba_video_queue: 0 rows. ABA Sensei orphan from incorrect project targeting
--     (developer was working on ABA Sensei pipeline and accidentally created
--     resources in the EnrollSalud Supabase project).
--   - aba-audio bucket: 0 files. Same root cause. Bucket itself deleted via the
--     Supabase Dashboard because Storage API blocks direct DELETE FROM storage.buckets
--     to prevent accidental data loss.
--
-- Applied to remote via MCP apply_migration on 2026-05-01.
-- Two MCP applies were used (one for the bulk, one corrective for REVOKE FROM PUBLIC);
-- this single file represents the final consolidated state.
-- ============================================================================

-- Part 1: Revoke EXECUTE on reset_agent_monthly_leads from PUBLIC and re-grant
-- explicitly to service_role only. PUBLIC includes anon and authenticated, so a
-- naive REVOKE FROM anon, authenticated leaves PUBLIC's grant intact.
REVOKE EXECUTE ON FUNCTION public.reset_agent_monthly_leads(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_agent_monthly_leads(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_agent_monthly_leads(uuid) TO service_role;

-- Part 2: Drop orphan table aba_video_queue (CASCADE drops associated policies)
DROP TABLE IF EXISTS public.aba_video_queue CASCADE;

-- Part 3: Drop orphan storage policies for the deleted aba-audio bucket
DROP POLICY IF EXISTS "allow-anon-insert m46p0p_0" ON storage.objects;
DROP POLICY IF EXISTS "allow-anon-insert m46p0p_1" ON storage.objects;
