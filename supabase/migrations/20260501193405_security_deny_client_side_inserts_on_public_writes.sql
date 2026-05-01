-- ============================================================================
-- Security hardening: replace permissive INSERT policies with explicit DENY
-- ============================================================================
-- Closes 4 Supabase Security Advisor warnings of type rls_policy_always_true:
--   1. consents:    "Allow public consent inserts"    (WITH CHECK true)
--   2. leads:       "Allow public lead inserts"       (WITH CHECK true)
--   3. ai_queries:  "Allow public ai query inserts"   (WITH CHECK true)
--   4. page_views:  "Allow public page view inserts"  (WITH CHECK true)
--
-- Architecture verified (Claude Code, 2026-05-01):
--   - All INSERTs into these 4 tables happen server-side in Next.js API routes
--     using SUPABASE_SERVICE_ROLE_KEY via the createServiceClient helper.
--   - There are zero client-side INSERTs in src/components/, src/app/q/, or
--     src/app/cotizar/ for these tables. The frontend writes via fetch('/api/...').
--   - The legacy anon-key client exported from src/lib/supabase.ts is dead code
--     (zero importers) and should be removed in a future cleanup PR.
--
-- Why DENY instead of DROP:
--   service_role bypasses RLS, so explicit DENY for anon/authenticated is the
--   simplest correct expression of the security model. Defense in depth: if a
--   future change accidentally uses anon key, RLS will block writes with a
--   clear error rather than silently inserting. Avoids the 4 new INFOs that
--   DROPping would generate (rls_enabled_no_policy).
--
-- Applied to remote via MCP apply_migration on 2026-05-01.
-- ============================================================================

-- consents (legal-critical: TCPA opt-in evidence)
DROP POLICY IF EXISTS "Allow public consent inserts" ON public.consents;
CREATE POLICY "Deny client-side inserts (service_role only)"
  ON public.consents
  FOR INSERT
  TO public
  WITH CHECK (false);

-- leads (CRM core)
DROP POLICY IF EXISTS "Allow public lead inserts" ON public.leads;
CREATE POLICY "Deny client-side inserts (service_role only)"
  ON public.leads
  FOR INSERT
  TO public
  WITH CHECK (false);

-- ai_queries (Plan Advisor query log)
DROP POLICY IF EXISTS "Allow public ai query inserts" ON public.ai_queries;
CREATE POLICY "Deny client-side inserts (service_role only)"
  ON public.ai_queries
  FOR INSERT
  TO public
  WITH CHECK (false);

-- page_views (analytics)
DROP POLICY IF EXISTS "Allow public page view inserts" ON public.page_views;
CREATE POLICY "Deny client-side inserts (service_role only)"
  ON public.page_views
  FOR INSERT
  TO public
  WITH CHECK (false);
