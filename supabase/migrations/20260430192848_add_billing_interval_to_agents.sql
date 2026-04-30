-- Track whether each agent's subscription is monthly or yearly.
--
-- Annual billing is being introduced alongside the existing monthly tiers
-- (basic / pro / advanced). The DEFAULT 'month' backfills every existing
-- row — including the 6 legacy_early_adopter agents — without a separate
-- UPDATE statement. Stripe webhook syncs this column on subscription
-- create/update via getTierFromPriceId().

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS billing_interval text
    CHECK (billing_interval IN ('month', 'year'))
    DEFAULT 'month';
