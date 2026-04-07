"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusModal from "../StatusModal";
import ActivityTimeline from "../ActivityTimeline";

const STATUSES = [
  { value: "new", label: "Nuevo", color: "#3b82f6" },
  { value: "contacted", label: "Contactado", color: "#f59e0b" },
  { value: "quoted", label: "Cotizado", color: "#f97316" },
  { value: "enrolled", label: "Inscrito", color: "#10b981" },
  { value: "lost", label: "Perdido", color: "#ef4444" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LeadDetailClient({ lead: initialLead, activity: initialActivity }: { lead: any; activity: any[] }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [activity, setActivity] = useState(initialActivity);
  const [modal, setModal] = useState<{ newStatus: string } | null>(null);
  const [note, setNote] = useState("");
  const [followupDate, setFollowupDate] = useState(lead.next_followup_date || "");
  const [savingNote, setSavingNote] = useState(false);

  const currentStatusCfg = STATUSES.find((s) => s.value === lead.status) || STATUSES[0];

  const handleStatusSaved = (leadId: string, newStatus: string) => {
    setLead((prev: any) => ({ ...prev, status: newStatus }));
    // Refresh activity
    fetch(`/api/leads/${lead.id}`).then((r) => r.json()).then((data) => {
      if (data.activity) setActivity(data.activity);
    });
  };

  const handleAddNote = async () => {
    if (!note.trim() && !followupDate) return;
    setSavingNote(true);
    const res = await fetch("/api/leads/note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        note: note.trim() || undefined,
        nextFollowupDate: followupDate || undefined,
      }),
    });
    if (res.ok) {
      setNote("");
      if (followupDate) setLead((prev: any) => ({ ...prev, next_followup_date: followupDate }));
      // Refresh activity
      const data = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
      if (data.activity) setActivity(data.activity);
    }
    setSavingNote(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 14,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 20,
  };

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d", color: "#f0f1f5",
    }}>
      {modal && (
        <StatusModal
          leadId={lead.id}
          leadName={lead.contact_name}
          currentStatus={lead.status}
          newStatus={modal.newStatus}
          onClose={() => setModal(null)}
          onSaved={handleStatusSaved}
        />
      )}

      {/* Header */}
      <header style={{
        background: "rgba(8,9,13,0.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <button onClick={() => router.push("/agentes/dashboard")} style={{
          padding: "6px 14px", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
          color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>← Dashboard</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#f0f1f5" }}>{lead.contact_name}</span>
          <span style={{
            marginLeft: 10, padding: "2px 10px", borderRadius: 20,
            fontSize: 11, fontWeight: 700, color: currentStatusCfg.color,
            background: `${currentStatusCfg.color}18`,
          }}>{currentStatusCfg.label}</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Lead Info */}
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Contacto</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{lead.contact_name}</div>
              <a href={`tel:${lead.contact_phone}`} style={{ color: "#10b981", fontSize: 14, textDecoration: "none", display: "block", marginTop: 4 }}>{lead.contact_phone}</a>
              {lead.contact_email && <div style={{ fontSize: 13, color: "#8b8fa3", marginTop: 2 }}>{lead.contact_email}</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Ubicación</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{lead.county}, {lead.state}</div>
              <div style={{ fontSize: 13, color: "#8b8fa3", marginTop: 2 }}>ZIP: {lead.zipcode}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Financiero</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>${Number(lead.annual_income).toLocaleString()}/año</div>
              <div style={{ fontSize: 13, color: "#8b8fa3", marginTop: 2 }}>{lead.fpl_percentage}% FPL · {lead.household_size} miembros</div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 20, paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div><span style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700 }}>CREADO</span><div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{formatDate(lead.created_at)}</div></div>
            {lead.contacted_at && <div><span style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700 }}>CONTACTADO</span><div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{formatDate(lead.contacted_at)}</div></div>}
            {lead.quoted_at && <div><span style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700 }}>COTIZADO</span><div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{formatDate(lead.quoted_at)}</div></div>}
            {lead.enrolled_at && <div><span style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700 }}>INSCRITO</span><div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 2 }}>{formatDate(lead.enrolled_at)}</div></div>}
            {lead.next_followup_date && <div><span style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700 }}>SEGUIMIENTO</span><div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 2 }}>{lead.next_followup_date}</div></div>}
          </div>
        </div>

        {/* Status Actions */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Cambiar Estado</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUSES.filter((s) => s.value !== lead.status).map((s) => (
              <button
                key={s.value}
                onClick={() => setModal({ newStatus: s.value })}
                style={{
                  padding: "8px 18px", borderRadius: 8,
                  border: `1px solid ${s.color}40`, background: `${s.color}10`,
                  color: s.color, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                → {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Add Note / Follow-up */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Agregar Nota</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Escribe una nota..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }}
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#5a5e72", fontWeight: 700 }}>Seguimiento:</label>
              <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </div>
            <button
              onClick={handleAddNote}
              disabled={savingNote || (!note.trim() && !followupDate)}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: savingNote ? "rgba(255,255,255,0.1)" : "#10b981",
                color: savingNote ? "#5a5e72" : "#000",
                fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                alignSelf: "flex-end",
              }}
            >{savingNote ? "..." : "Guardar"}</button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Actividad</div>
          <ActivityTimeline activity={activity} />
        </div>
      </div>
    </div>
  );
}
