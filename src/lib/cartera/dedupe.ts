// Natural-key dedupe for portfolio imports (Fase B). A client is identified
// within one agent's book by normalized name + the strongest secondary field
// available. The same normalization is mirrored in SQL by the backfill in
// supabase/migrations/20260720190000_portfolio_dedupe.sql — keep in sync.
//
// Tiers (strongest available wins):
//   dob       "<name>|d:<YYYY-MM-DD>"  — name + date of birth
//   zip       "<name>|z:<zip>"         — name + zip code (no DOB in the CSV)
//   name_only "<name>|n:"              — name alone (neither DOB nor ZIP)
//
// name_only matches are NEVER auto-merged: two different people can share a
// name, and silently fusing them is the worst possible failure here. Rows
// whose name_only key collides (with the DB or within the same file) are
// skipped and reported as possible duplicates for the agent to review.

export type DedupeTier = "dob" | "zip" | "name_only";

export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function dedupeKeyFor(client: {
  full_name: string;
  date_of_birth?: string | null;
  zip_code?: string | null;
}): { key: string; tier: DedupeTier } {
  const name = normalizeName(client.full_name);
  if (client.date_of_birth) {
    return { key: `${name}|d:${client.date_of_birth}`, tier: "dob" };
  }
  const zip = client.zip_code?.trim().toLowerCase();
  if (zip) {
    return { key: `${name}|z:${zip}`, tier: "zip" };
  }
  return { key: `${name}|n:`, tier: "name_only" };
}
