import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { SUBSCRIPTION_PLANS, TRIAL_DAYS } from "@/lib/subscription-plans";
import DashboardHeader from "../DashboardHeader";
import ProfileForm from "./ProfileForm";
import "../../agentes.css";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  let { data: agent } = await db
    .from("agents")
    .select("slug, name, email, phone, npn, agency_name, brand_color, logo_url")
    .eq("auth_user_id", user.id)
    .single();

  // Auto-create agent record if missing
  if (!agent) {
    const slug = user.email?.split("@")[0]?.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `agent-${Date.now()}`;
    const trialEndDate = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await db.from("agents").insert({
      auth_user_id: user.id,
      name: user.email?.split("@")[0] || "Nuevo Agente",
      slug,
      email: user.email,
      is_active: true,
      subscription_plan: "trial",
      subscription_status: "trialing",
      leads_limit_monthly: SUBSCRIPTION_PLANS.trial.leads_limit,
      trial_end_date: trialEndDate,
    });
    const { data: newAgent } = await db.from("agents")
      .select("slug, name, email, phone, npn, agency_name, brand_color, logo_url")
      .eq("auth_user_id", user.id).single();
    agent = newAgent;
    if (!agent) redirect("/agentes/login");
  }

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d", color: "#f0f1f5",
    }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} />
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px 60px" }}>
        <ProfileForm agent={agent} />
      </div>
    </div>
  );
}
