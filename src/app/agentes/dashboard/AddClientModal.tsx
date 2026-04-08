"use client";

import { useState } from "react";

interface Props {
  agentSlug: string;
  onClose: () => void;
  onSaved: () => void;
}

interface QuickRow {
  firstName: string;
  lastName: string;
  phone: string;
  plan: string;
  date: string;
}

export default function AddClientModal({ agentSlug, onClose, onSaved }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Single mode
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [plan, setPlan] = useState("");
  const [premium, setPremium] = useState("");
  const [enrollDate, setEnrollDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Bulk mode
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<QuickRow[]>([]);
  const [bulkResults, setBulkResults] = useState<{ imported: number; errors: number } | null>(null);

  const singleValid = firstName.trim() && lastName.trim() && phone.trim().replace(/\D/g, "").length >= 10 && email.trim() && zipcode.trim();

  const handleSaveSingle = async () => {
    if (!singleValid) { setError("Completa todos los campos requeridos"); return; }
    setError("");
    setSaving(true);

    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          phone: phone.trim(),
          email: email.trim(),
          planName: plan.trim() || undefined,
          premium: premium || undefined,
          effectiveDate: enrollDate || undefined,
          agentSlug,
          status: enrollDate ? "Active" : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Add note if provided
        if (notes.trim() && data.leadId) {
          await fetch("/api/leads/note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: data.leadId, note: notes.trim() }),
          });
        }
        setSuccess(true);
        setTimeout(() => { onSaved(); onClose(); }, 800);
      } else {
        setError(data.error || "Error al guardar");
      }
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  };

  const parseBulk = () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows: QuickRow[] = [];
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 3) {
        rows.push({
          firstName: parts[0] || "",
          lastName: parts[1] || "",
          phone: parts[2] || "",
          plan: parts[3] || "",
          date: parts[4] || "",
        });
      }
    }
    setBulkRows(rows);
  };

  const handleSaveBulk = async () => {
    setSaving(true);
    let imported = 0, errors = 0;
    for (const row of bulkRows) {
      try {
        const res = await fetch("/api/leads/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${row.firstName} ${row.lastName}`.trim(),
            phone: row.phone,
            planName: row.plan || undefined,
            effectiveDate: row.date || undefined,
            agentSlug,
            status: row.date ? "Active" : undefined,
          }),
        });
        const data = await res.json();
        if (data.success) imported++; else errors++;
      } catch { errors++; }
    }
    setBulkResults({ imported, errors });
    setSaving(false);
    if (imported > 0) setTimeout(() => { onSaved(); onClose(); }, 1500);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 14,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#e0e1e5",
    textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4,
  };
  const reqStar = <span style={{ color: "#ef4444" }}>*</span>;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#12141c", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.1)", width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#f0f1f5", margin: 0 }}>Agregar Cliente</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#5a5e72", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
          <button onClick={() => setMode("single")} style={{ flex: 1, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "single" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: mode === "single" ? "#10b981" : "#5a5e72" }}>Un cliente</button>
          <button onClick={() => setMode("bulk")} style={{ flex: 1, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit", background: mode === "bulk" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", color: mode === "bulk" ? "#10b981" : "#5a5e72" }}>Quick Paste</button>
        </div>

        {error && <div role="alert" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#ef4444" }}>{error}</div>}
        {success && <div style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 13, color: "#10b981" }}>Cliente agregado</div>}

        {mode === "single" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Nombre {reqStar}</label><input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="María" /></div>
              <div><label style={labelStyle}>Apellido {reqStar}</label><input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="López" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Teléfono {reqStar}</label><input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(239) 555-1234" /></div>
              <div><label style={labelStyle}>Email {reqStar}</label><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@email.com" /></div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>ZIP {reqStar}</label><input style={inputStyle} value={zipcode} onChange={(e) => setZipcode(e.target.value.replace(/\D/g, ""))} maxLength={5} placeholder="33914" /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div><label style={labelStyle}>Plan actual</label><input style={inputStyle} value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Ambetter Gold" /></div>
              <div><label style={labelStyle}>Prima mensual</label><input style={inputStyle} type="number" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="85" /></div>
            </div>
            <div style={{ marginBottom: 10 }}><label style={labelStyle}>Fecha de enrollment</label><input style={inputStyle} type="date" value={enrollDate} onChange={(e) => setEnrollDate(e.target.value)} /></div>
            <div style={{ marginBottom: 16 }}><label style={labelStyle}>Notas</label><textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas sobre el cliente..." /></div>
            <button onClick={handleSaveSingle} disabled={saving || !singleValid} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 900, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", background: saving || !singleValid ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #059669)", color: saving || !singleValid ? "#5a5e72" : "#fff" }}>
              {saving ? "Guardando..." : "Guardar Cliente"}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Pega clientes (uno por línea)</label>
              <div style={{ fontSize: 11, color: "#5a5e72", marginBottom: 6 }}>Formato: Nombre, Apellido, Teléfono, Plan, Fecha</div>
              <textarea style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} rows={6} value={bulkText} onChange={(e) => { setBulkText(e.target.value); setBulkRows([]); setBulkResults(null); }} placeholder="María, López, 2395551234, Ambetter Gold, 2025-06-01&#10;Juan, Pérez, 3055559876, Molina Silver, 2025-01-15" />
            </div>
            {bulkRows.length === 0 && bulkText.trim() && (
              <button onClick={parseBulk} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>Vista Previa</button>
            )}
            {bulkRows.length > 0 && !bulkResults && (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e1e5", marginBottom: 8 }}>{bulkRows.length} clientes detectados:</div>
                <div style={{ maxHeight: 150, overflowY: "auto", marginBottom: 12 }}>
                  {bulkRows.map((r, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#8b8fa3", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {r.firstName} {r.lastName} · {r.phone} {r.plan && `· ${r.plan}`} {r.date && `· ${r.date}`}
                    </div>
                  ))}
                </div>
                <button onClick={handleSaveBulk} disabled={saving} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 900, cursor: saving ? "wait" : "pointer", fontFamily: "inherit", background: saving ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #059669)", color: saving ? "#5a5e72" : "#fff" }}>
                  {saving ? "Importando..." : `Importar ${bulkRows.length} Clientes`}
                </button>
              </>
            )}
            {bulkResults && (
              <div style={{ textAlign: "center", padding: 16 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#10b981" }}>{bulkResults.imported}</div>
                <div style={{ fontSize: 12, color: "#5a5e72" }}>clientes importados</div>
                {bulkResults.errors > 0 && <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{bulkResults.errors} errores</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
