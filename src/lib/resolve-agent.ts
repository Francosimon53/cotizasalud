import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve agent_id from agent_slug at lead-creation time.
 *
 * - Trims whitespace (a previous bug let "delbert\n" through env vars).
 * - When the trimmed slug doesn't match any agent, returns agent_id=null
 *   and emits a Sentry warning so we can spot orphan slugs in production.
 * - Empty/missing slug returns both fields null without warning — that's
 *   the legitimate "anonymous visitor" case.
 *
 * Returns the resolved fields ready to spread into the leads insert.
 */
export async function resolveAgentFromSlug(
  supabase: SupabaseClient,
  rawSlug: string | null | undefined,
  context: Record<string, unknown> = {}
): Promise<{ agent_id: string | null; agent_slug: string | null }> {
  if (typeof rawSlug !== "string") {
    return { agent_id: null, agent_slug: null };
  }
  const slug = rawSlug.trim();
  if (!slug) {
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
    extra: { slug, original_slug: rawSlug, ...context },
  });
  return { agent_id: null, agent_slug: slug };
}
