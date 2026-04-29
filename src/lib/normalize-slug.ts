const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export type SlugNormalizationResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "empty" | "invalid_format"; raw: string };

/**
 * Normalize an untrusted agent slug captured from request input
 * (query string, body, path param, hidden field).
 *
 * - Arrays (Next.js searchParams shape) collapse to the first element.
 * - null / undefined / empty string are reported as `empty` with raw="".
 * - Whitespace is trimmed and casing is lowered before validation, so
 *   "Delbert\n" and "  delbert  " both normalize to "delbert".
 * - Anything that does not match SLUG_RE after trimming is reported as
 *   `invalid_format` with the original (pre-trim) string preserved in
 *   `raw` for telemetry.
 */
export function normalizeAgentSlug(
  input: string | string[] | null | undefined,
): SlugNormalizationResult {
  const value = Array.isArray(input) ? input[0] : input;

  if (value === null || value === undefined || value === "") {
    return { ok: false, reason: "empty", raw: "" };
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") {
    return { ok: false, reason: "empty", raw: value };
  }

  if (!SLUG_RE.test(trimmed)) {
    return { ok: false, reason: "invalid_format", raw: value };
  }

  return { ok: true, slug: trimmed };
}
