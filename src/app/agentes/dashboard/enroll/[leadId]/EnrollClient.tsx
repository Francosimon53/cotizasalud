"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
        <div style={{ fontSize: 14, color: "#f0f1f5", fontWeight: 600, marginTop: 2 }}>{value || "—"}</div>
      </div>
      <button onClick={async () => { await navigator.clipboard.writeText(value || ""); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: copied ? "#10b981" : "rgba(255,255,255,0.08)", color: copied ? "#000" : "#8b8fa3" }}>
        {copied ? "OK" : "Copiar"}
      </button>
    </div>
  );
}

export default function EnrollClient({ lead, agent, conversation }: { lead: any; agent: any; conversation: any }) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  const handleMarkEnrolled = async () => {
    setMarking(true);
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: lead.id, status: "enrolled", note: "Inscrito desde vista de enrollment" }),
    });
    router.push("/agentes/dashboard");
  };

  const allData = `Nombre: ${lead.contact_name}
Teléfono: ${lead.contact_phone}
Email: ${lead.contact_email || "N/A"}
ZIP: ${lead.zipcode}
Condado: ${lead.county}, ${lead.state}
Hogar: ${lead.household_size} miembros
Edades: ${lead.ages || "N/A"}
Ingreso: $${Number(lead.annual_income).toLocaleString()}/año
FPL: ${lead.fpl_percentage}%
Plan: ${conversation?.selected_plan_name || lead.selected_plan || "N/A"}
HIOS ID: ${conversation?.selected_plan_hios_id || "N/A"}`;

  const waPhone = lead.contact_phone.replace(/\D/g, "");
  const waNum = waPhone.length === 10 ? `1${waPhone}` : waPhone;
  const waMsg = encodeURIComponent(`Hola ${lead.contact_name}, soy ${agent.name} tu agente de seguros de salud en EnrollSalud. Estoy preparando tu inscripción. ¿Tienes unos minutos para confirmar tus datos?`);

  // HealthSherpa deeplink
  const hsAgentId = agent.healthsherpa_agent_id || agent.npn || "";
  const hsPlanId = conversation?.selected_plan_hios_id || (lead.selected_plan && typeof lead.selected_plan === "object" ? lead.selected_plan.id : "") || "";
  const hsCountyFips = lead.county_fips || "";
  const hsPhone = waPhone.length === 10 ? waPhone : "";
  const canOpenHS = !!(hsAgentId && hsPlanId && lead.zipcode);

  const openHealthSherpa = () => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://www.healthsherpa.com/public/ichra/off_ex";
    form.target = "_blank";
    const fields: Record<string, string> = {
      plan_hios_id: hsPlanId,
      _agent_id: hsAgentId,
      agent_of_record_npn: agent.npn || hsAgentId,
      zip_code: lead.zipcode || "",
      fip_code: hsCountyFips,
      phone_number: hsPhone,
      plan_year: String(new Date().getFullYear()),
    };
    for (const [k, v] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141c", borderRadius: 16, padding: 24,
    border: "1px solid rgba(255,255,255,0.06)", marginBottom: 16,
  };

  return (
    <div style={{ fontFamily: "'Satoshi', -apple-system, sans-serif", minHeight: "100vh", background: "#08090d", color: "#f0f1f5" }}>
      {/* Header */}
      <header style={{ background: "rgba(8,9,13,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Enrollment: {lead.contact_name}</span>
        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.15)", marginLeft: "auto" }}>Ready to Enroll</span>
      </header>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <a href={`tel:${lead.contact_phone}`} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none", textAlign: "center", minWidth: 140 }}>📞 Llamar</a>
          <a href={`https://wa.me/${waNum}?text=${waMsg}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: "12px 20px", borderRadius: 10, background: "#25D366", color: "#fff", fontSize: 14, fontWeight: 800, textDecoration: "none", textAlign: "center", minWidth: 140 }}>💬 WhatsApp</a>
          <button onClick={handleMarkEnrolled} disabled={marking} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: marking ? "rgba(255,255,255,0.1)" : "#10b981", color: marking ? "#5a5e72" : "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minWidth: 140 }}>✅ {marking ? "..." : "Marcar Enrolled"}</button>
          {canOpenHS && (
            <button onClick={openHealthSherpa} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", minWidth: 140 }}>🏥 Abrir en HealthSherpa</button>
          )}
          <button onClick={async () => { await navigator.clipboard.writeText(allData); }} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#8b8fa3", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minWidth: 140 }}>📋 Copiar Todo</button>
        </div>

        {/* AI Summary */}
        {conversation?.conversation_summary && (
          <div style={{ ...cardStyle, borderColor: "rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Resumen del Asesor IA</div>
            <div style={{ fontSize: 14, color: "#e0e1e5", lineHeight: 1.7 }}>{conversation.conversation_summary}</div>
          </div>
        )}

        {/* Client Info */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#e0e1e5", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Datos del Cliente</div>
          <CopyField label="Nombre" value={lead.contact_name} />
          <CopyField label="Teléfono" value={lead.contact_phone} />
          <CopyField label="Email" value={lead.contact_email || ""} />
          <CopyField label="ZIP" value={lead.zipcode} />
          <CopyField label="Condado" value={`${lead.county}, ${lead.state}`} />
          <CopyField label="FIPS" value={lead.county_fips || ""} />
          {lead.dob && <CopyField label="DOB" value={lead.dob} />}
          {lead.street_address && <CopyField label="Dirección" value={`${lead.street_address}${lead.apt_number ? " " + lead.apt_number : ""}`} />}
          {lead.city && <CopyField label="Ciudad/Estado" value={`${lead.city}, ${lead.state_form || lead.state || "FL"}`} />}
        </div>

        {/* Household */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#e0e1e5", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Hogar</div>
          <CopyField label="Miembros" value={String(lead.household_size)} />
          <CopyField label="Edades" value={lead.ages || ""} />
          {lead.household_dobs && <CopyField label="DOBs" value={lead.household_dobs} />}
          <CopyField label="Tabaco" value={lead.uses_tobacco ? "Sí" : "No"} />
          {lead.current_insurance && <CopyField label="Seguro actual" value={lead.current_insurance === "yes" ? `Sí — ${lead.current_insurance_name || ""}` : lead.current_insurance === "no" ? "No" : "No sabe"} />}
          {lead.contact_preference && <CopyField label="Contactar vía" value={lead.contact_preference} />}
          {lead.best_call_time && <CopyField label="Mejor hora" value={lead.best_call_time} />}
        </div>

        {/* Financial */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#e0e1e5", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Financiero</div>
          <CopyField label="Ingreso Anual" value={`$${Number(lead.annual_income).toLocaleString()}`} />
          <CopyField label="FPL" value={`${lead.fpl_percentage}%`} />
          <CopyField label="APTC Estimado" value={lead.aptc_estimate ? `$${lead.aptc_estimate}/mes` : "N/A"} />
        </div>

        {/* Plan */}
        {(conversation?.selected_plan_name || lead.selected_plan) && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#e0e1e5", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 }}>Plan Seleccionado</div>
            <CopyField label="Plan" value={conversation?.selected_plan_name || lead.selected_plan || ""} />
            <CopyField label="HIOS ID" value={conversation?.selected_plan_hios_id || ""} />
          </div>
        )}

        {/* Copy for HealthSherpa */}
        <button onClick={async () => { await navigator.clipboard.writeText(allData); }}
          style={{ width: "100%", padding: "16px 28px", borderRadius: 10, border: "2px solid #f59e0b", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>
          📋 Copiar para HealthSherpa
        </button>
      </div>
    </div>
  );
}
