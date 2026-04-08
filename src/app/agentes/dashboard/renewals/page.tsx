import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import DashboardHeader from "../DashboardHeader";
import RenewalsClient from "./RenewalsClient";
import "../../agentes.css";

export default async function RenewalsPage() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug, name, agency_name").eq("auth_user_id", user.id).single();
  if (!agent) redirect("/agentes/dashboard");

  // Get all leads with renewal dates
  const { data: leads } = await db
    .from("leads")
    .select("id, contact_name, contact_phone, selected_plan_name, renewal_date, status, agent_slug")
    .eq("agent_slug", agent.slug)
    .not("renewal_date", "is", null)
    .order("renewal_date", { ascending: true });

  return (
    <div style={{ fontFamily: "'Satoshi', -apple-system, sans-serif", minHeight: "100vh", background: "#08090d", color: "#f0f1f5" }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
        <RenewalsClient leads={leads || []} />
      </div>
    </div>
  );
}
