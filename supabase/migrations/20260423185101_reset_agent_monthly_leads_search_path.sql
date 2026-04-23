-- Address Supabase advisor warning `function_search_path_mutable` on
-- public.reset_agent_monthly_leads. A SECURITY DEFINER function that
-- does not pin search_path is vulnerable to privilege escalation via
-- a malicious object in an earlier schema on the caller's path.
-- Pinning to `public, pg_temp` keeps the helper behavior identical.
CREATE OR REPLACE FUNCTION public.reset_agent_monthly_leads(agent_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.agents
  SET
    leads_count_current_month = 0,
    leads_count_reset_at = (date_trunc('month', now()) + interval '1 month')
  WHERE
    id = agent_uuid
    AND leads_count_reset_at <= now();
END;
$$;
