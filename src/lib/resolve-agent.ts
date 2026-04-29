import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve agent_id from a normalized agent_slug at lead-creation time.
 *
 * Callers MUST normalize the slug at the request boundary via
 * `normalizeAgentSlug` before passing it here. This function trusts its
 * input and only performs the DB lookup + orphan-detection.
 *
 * - When the slug doesn't match any agent, returns agent_id=null and
 *   emits a Sentry warning so we can spot orphan slugs in production.
 * - Empty/missing slug returns both fields null without warning — that's
 *   the legitimate "anonymous visitor" case.
 */
export async function resolveAgentFromSlug(
  supabase: SupabaseClient,
  slug: string | null | undefined,
  context: Record<string, unknown> = {}
): Promise<{ agent_id: string | null; agent_slug: string | null }> {
  if (typeof slug !== "string" || slug === "") {
    return { agent_id: null, agent_slug: null };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (agent?.id) {
    return { agent_id: agent.id as string, agent_slug: slug };
  }

  Sentry.captureMessage("orphan_agent_slug", {
    level: "warning",
    tags: { agent_slug: slug },
    extra: { slug, ...context },
  });
  return { agent_id: null, agent_slug: slug };
}
