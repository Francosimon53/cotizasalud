-- Immigration eligibility triage (OBBBA / H.R.1). From 2027-01-01 (OEP
-- Nov-Dec 2026) only citizens, LPRs, Cuban/Haitian entrants and COFA keep
-- ACA subsidies; asylum/TPS/refugee/parole lose them and DACA is out of the
-- Marketplace since Aug-2025. The status is self-reported and optional; the
-- flag is computed server-side by src/lib/eligibility/rules.ts and stamped
-- with the rules version it was computed under.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS immigration_status text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS eligibility_flag text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS eligibility_rules_version text;
-- Which product the agent is steering this lead to (aca | private | medicare
-- | medicaid_referral). Defaults to the ACA marketplace track.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_track text DEFAULT 'aca';
