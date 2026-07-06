-- Capability token for the anonymous cotizar flow (W3C/OWASP capability-URL
-- pattern). /api/leads/browse and POST /api/leads generate a random token,
-- return it once to the browser that created the lead, and store only its
-- SHA-256 here. The public write endpoints (plan-select, contact-upgrade,
-- notify-lead, consents-with-leadId) require the raw token in the
-- x-lead-token header and compare hashes, replacing the old 10-minute
-- created_at recency window that rejected slow clients.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS client_token_hash text;
