// Renewal date for an imported ACA client.
//
// Why this is not `effective_date + 365 days` (the previous rule):
//
// ACA plan years run January 1 – December 31. A policy effective 2023-01-01
// that is still in force has renewed three times since; a policy effective
// 2026-04-01 through a SEP still ends December 31, 2026. The old rule wrote
// the FIRST anniversary of the original effective date, so a book of business
// exported in 2026 landed rows with renewal dates in 2020, 2023 and 2024.
//
// That is not a cosmetic error. /api/cron/renewals matches
// `renewal_date == today + {60,30,15}` exactly, so a date in the past never
// matches and the client silently never gets a reminder — which is the whole
// reason an agent uploads a book before OEP.
//
// Correct rule: the next January 1 strictly after today (or after the
// effective date, when coverage starts in the future).

/**
 * @param effectiveDate ISO date string from the file, or null when the file
 *   has no effective-date column. Returns null in that case: without a start
 *   date we do not invent coverage, and the caller reports the count so the
 *   agent can see how many clients will have no reminder.
 * @param today injectable for tests; defaults to now.
 */
export function nextRenewalDate(
  effectiveDate: string | null | undefined,
  today: Date = new Date()
): string | null {
  if (!effectiveDate) return null;

  const effective = new Date(`${effectiveDate}T00:00:00Z`);
  if (Number.isNaN(effective.getTime())) return null;

  // Anchor on whichever comes later: today, or a future start of coverage.
  const anchor = effective.getTime() > today.getTime() ? effective : today;

  // The next January 1 strictly after the anchor. Jan 1 itself is the first
  // day of a plan year, so it renews twelve months out, not the same day —
  // which makes this `year + 1` for every anchor date.
  //
  // UTC on purpose: /api/cron/renewals derives "today" from
  // `new Date().toISOString()`, so both sides must agree on the day boundary.
  return `${anchor.getUTCFullYear() + 1}-01-01`;
}

/** Normalizes the many date shapes a spreadsheet export can carry to ISO. */
export function coerceDate(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (v === "") return null;

  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  let year: number, month: number, day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    year = Number(slash[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    // US order by default; if the first number cannot be a month, swap.
    if (a > 12) [a, b] = [b, a];
    [month, day] = [a, b];
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Evaluated BEFORE `ENROLLED_WORDS`. Matching is by substring, and several
// negative statuses contain a positive word: "Inactive" contains "active",
// "Inactivo" contains "activo", "No activo" contains "activo", "Coverage
// ended" contains "coverage". Without this list an ex-client was imported as
// `enrolled`, got `enrolled_at` stamped and a renewal reminder created.
const NOT_ENROLLED_WORDS = [
  "inactiv", "no activ", "not activ", "termin", "cancel", "expir", "vencid",
  "caducad", "lapsed", "suspend", "baja", "denied", "denegad", "declin",
  "rechazad", "no coverage", "sin cobertura", "ended",
];

const ENROLLED_WORDS = [
  "active", "activo", "activa", "enrolled", "inscrito", "inscrita", "in force",
  "inforce", "effectuated", "efectuado", "efectuada", "vigente", "confirmed",
  "confirmado", "coverage", "con cobertura",
];

/**
 * An existing client from a book export is enrolled, not a fresh lead.
 *
 * Negative words win over positive ones: because matching is by substring,
 * "Inactive"/"Inactivo" would otherwise match "active"/"activo" and a former
 * client would be stamped as enrolled. Anything that is not recognisably
 * enrolled (including empty) is a plain "new" lead.
 */
export function mapStatus(raw: string | null | undefined): "enrolled" | "new" {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "new";
  if (NOT_ENROLLED_WORDS.some((w) => v.includes(w))) return "new";
  return ENROLLED_WORDS.some((w) => v.includes(w)) ? "enrolled" : "new";
}

/** "$1,234.56" → 1234.56; empty / unparseable → null. */
export function coercePremium(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$\s,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
