"use client";

interface Activity {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  lost_reason: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  new: "Nuevo", contacted: "Contactado", quoted: "Cotizado",
  enrolled: "Inscrito", lost: "Perdido",
};

const actionLabels: Record<string, { icon: string; label: string }> = {
  status_change: { icon: "🔄", label: "Cambio de estado" },
  note_added: { icon: "📝", label: "Nota agregada" },
  followup_set: { icon: "📅", label: "Seguimiento programado" },
  email_sent: { icon: "📧", label: "Email enviado" },
};

const lostReasonLabels: Record<string, string> = {
  too_expensive: "Muy caro",
  another_plan: "Eligió otro plan",
  got_medicaid: "Obtuvo Medicaid",
  no_response: "Sin respuesta",
  other: "Otro",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" });
}

export default function ActivityTimeline({ activity }: { activity: Activity[] }) {
  if (activity.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "#5a5e72", fontSize: 13 }}>
        Sin actividad registrada
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 24 }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute", left: 7, top: 8, bottom: 8, width: 2,
        background: "rgba(255,255,255,0.06)",
      }} />

      {activity.map((a) => {
        const cfg = actionLabels[a.action] || { icon: "•", label: a.action };
        return (
          <div key={a.id} style={{ position: "relative", marginBottom: 20 }}>
            {/* Dot */}
            <div style={{
              position: "absolute", left: -20, top: 4,
              width: 14, height: 14, borderRadius: 7,
              background: "#12141c",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 8,
            }}>{cfg.icon}</div>

            {/* Content */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b8fa3" }}>
                {cfg.label}
                {a.action === "status_change" && a.from_status && a.to_status && (
                  <span style={{ fontWeight: 600, color: "#5a5e72" }}>
                    {" "}— {statusLabels[a.from_status] || a.from_status} → {statusLabels[a.to_status] || a.to_status}
                  </span>
                )}
              </div>
              {a.note && (
                <div style={{ fontSize: 13, color: "#f0f1f5", marginTop: 4, lineHeight: 1.5 }}>
                  {a.note}
                </div>
              )}
              {a.lost_reason && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 2 }}>
                  Razón: {lostReasonLabels[a.lost_reason] || a.lost_reason}
                </div>
              )}
              <div style={{ fontSize: 11, color: "#3a3d4a", marginTop: 4 }}>
                {formatDateTime(a.created_at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
