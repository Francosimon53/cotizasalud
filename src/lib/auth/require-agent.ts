import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";

export interface AgentRow {
  id: string;
  slug: string;
  is_active: boolean;
}

export interface AuthenticatedAgent {
  agent: AgentRow;
  user: User;
}

/**
 * Resolve the authenticated agent from the session cookie.
 *
 * Returns a NextResponse on failure (401/403) that the caller should return
 * verbatim, or an AuthenticatedAgent on success. Discriminate with
 * `instanceof NextResponse` — works under strict:false where discriminated
 * union narrowing is unreliable.
 *
 * Mirrors the inline pattern used in /api/leads/import POST so that route
 * can migrate to this helper in a later cleanup PR without changing behavior.
 */
export async function requireAuthenticatedAgent(): Promise<NextResponse | AuthenticatedAgent> {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const db = createServiceClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, slug, is_active")
    .eq("auth_user_id", user.id)
    .single();

  if (!agent) {
    return NextResponse.json(
      { error: "No agent profile linked to this account" },
      { status: 403 }
    );
  }
  if (agent.is_active === false) {
    return NextResponse.json(
      { error: "Agent account is inactive" },
      { status: 403 }
    );
  }

  return { agent: agent as AgentRow, user };
}
