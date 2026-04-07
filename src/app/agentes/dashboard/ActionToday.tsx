"use client";

interface Lead {
  id: string;
  contact_name: string;
  contact_phone: string;
  status: string;
  created_at: string;
  contacted_at: string | null;
  quoted_at: string | null;
  next_followup_date: string | null;
}

interface Props {
  leads: Lead[];
  onLeadClick: (id: string) => void;
}

function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function ActionToday({ leads, onLeadClick }: Props) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const urgent = leads.filter((l) => {
    if (l.status !== "new") return false;
    return (now.getTime() - new Date(l.created_at).getTime()) > 60 * 60 * 1000;
  });

  const stale = leads.filter((l) => {
    if (l.status !== "contacted" || !l.contacted_at) return false;
    return (now.getTime() - new Date(l.contacted_at).getTime()) > 48 * 60 * 60 * 1000;
  });

  const atRisk = leads.filter((l) => {
    if (l.status !== "quoted" || !l.quoted_at) return false;
    return (now.getTime() - new Date(l.quoted_at).getTime()) > 5 * 24 * 60 * 60 * 1000;
  });

  const followups = leads.filter((l) =>
    l.next_followup_date && l.next_followup_date <= today && l.status !== "enrolled" && l.status !== "lost"
  );

  const total = urgent.length + stale.length + atRisk.length + followups.length;
  if (total === 0) return null;

  const sections = [
    { items: urgent, label: "Urgente — sin contactar >1h", color: "#ef4444", bg: "rgba(239,68,68,0.08)", icon: "🔴" },
    { items: followups, label: "Seguimiento hoy", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)", icon: "📅" },
    { items: stale, label: "Estancado — sin cotización >48h", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", icon: "🟡" },
    { items: atRisk, label: "En riesgo — sin inscripción >5d", color: "#f97316", bg: "rgba(249,115,22,0.08)", icon: "🟠" },
  ].filter((s) => s.items.length > 0);

  return (
    <div style={{
      background: "#12141c", borderRadius: 16,
      border: "1px solid rgba(239,68,68,0.2)",
      marginBottom: 20, overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#f0f1f5" }}>
          Acción Hoy
        </span>
        <span style={{
          padding: "2px 10px", borderRadius: 20,
          fontSize: 12, fontWeight: 800,
          color: "#ef4444", background: "rgba(239,68,68,0.15)",
        }}>{total}</span>
      </div>

      {sections.map((section) => (
        <div key={section.label}>
          <div style={{
            padding: "8px 20px", fontSize: 11, fontWeight: 700,
            color: section.color, textTransform: "uppercase", letterSpacing: 0.5,
            background: section.bg,
          }}>
            {section.icon} {section.label} ({section.items.length})
          </div>
          {section.items.map((lead) => (
            <div
              key={lead.id}
              onClick={() => onLeadClick(lead.id)}
              style={{
                padding: "10px 20px",
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f1f5", flex: 1 }}>
                {lead.contact_name}
              </span>
              <a href={`tel:${lead.contact_phone}`} onClick={(e) => e.stopPropagation()} style={{
                fontSize: 13, color: "#10b981", textDecoration: "none",
              }}>{lead.contact_phone}</a>
              <span style={{ fontSize: 11, color: "#5a5e72" }}>
                hace {timeAgo(new Date(lead.created_at))}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
