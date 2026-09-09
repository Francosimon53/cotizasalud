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
  const [announcementState, setAnnouncementState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [announcementResult, setAnnouncementResult] = useState<string>("");

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

  const sendStoryFirstAnnouncement = async () => {
    setAnnouncementState("sending");
    setAnnouncementResult("");
    const response = await fetch("/api/admin/announce-story-first", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setAnnouncementState("error");
      setAnnouncementResult(body.error || "No se pudo enviar");
      return;
    }
    setAnnouncementState("sent");
    setAnnouncementResult(`${body.sent} agentes recibieron la activación.`);
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

      <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.22)", borderRadius: 12, padding: "14px 16px", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#d1fae5" }}>Activación story-first</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>Envía una sola invitación por Resend a los agentes operativos.</div>
          {announcementResult && <div style={{ fontSize: 12, color: announcementState === "error" ? "#fca5a5" : "#6ee7b7", marginTop: 6 }}>{announcementResult}</div>}
        </div>
        <button onClick={sendStoryFirstAnnouncement} disabled={announcementState === "sending" || announcementState === "sent"} style={{ flexShrink: 0, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.35)", background: announcementState === "sent" ? "rgba(16,185,129,0.18)" : "#059669", color: "#fff", fontSize: 12, fontWeight: 800, cursor: announcementState === "sent" ? "default" : "pointer", fontFamily: "inherit" }}>
          {announcementState === "sending" ? "Enviando..." : announcementState === "sent" ? "Enviado" : "Enviar activación"}
        </button>
      </div>

      {/* Platform Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}><div style={{ fontSize: 28, fontWeight: 900, color: "#f0f1f5" }}>{totalLeads}</div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase" }}>Total Contactos</div></div>
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
                {["Agente", "NPN", "Contactos", "Inscritos", "Conv.", "Ingreso", "Estado", ""].map((h) => (
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
