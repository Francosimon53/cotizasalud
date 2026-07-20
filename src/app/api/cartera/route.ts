import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";
import { isCarteraEnabled } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Portfolio for the authenticated agent, ordered by renewal risk. Used by the
// Mi Cartera view to refresh after an import; the page's first render queries
// the same tables server-side. Rows are always scoped to the session's
// agent_id — there is no way to request another agent's portfolio.
export async function GET() {
  if (!isCarteraEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent } = auth;

  const db = createServiceClient();

  try {
    const [clientsRes, importsRes] = await Promise.all([
      db
        .from("portfolio_clients")
        .select(
          "id, full_name, date_of_birth, estimated_age, zip_code, county, household_members, estimated_annual_income, current_carrier, metal_level, monthly_premium, monthly_subsidy, auto_renewal, phone, email, risk_score, risk_level, risk_reasons, score_confidence, created_at"
        )
        .eq("agent_id", agent.id)
        .order("risk_score", { ascending: false }),
      db
        .from("portfolio_imports")
        .select("id, file_name, total_rows, valid_rows, error_rows, created_at")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (clientsRes.error || importsRes.error) {
      const failed = clientsRes.error ?? importsRes.error;
      console.error("Cartera fetch error:", failed?.code, failed?.message);
      return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
    }

    return NextResponse.json({
      clients: clientsRes.data ?? [],
      imports: importsRes.data ?? [],
    });
  } catch (err) {
    console.error("Cartera API error:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
