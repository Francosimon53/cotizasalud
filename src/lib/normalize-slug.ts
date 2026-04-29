import * as Sentry from "@sentry/nextjs";

export type SlugRejectionReason =
  | "missing"
  | "empty"
  | "invalid_type"
  | "invalid_format";

export type NormalizeSlugSuccess = { ok: true; slug: string };
export type NormalizeSlugFailure = {
  ok: false;
  reason: SlugRejectionReason;
  raw: unknown;
};
export type NormalizeSlugResult = NormalizeSlugSuccess | NormalizeSlugFailure;

export function isSlugFailure(r: NormalizeSlugResult): r is NormalizeSlugFailure {
  return r.ok === false;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeAgentSlug(input: unknown): NormalizeSlugResult {
  if (input === null || input === undefined) {
    return { ok: false, reason: "missing", raw: input };
  }

  let value: unknown = input;
  if (Array.isArray(value)) {
    if (value.length === 0) return { ok: false, reason: "missing", raw: input };
    value = value[0];
    if (value === null || value === undefined) {
      return { ok: false, reason: "missing", raw: input };
    }
  }

  if (typeof value !== "string") {
    return { ok: false, reason: "invalid_type", raw: input };
  }

  const cleaned = value.trim().toLowerCase();
  if (cleaned.length === 0) {
    return { ok: false, reason: "empty", raw: input };
  }
  if (!SLUG_RE.test(cleaned)) {
    return { ok: false, reason: "invalid_format", raw: input };
  }

  return { ok: true, slug: cleaned };
}

type RequestLike = {
  url?: string | null;
  headers?: Headers | { get(name: string): string | null } | null;
};

function rawToHex(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    return Buffer.from(raw, "utf8").toString("hex");
  }
  return undefined;
}

function rawForLog(raw: unknown): string {
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function logRejection(
  result: NormalizeSlugFailure,
  request?: RequestLike
): void {
  Sentry.captureMessage("rejected_agent_slug", {
    level: "warning",
    tags: { reason: result.reason },
    extra: {
      raw: rawForLog(result.raw),
      raw_hex: rawToHex(result.raw),
      url: request?.url ?? undefined,
      referer: request?.headers?.get?.("referer") ?? undefined,
      user_agent: request?.headers?.get?.("user-agent") ?? undefined,
    },
  });
}

/**
 * Normalize an untrusted agent slug from a request, falling back to
 * `DEFAULT_AGENT_SLUG` when the input is missing, empty, or invalid.
 *
 * Logs a Sentry warning on `invalid_format` / `invalid_type` rejections
 * (the anomalous cases worth investigating). `missing` and `empty` are
 * the legitimate anonymous-visitor case and are not logged to avoid
 * drowning Sentry quota in normal traffic.
 */
export function normalizeAgentSlugFromRequest(
  rawInput: unknown,
  request?: RequestLike
): NormalizeSlugResult {
  const primary = normalizeAgentSlug(rawInput);
  if (!isSlugFailure(primary)) return primary;

  if (primary.reason === "invalid_format" || primary.reason === "invalid_type") {
    logRejection(primary, request);
  }
  const envFallback = normalizeAgentSlug(process.env.DEFAULT_AGENT_SLUG);
  if (!isSlugFailure(envFallback)) return envFallback;
  return primary;
}
