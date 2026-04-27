-- SaaS tiered pricing schema for agent billing.
--
-- Tiers: basic (50 leads/mo), pro (200), advanced (500), plus `trial`
-- (14 days at Pro limits) and `legacy_early_adopter` (the 6 current
-- agents get 2 months of Pro free as a thank-you; they convert to a
-- paid tier afterwards).
--
-- Stripe integration lands in a follow-up PR. This migration only
-- covers schema + backfill of existing rows.

-- ────────────────────────────────────────────────────────────────
-- 1. Columns
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS leads_limit_monthly INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS leads_count_current_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leads_count_reset_at TIMESTAMPTZ DEFAULT (date_trunc('month', now()) + interval '1 month'),
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS legacy_grace_period_until TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────────
-- 2. Plan check constraint (trial | basic | pro | advanced | legacy_early_adopter)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.agents DROP CONSTRAINT IF EXISTS agents_subscription_plan_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_subscription_plan_check
  CHECK (subscription_plan IN ('trial', 'basic', 'pro', 'advanced', 'legacy_early_adopter'));

-- ────────────────────────────────────────────────────────────────
-- 3. Backfill: existing trial agents become `legacy_early_adopter`
-- with 2 months of Pro-tier limits as a thank-you.
-- ────────────────────────────────────────────────────────────────
UPDATE public.agents
SET
  subscription_plan = 'legacy_early_adopter',
  subscription_status = 'trialing',
  leads_limit_monthly = 200,
  legacy_grace_period_until = (now() + interval '2 months'),
  subscription_start = COALESCE(subscription_start, now()),
  subscription_end = (now() + interval '2 months')
WHERE subscription_plan = 'trial';

-- ────────────────────────────────────────────────────────────────
-- 4. Map any legacy paid plan values. Production audit at write time
-- shows zero such rows, but this keeps the migration idempotent and
-- covers other environments.
-- ────────────────────────────────────────────────────────────────
UPDATE public.agents
SET subscription_plan = 'pro', leads_limit_monthly = 200
WHERE subscription_plan IN ('monthly', 'annual');

UPDATE public.agents
SET subscription_plan = 'advanced', leads_limit_monthly = 500
WHERE subscription_plan = 'annual_premium';

-- ────────────────────────────────────────────────────────────────
-- 5. Helper: reset a single agent's monthly counter when due.
-- Backend calls this before each lead insert; the WHERE clause makes
-- it a no-op if the reset window hasn't elapsed yet.
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_agent_monthly_leads(agent_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.agents
  SET
    leads_count_current_month = 0,
    leads_count_reset_at = (date_trunc('month', now()) + interval '1 month')
  WHERE
    id = agent_uuid
    AND leads_count_reset_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
