"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "../agentes.css";

const CARRIERS = ["Ambetter", "Molina", "Florida Blue", "Oscar", "Aetna", "Cigna", "UnitedHealthcare"];
const STATES = ["FL", "TX", "CA", "NY", "GA", "NC", "IL", "PA", "NJ", "VA"];

export default function SetupWizardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [npn, setNpn] = useState("");
  const [slug, setSlug] = useState("");
  const [states, setStates] = useState<string[]>(["FL"]);
  const [carriers, setCarriers] = useState<string[]>([]);
  const [language, setLanguage] = useState("es");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const toggleArr = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !npn.trim()) {
      setError("Nombre, teléfono y NPN son requeridos");
      return;
    }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/agents/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npn: npn.trim(),
          email: "", // keep existing
          phone: phone.trim(),
          agency_name: name.trim(),
          brand_color: "#10b981",
          logo_url: photoUrl.trim() || null,
          // Extended fields
          full_name: name.trim(),
          slug: (slug.trim() || autoSlug) || undefined,
          licensed_states: states,
          appointed_carriers: carriers,
          preferred_language: language,
          photo_url: photoUrl.trim() || null,
          onboarding_complete: true,
        }),
      });

      if (res.ok) {
        router.push("/agentes/dashboard/share");
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
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    background: "#0e1018", color: "#f0f1f5",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 700, color: "#e0e1e5",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
  };
  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", border: "none",
    background: active ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
    color: active ? "#10b981" : "#8b8fa3",
    outline: active ? "1.5px solid #10b981" : "1px solid rgba(255,255,255,0.1)",
  });

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #10b981, #06b6d4)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#000", marginBottom: 12 }}>ES</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f0f1f5" }}>Configura tu Perfil</div>
          <div style={{ fontSize: 13, color: "#5a5e72", marginTop: 4 }}>Completa tu información para activar tu cotizador</div>
        </div>

        <div style={{ background: "#12141c", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.06)" }}>
          {error && (
            <div role="alert" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#ef4444" }}>{error}</div>
          )}

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Nombre completo *</label>
            <input style={inputStyle} value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(""); }} placeholder="María Rodríguez" autoFocus />
          </div>

          {/* Phone + NPN */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Teléfono *</label>
              <input style={inputStyle} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(305) 555-0123" />
            </div>
            <div>
              <label style={labelStyle}>NPN *</label>
              <input style={inputStyle} value={npn} onChange={(e) => setNpn(e.target.value)} placeholder="12345678" />
            </div>
          </div>

          {/* Custom slug */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Tu URL personalizada</label>
            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <span style={{ padding: "12px 10px", background: "#0e1018", border: "1.5px solid rgba(255,255,255,0.1)", borderRight: "none", borderRadius: "8px 0 0 8px", fontSize: 13, color: "#5a5e72", whiteSpace: "nowrap" }}>enrollsalud.com/q/</span>
              <input style={{ ...inputStyle, borderRadius: "0 8px 8px 0" }} value={slug || autoSlug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="tu-nombre" />
            </div>
          </div>

          {/* Licensed States */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Estados con licencia</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {STATES.map((s) => (
                <button key={s} type="button" style={chipStyle(states.includes(s))} onClick={() => toggleArr(states, s, setStates)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Carriers */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Carriers designados</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CARRIERS.map((c) => (
                <button key={c} type="button" style={chipStyle(carriers.includes(c))} onClick={() => toggleArr(carriers, c, setCarriers)}>{c}</button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Idioma preferido</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ v: "es", l: "Español" }, { v: "en", l: "English" }, { v: "both", l: "Ambos" }].map((o) => (
                <button key={o.v} type="button" style={chipStyle(language === o.v)} onClick={() => setLanguage(o.v)}>{o.l}</button>
              ))}
            </div>
          </div>

          {/* Photo URL */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>URL de foto (opcional)</label>
            <input style={inputStyle} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving || !name.trim() || !phone.trim() || !npn.trim()}
            style={{
              width: "100%", padding: "16px 28px", borderRadius: 10, border: "none",
              fontSize: 16, fontWeight: 900, fontFamily: "inherit",
              cursor: saving ? "wait" : "pointer",
              background: saving ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #10b981, #06b6d4)",
              color: saving ? "#5a5e72" : "#000",
            }}>
            {saving ? "Guardando..." : "Activar Mi Cotizador →"}
          </button>
        </div>
      </div>
    </div>
  );
}
