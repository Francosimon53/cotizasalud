"use client";

import { useState } from "react";

const LOST_REASONS = [
  { value: "too_expensive", label: "Muy caro" },
  { value: "another_plan", label: "Eligió otro plan" },
  { value: "got_medicaid", label: "Obtuvo Medicaid" },
  { value: "no_response", label: "Sin respuesta" },
  { value: "other", label: "Otro" },
];

interface Props {
  leadId: string;
  leadName: string;
  currentStatus: string;
  newStatus: string;
  onClose: () => void;
  onSaved: (leadId: string, status: string) => void;
}

export default function StatusModal({ leadId, leadName, currentStatus, newStatus, onClose, onSaved }: Props) {
  const [note, setNote] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isLost = newStatus === "lost";
  const statusLabels: Record<string, string> = {
    new: "Nuevo", contacted: "Contactado", quoted: "Cotizado", enrolled: "Inscrito", lost: "Perdido",
  };

  const handleSubmit = async () => {
    if (!note.trim()) { setError("La nota es requerida"); return; }
    if (isLost && !lostReason) { setError("Selecciona una razón"); return; }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          status: newStatus,
          note: note.trim(),
          lostReason: isLost ? lostReason : undefined,
          nextFollowupDate: followupDate || undefined,
        }),
      });
      if (res.ok) {
        onSaved(leadId, newStatus);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 14,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#12141c", borderRadius: 16, padding: 28,
        border: "1px solid rgba(255,255,255,0.1)",
        width: "100%", maxWidth: 480,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#f0f1f5", margin: "0 0 4px" }}>
          Cambiar Estado
        </h2>
        <p style={{ fontSize: 13, color: "#5a5e72", margin: "0 0 20px" }}>
          {leadName}: {statusLabels[currentStatus]} → <strong style={{ color: "#f0f1f5" }}>{statusLabels[newStatus]}</strong>
        </p>

        {error && (
          <div role="alert" style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 14,
            fontSize: 13, color: "#ef4444",
          }}>{error}</div>
        )}

        {/* Note */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Nota *
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={newStatus === "contacted" ? "Ej: Dejé mensaje de voz..." : newStatus === "quoted" ? "Ej: Envié cotización plan Gold..." : newStatus === "enrolled" ? "Ej: Inscrito via healthcare.gov..." : "Describe la acción..."}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
            autoFocus
          />
        </div>

        {/* Lost reason */}
        {isLost && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Razón *
            </label>
            <select
              value={lostReason}
              onChange={(e) => setLostReason(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              <option value="">Seleccionar razón...</option>
              {LOST_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Follow-up date (optional) */}
        {newStatus !== "enrolled" && newStatus !== "lost" && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Próximo seguimiento (opcional)
            </label>
            <input
              type="date"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 20px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.1)", background: "#181a24",
            color: "#8b8fa3", fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            flex: 2, padding: "12px 20px", borderRadius: 10,
            border: "none", fontSize: 14, fontWeight: 800,
            cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
            background: saving ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
            color: saving ? "#5a5e72" : "#000",
          }}>{saving ? "Guardando..." : "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}
