import * as Sentry from "@sentry/nextjs";
import type { SlugNormalizationResult } from "./normalize-slug";

export type SlugLoggingContext = {
  url?: string | null;
  referer?: string | null;
  userAgent?: string | null;
};

function toHex(s: string): string {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Emit a structured Sentry warning when an agent slug fails format
 * validation. No-op for `ok` results and for `empty` rejections (the
 * legitimate anonymous-visitor case — logging it would flood the quota
 * on every untagged page load).
 *
 * Wraps the inline pattern from the PR spec to give us a single typed
 * failure narrow despite the project's `strict: false` tsconfig, which
 * blocks `if (!r.ok && r.reason === ...)` from narrowing the union.
 */
export function captureInvalidAgentSlug(
  result: SlugNormalizationResult,
  source: string,
  ctx: SlugLoggingContext,
): void {
  if (result.ok) return;
  // The project's tsconfig has strict: false, which suppresses
  // discriminated-union narrowing through early returns. Assert the
  // failure shape we just established by ruling out ok=true above.
  const failure = result as Extract<SlugNormalizationResult, { ok: false }>;
  if (failure.reason !== "invalid_format") return;

  Sentry.captureMessage("Invalid agent slug discarded", {
    level: "warning",
    tags: { source, reason: failure.reason },
    extra: {
      raw: failure.raw,
      raw_hex: toHex(String(failure.raw)),
      url: ctx.url ?? undefined,
      referer: ctx.referer ?? undefined,
      user_agent: ctx.userAgent ?? undefined,
    },
  });
}
