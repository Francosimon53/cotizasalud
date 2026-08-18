-- ============================================================================
-- Módulo OEP 2027 — Fase B: dedupe del import de cartera
-- ============================================================================
-- Fase A's import was append-only: re-importing the same CSV duplicated every
-- client. This adds a natural dedupe key per client within an agent's book:
--
--   dedupe_key = normalized(full_name) + strongest secondary field:
--     '|d:YYYY-MM-DD'  when date_of_birth is present
--     '|z:<zip>'       when only zip_code is present
--     '|n:'            name alone (neither DOB nor ZIP)
--
-- Normalization (must match src/lib/cartera/dedupe.ts): lowercase, accents
-- stripped, whitespace collapsed and trimmed.
--
-- The app upserts on (agent_id, dedupe_key). name_only ('|n:') collisions are
-- detected app-side BEFORE writing and skipped (reported as possible
-- duplicates) — the unique index is the last line of defense, not the merge
-- mechanism for that tier.
--
-- Applied to remote via MCP apply_migration on 2026-07-20.
-- ============================================================================

-- unaccent mirrors the app's NFD diacritic stripping for the backfill.
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE portfolio_clients ADD COLUMN IF NOT EXISTS dedupe_key text;

UPDATE portfolio_clients
SET dedupe_key =
  btrim(regexp_replace(lower(unaccent(full_name)), '\s+', ' ', 'g')) ||
  CASE
    WHEN date_of_birth IS NOT NULL THEN '|d:' || to_char(date_of_birth, 'YYYY-MM-DD')
    WHEN zip_code IS NOT NULL AND btrim(zip_code) <> '' THEN '|z:' || lower(btrim(zip_code))
    ELSE '|n:'
  END
WHERE dedupe_key IS NULL;

-- Phase A's append-only imports left literal duplicates (same file imported
-- repeatedly). Keep the most recent row per (agent_id, dedupe_key).
DELETE FROM portfolio_clients a
USING portfolio_clients b
WHERE a.agent_id = b.agent_id
  AND a.dedupe_key = b.dedupe_key
  AND a.id <> b.id
  AND (a.created_at < b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));

ALTER TABLE portfolio_clients ALTER COLUMN dedupe_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_clients_agent_dedupe
  ON portfolio_clients(agent_id, dedupe_key);

-- Import history now reports new vs updated vs possible name-only duplicates.
ALTER TABLE portfolio_imports
  ADD COLUMN IF NOT EXISTS inserted_rows int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_rows int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS possible_duplicates int NOT NULL DEFAULT 0;
