-- ============================================================================
-- Módulo OEP 2027 — Fase A: book of business del agente + scoring de riesgo
-- ============================================================================
-- Two new tables, both owned by an agent (agents.id):
--   - portfolio_imports: one row per CSV import (counts + PII-free error summary)
--   - portfolio_clients: one row per client in the agent's book of business,
--     with a 0-100 renewal-risk score computed at import time.
--
-- Security model (same as the rest of the system):
--   - RLS enabled, deny-by-default. All policies deny anon/authenticated.
--   - All reads/writes happen server-side via createServiceClient()
--     (service_role, bypasses RLS); agent isolation is enforced in the route
--     handlers by filtering on agent_id resolved from the session cookie.
--
-- Phase B (batch re-quoting) and C (outreach) will reuse these columns
-- (zip/county/household/income for quoting; phone/email for outreach).
--
-- Applied to remote via MCP apply_migration on 2026-07-20.
-- ============================================================================

CREATE TABLE IF NOT EXISTS portfolio_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  file_name text,
  total_rows int NOT NULL DEFAULT 0,
  valid_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  -- PII-free summary: [{ "row": 12, "reason": "invalid_premium" }, ...]
  errors jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  import_id uuid REFERENCES portfolio_imports(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  date_of_birth date,
  estimated_age int,
  zip_code text,
  county text,
  household_members int,
  estimated_annual_income numeric,
  current_carrier text,
  metal_level text CHECK (metal_level IN ('bronze', 'silver', 'gold', 'platinum')),
  monthly_premium numeric,
  monthly_subsidy numeric,
  auto_renewal boolean,
  phone text,
  email text,
  risk_score int NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level text NOT NULL CHECK (risk_level IN ('critical', 'high', 'medium', 'low')),
  -- Array of reason keys (e.g. "subsidy_cliff"); translated to Spanish in the UI
  risk_reasons jsonb NOT NULL DEFAULT '[]',
  score_confidence int NOT NULL CHECK (score_confidence BETWEEN 0 AND 100),
  source text NOT NULL DEFAULT 'csv',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_imports_agent_id ON portfolio_imports(agent_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_clients_agent_id ON portfolio_clients(agent_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_clients_agent_risk ON portfolio_clients(agent_id, risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_clients_import_id ON portfolio_clients(import_id);

ALTER TABLE portfolio_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_clients ENABLE ROW LEVEL SECURITY;

-- Explicit deny for anon/authenticated (service_role bypasses RLS).
-- Same defense-in-depth rationale as 20260501193405.
CREATE POLICY "Deny client-side access (service_role only)"
  ON portfolio_imports
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client-side access (service_role only)"
  ON portfolio_clients
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);
