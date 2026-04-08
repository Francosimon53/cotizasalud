"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AgentStat {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  npn: string | null;
  agency_name: string | null;
  is_active: boolean;
  created_at: string;
  onboarding_complete: boolean | null;
  totalLeads: number;
  enrolled: number;
  conversionRate: number;
  revenue: number;
}

export default function TeamClient({ agents, totalLeads, totalEnrolled, totalRevenue }: {
  agents: AgentStat[];
  totalLeads: number;
  totalEnrolled: number;
  totalRevenue: number;
}) {
  const router = useRouter();
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (agentId: string, currentActive: boolean) => {
    setToggling(agentId);
    await fetch("/api/admin/toggle-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, isActive: !currentActive }),
    });
    router.refresh();
    setToggling(null);
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 12, padding: "16px 14px",
    border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
  };

  return (
    <>
      <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>

      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Equipo EnrollSalud</h1>
      <p style={{ fontSize: 14, color: "#5a5e72", marginBottom: 20 }}>{agents.length} agentes registrados</p>

      {/* Platform Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}><div style={{ fontSize: 28, fontWeight: 900, color: "#f0f1f5" }}>{totalLeads}</div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase" }}>Total Leads</div></div>
        <div style={cardStyle}><div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{totalEnrolled}</div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase" }}>Inscritos</div></div>
        <div style={cardStyle}><div style={{ fontSize: 28, fontWeight: 900, color: "#8b5cf6" }}>{totalLeads > 0 ? Math.round((totalEnrolled / totalLeads) * 100) : 0}%</div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase" }}>Conversión</div></div>
        <div style={cardStyle}><div style={{ fontSize: 28, fontWeight: 900, color: "#f59e0b" }}>${totalRevenue.toLocaleString()}</div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase" }}>Ingreso/mes</div></div>
      </div>

      {/* Agent Table */}
      <div style={{ background: "#12141c", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 15, fontWeight: 800 }}>Agentes</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Agente", "NPN", "Leads", "Inscritos", "Conv.", "Ingreso", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 14px", fontSize: 10, fontWeight: 700, color: "#5a5e72", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#f0f1f5" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "#5a5e72" }}>{a.email} · /{a.slug}</div>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#8b8fa3", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{a.npn || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800, color: "#f0f1f5", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{a.totalLeads}</td>
                  <td style={{ padding: "12px 14px", fontSize: 14, fontWeight: 800, color: "#10b981", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{a.enrolled}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#8b5cf6", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{a.conversionRate}%</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#f59e0b", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>${a.revenue}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800, color: a.is_active ? "#10b981" : "#ef4444", background: a.is_active ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)" }}>
                      {a.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <button
                      onClick={() => handleToggle(a.id, a.is_active)}
                      disabled={toggling === a.id}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >{toggling === a.id ? "..." : a.is_active ? "Desactivar" : "Activar"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
