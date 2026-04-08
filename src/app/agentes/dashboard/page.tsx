import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import LeadsTable from "./LeadsTable";
import DashboardHeader from "./DashboardHeader";
import ActionToday from "./ActionToday";
import DashboardClient from "./DashboardClient";
import ShareCard from "./ShareCard";
import "../agentes.css";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  let { data: agent } = await db.from("agents").select("*").eq("auth_user_id", user.id).single();

  // Auto-create agent record if authenticated user doesn't have one
  if (!agent) {
    const slug = user.email?.split("@")[0]?.replace(/[^a-z0-9-]/gi, "-").toLowerCase() || `agent-${Date.now()}`;
    const { data: slugExists } = await db.from("agents").select("id").eq("slug", slug).single();
    const finalSlug = slugExists ? `${slug}-${Math.random().toString(36).slice(2, 6)}` : slug;
    await db.from("agents").insert({
      auth_user_id: user.id,
      name: user.email?.split("@")[0] || "Nuevo Agente",
      slug: finalSlug,
      email: user.email,
      is_active: true,
      subscription_plan: "trial",
      subscription_status: "active",
    });
    const { data: newAgent } = await db.from("agents").select("*").eq("auth_user_id", user.id).single();
    agent = newAgent;
    if (!agent) redirect("/agentes/login"); // Truly broken — bail out
  }

  // Redirect to profile if incomplete
  if (!agent.npn || !agent.email || !agent.phone || !agent.agency_name) {
    redirect("/agentes/dashboard/profile");
  }

  const { data: leads } = await db
    .from("leads")
    .select("*")
    .eq("agent_slug", agent.slug)
    .order("created_at", { ascending: false });

  const allLeads = leads || [];

  // Pipeline
  const pipeline = {
    browsing: allLeads.filter((l) => l.status === "browsing").length,
    new: allLeads.filter((l) => l.status === "new").length,
    contacted: allLeads.filter((l) => l.status === "contacted").length,
    quoted: allLeads.filter((l) => l.status === "quoted").length,
    enrolled: allLeads.filter((l) => l.status === "enrolled").length,
    lost: allLeads.filter((l) => l.status === "lost").length,
  };

  // KPIs
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const monthAgo = new Date(now.getTime() - 30 * 86400000);
  const thisWeek = allLeads.filter((l) => new Date(l.created_at) >= weekAgo).length;
  const thisMonth = allLeads.filter((l) => new Date(l.created_at) >= monthAgo).length;
  const conversionRate = allLeads.length > 0 ? Math.round((pipeline.enrolled / allLeads.length) * 100) : 0;

  // Avg time to enroll
  const enrolledLeads = allLeads.filter((l) => l.enrolled_at);
  let avgDaysToEnroll = 0;
  if (enrolledLeads.length > 0) {
    const totalDays = enrolledLeads.reduce((sum, l) => {
      return sum + (new Date(l.enrolled_at).getTime() - new Date(l.created_at).getTime()) / 86400000;
    }, 0);
    avgDaysToEnroll = Math.round(totalDays / enrolledLeads.length);
  }

  // Revenue estimate: enrolled × avg household size × $20/mo
  const enrolledWithHousehold = allLeads.filter((l) => l.status === "enrolled" && l.household_size);
  const totalMembers = enrolledWithHousehold.reduce((sum, l) => sum + (l.household_size || 1), 0);
  const monthlyRevenue = totalMembers * 20;

  // Action today count
  const today = now.toISOString().split("T")[0];
  const urgentCount = allLeads.filter((l) => l.status === "new" && (now.getTime() - new Date(l.created_at).getTime()) > 3600000).length;
  const staleCount = allLeads.filter((l) => l.status === "contacted" && l.contacted_at && (now.getTime() - new Date(l.contacted_at).getTime()) > 172800000).length;
  const followupCount = allLeads.filter((l) => l.next_followup_date && l.next_followup_date <= today && l.status !== "enrolled" && l.status !== "lost").length;
  const actionCount = urgentCount + staleCount + followupCount;

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d", color: "#f0f1f5",
    }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} isAdmin={["simon-dev", "delbert"].includes(agent.slug)} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Agent Profile */}
        <div style={{
          background: "#12141c", borderRadius: 16, padding: 24,
          border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#5a5e72", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>Agente</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f1f5", marginTop: 4 }}>{agent.name}</div>
            {agent.agency_name && <div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{agent.agency_name}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#5a5e72", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>NPN</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#f0f1f5", marginTop: 4 }}>{agent.npn || "—"}</div>
            <div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{agent.email}</div>
          </div>
          <ShareCard slug={agent.slug} />
        </div>

        {/* KPI Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total", value: allLeads.length, color: "#f0f1f5" },
            { label: "Semana", value: thisWeek, color: "#06b6d4" },
            { label: "Mes", value: thisMonth, color: "#8b5cf6" },
            { label: "Conversión", value: `${conversionRate}%`, color: "#10b981" },
            { label: "Días promedio", value: avgDaysToEnroll || "—", color: "#f59e0b" },
            { label: "Ingreso/mes", value: `$${monthlyRevenue.toLocaleString()}`, color: "#10b981" },
            { label: "Acción hoy", value: actionCount, color: actionCount > 0 ? "#ef4444" : "#5a5e72" },
          ].map((kpi) => (
            <div key={kpi.label} style={{
              background: "#12141c", borderRadius: 12, padding: "14px 10px",
              border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
            }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: kpi.color, letterSpacing: -0.5 }}>{kpi.value}</div>
              <div style={{ fontSize: 9, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Pipeline Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Visitantes", value: pipeline.browsing, color: "#6b7280" },
            { label: "Nuevos", value: pipeline.new, color: "#3b82f6" },
            { label: "Contactados", value: pipeline.contacted, color: "#f59e0b" },
            { label: "Cotizados", value: pipeline.quoted, color: "#f97316" },
            { label: "Inscritos", value: pipeline.enrolled, color: "#10b981" },
            { label: "Perdidos", value: pipeline.lost, color: "#ef4444" },
          ].map((p) => (
            <div key={p.label} style={{
              background: "#12141c", borderRadius: 10, padding: "12px 10px",
              border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
              borderTop: `3px solid ${p.color}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: p.color }}>{p.value}</div>
              <div style={{ fontSize: 9, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{p.label}</div>
            </div>
          ))}
        </div>

        <DashboardClient leads={allLeads} />

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "32px 0 0", display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/privacy" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Privacidad</a>
          <a href="/terms" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Términos</a>
          <a href="/compliance" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Cumplimiento</a>
          <a href="/ai-disclaimer" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Aviso IA</a>
          <a href="mailto:info@enrollsalud.com" style={{ fontSize: 10, color: "#3a3d4a", textDecoration: "none" }}>Contacto</a>
        </div>
      </div>
    </div>
  );
}
