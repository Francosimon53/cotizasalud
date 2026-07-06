import { createHash, randomBytes, timingSafeEqual } from "crypto";

// Capability token that authorizes anonymous cotizar writes to a single lead.
// The raw token is returned exactly once to the browser that created the lead;
// the database stores only its SHA-256, so a leaked leads row cannot be
// replayed as a write credential.

export function generateLeadToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashLeadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Constant-time comparison. Returns false (never throws) on missing or
// malformed input so callers can funnel every failure into the same
// generic 400 without leaking which check failed.
export function verifyLeadToken(
  token: string | null | undefined,
  storedHash: string | null | undefined
): boolean {
  if (!token || !storedHash) return false;
  const provided = Buffer.from(hashLeadToken(token), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (provided.length !== stored.length) return false;
  return timingSafeEqual(provided, stored);
}
