import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { isCarteraEnabled } from "@/lib/feature-flags";
import DashboardHeader from "../DashboardHeader";
import CarteraClient from "./CarteraClient";
import "../../agentes.css";

export default async function CarteraPage() {
  if (!isCarteraEnabled()) redirect("/agentes/dashboard");

  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db
    .from("agents")
    .select("id, name, agency_name")
    .eq("auth_user_id", user.id)
    .single();
  if (!agent) redirect("/agentes/dashboard");

  const [{ data: clients }, { data: imports }] = await Promise.all([
    db
      .from("portfolio_clients")
      .select(
        "id, full_name, estimated_age, date_of_birth, zip_code, county, household_members, current_carrier, metal_level, monthly_premium, monthly_subsidy, auto_renewal, phone, email, risk_score, risk_level, risk_reasons, score_confidence"
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

  return (
    <div style={{ fontFamily: "'Satoshi', -apple-system, sans-serif", minHeight: "100vh", background: "#08090d", color: "#f0f1f5" }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        <CarteraClient initialClients={clients || []} initialImports={imports || []} />
      </div>
    </div>
  );
}
