"use client";

import { useRouter } from "next/navigation";

interface Lead {
  id: string;
  contact_name: string;
  contact_phone: string;
  selected_plan_name: string | null;
  renewal_date: string;
  status: string;
}

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function getUrgency(days: number): { color: string; bg: string; label: string } {
  if (days <= 15) return { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Urgente" };
  if (days <= 30) return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Pronto" };
  if (days <= 60) return { color: "#f97316", bg: "rgba(249,115,22,0.1)", label: "Próximo" };
  return { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "OK" };
}

export default function RenewalsClient({ leads }: { leads: Lead[] }) {
  const router = useRouter();

  return (
    <>
      <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>

      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Renovaciones</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 24 }}>{leads.length} clientes con fecha de renovación</p>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Próx. 15 días", count: leads.filter((l) => daysUntil(l.renewal_date) <= 15 && daysUntil(l.renewal_date) > 0).length, color: "#ef4444" },
          { label: "Próx. 30 días", count: leads.filter((l) => daysUntil(l.renewal_date) <= 30 && daysUntil(l.renewal_date) > 15).length, color: "#f59e0b" },
          { label: "Próx. 60 días", count: leads.filter((l) => daysUntil(l.renewal_date) <= 60 && daysUntil(l.renewal_date) > 30).length, color: "#f97316" },
          { label: "60+ días", count: leads.filter((l) => daysUntil(l.renewal_date) > 60).length, color: "#10b981" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#12141c", borderRadius: 12, padding: "14px 12px", border: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ background: "#12141c", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        {leads.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#5a5e72" }}>Sin renovaciones programadas. Importa clientes desde HealthSherpa para ver renovaciones.</div>
        ) : (
          leads.map((lead) => {
            const days = daysUntil(lead.renewal_date);
            const urgency = getUrgency(days);
            return (
              <div key={lead.id} onClick={() => router.push(`/agentes/dashboard/${lead.id}`)} style={{
                padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
                borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer",
                borderLeft: `3px solid ${urgency.color}`,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f1f5" }}>{lead.contact_name}</div>
                  <div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{lead.selected_plan_name || "Plan no especificado"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: urgency.color }}>{days > 0 ? `${days} días` : "Vencido"}</div>
                  <div style={{ fontSize: 11, color: "#5a5e72" }}>{lead.renewal_date}</div>
                </div>
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, color: urgency.color, background: urgency.bg }}>{urgency.label}</span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
