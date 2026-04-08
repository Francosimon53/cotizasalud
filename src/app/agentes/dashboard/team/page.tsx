import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import DashboardHeader from "../DashboardHeader";
import TeamClient from "./TeamClient";
import "../../agentes.css";

const ADMIN_SLUGS = ["simon-dev", "delbert"];

export default async function TeamPage() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug, name, agency_name").eq("auth_user_id", user.id).single();
  if (!agent || !ADMIN_SLUGS.includes(agent.slug)) redirect("/agentes/dashboard");

  // Get all agents
  const { data: agents } = await db
    .from("agents")
    .select("id, slug, name, email, npn, agency_name, is_active, created_at, onboarding_complete")
    .order("created_at", { ascending: false });

  // Get lead counts per agent
  const { data: allLeads } = await db
    .from("leads")
    .select("agent_slug, status, household_size");

  const agentStats = (agents || []).map((a) => {
    const leads = (allLeads || []).filter((l) => l.agent_slug === a.slug);
    const enrolled = leads.filter((l) => l.status === "enrolled");
    const totalMembers = enrolled.reduce((sum, l) => sum + (l.household_size || 1), 0);
    return {
      ...a,
      totalLeads: leads.length,
      enrolled: enrolled.length,
      conversionRate: leads.length > 0 ? Math.round((enrolled.length / leads.length) * 100) : 0,
      revenue: totalMembers * 20,
    };
  });

  // Platform totals
  const totalLeads = (allLeads || []).length;
  const totalEnrolled = (allLeads || []).filter((l) => l.status === "enrolled").length;
  const totalMembers = (allLeads || []).filter((l) => l.status === "enrolled").reduce((sum, l) => sum + (l.household_size || 1), 0);

  return (
    <div style={{ fontFamily: "'Satoshi', -apple-system, sans-serif", minHeight: "100vh", background: "#08090d", color: "#f0f1f5" }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px" }}>
        <TeamClient
          agents={agentStats}
          totalLeads={totalLeads}
          totalEnrolled={totalEnrolled}
          totalRevenue={totalMembers * 20}
        />
      </div>
    </div>
  );
}
