"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  slug: string;
  name: string;
  email: string | null;
  phone: string | null;
  npn: string | null;
  agency_name: string | null;
  brand_color: string | null;
  logo_url: string | null;
}

export default function ProfileForm({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [npn, setNpn] = useState(agent.npn || "");
  const [email, setEmail] = useState(agent.email || "");
  const [phone, setPhone] = useState(agent.phone || "");
  const [agencyName, setAgencyName] = useState(agent.agency_name || "");
  const [brandColor, setBrandColor] = useState(agent.brand_color || "#10b981");
  const [logoUrl, setLogoUrl] = useState(agent.logo_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const isComplete = npn.trim() && email.trim() && phone.trim() && agencyName.trim();

  const handleSave = async () => {
    if (!isComplete) { setError("Completa todos los campos requeridos"); return; }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/agents/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npn: npn.trim(),
          email: email.trim(),
          phone: phone.trim(),
          agency_name: agencyName.trim(),
          brand_color: brandColor,
          logo_url: logoUrl.trim() || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => router.push("/agentes/dashboard"), 800);
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
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15,
    background: "#0e1018", color: "#f0f1f5", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#8b8fa3",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  };
  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 28,
    border: "1px solid rgba(255,255,255,0.06)",
  };

  return (
    <>
      <button onClick={() => router.push("/agentes/dashboard")} style={{
        padding: "6px 14px", borderRadius: 8, marginBottom: 20,
        border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
        color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
      }}>← Dashboard</button>

      <div style={cardStyle}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px" }}>Mi Perfil</h1>
        <p style={{ fontSize: 13, color: "#5a5e72", margin: "0 0 24px" }}>
          Completa tu información para activar tu cuenta de agente
        </p>

        {error && (
          <div role="alert" style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#ef4444",
          }}>{error}</div>
        )}

        {saved && (
          <div style={{
            background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#10b981",
          }}>Perfil guardado. Redirigiendo...</div>
        )}

        {/* Required fields */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>
          Información requerida
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label htmlFor="prof-npn" style={labelStyle}>NPN *</label>
            <input id="prof-npn" style={inputStyle} value={npn} onChange={(e) => setNpn(e.target.value)} placeholder="12345678" />
          </div>
          <div>
            <label htmlFor="prof-phone" style={labelStyle}>Teléfono *</label>
            <input id="prof-phone" style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(305) 555-0123" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label htmlFor="prof-email" style={labelStyle}>Email *</label>
          <input id="prof-email" style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agente@ejemplo.com" />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label htmlFor="prof-agency" style={labelStyle}>Nombre de Agencia *</label>
          <input id="prof-agency" style={inputStyle} value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Mi Agencia de Seguros" />
        </div>

        {/* Optional fields */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#5a5e72", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>
            Personalización (opcional)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, marginBottom: 14 }}>
            <div>
              <label htmlFor="prof-logo" style={labelStyle}>URL del Logo</label>
              <input id="prof-logo" style={inputStyle} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <label htmlFor="prof-color" style={labelStyle}>Color</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  id="prof-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  style={{
                    width: 48, height: 48, borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)",
                    background: "#0e1018", cursor: "pointer", padding: 2,
                  }}
                />
                <span style={{ fontSize: 12, color: "#5a5e72", fontFamily: "monospace" }}>{brandColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div style={{
          background: "#0e1018", borderRadius: 10, padding: 16, marginBottom: 24,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Vista previa del link
          </div>
          <div style={{ fontSize: 13, color: "#10b981", fontFamily: "monospace", wordBreak: "break-all" }}>
            enrollsalud.com/q/{agent.slug}
          </div>
          <div style={{ fontSize: 12, color: "#8b8fa3", marginTop: 4 }}>
            {agencyName || agent.name} · NPN: {npn || "—"}
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !isComplete}
          style={{
            width: "100%", padding: "14px 28px", borderRadius: 10,
            border: "none", fontSize: 16, fontWeight: 800,
            cursor: saving || !isComplete ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            background: saving || !isComplete ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
            color: saving || !isComplete ? "#5a5e72" : "#000",
          }}
        >
          {saving ? "Guardando..." : saved ? "Guardado!" : "Guardar Perfil"}
        </button>
      </div>
    </>
  );
}
