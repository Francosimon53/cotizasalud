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

const METAL: Record<string, { label: string; color: string }> = {
  gold: { label: "Gold", color: "#FFD700" },
  silver: { label: "Silver", color: "#C0C0C0" },
  bronze: { label: "Bronze", color: "#CD7F32" },
  platinum: { label: "Platinum", color: "#4A90D9" },
  catastrophic: { label: "Catastrophic", color: "#6b7280" },
};

function detectMetal(name: string) {
  const l = name.toLowerCase();
  if (l.includes("gold") || l.includes("oro")) return METAL.gold;
  if (l.includes("silver") || l.includes("plata")) return METAL.silver;
  if (l.includes("bronze") || l.includes("bronce")) return METAL.bronze;
  if (l.includes("platinum") || l.includes("platino")) return METAL.platinum;
  if (l.includes("catastrophic")) return METAL.catastrophic;
  return null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function LeadDetailClient({ lead: initialLead, activity: initialActivity, conversation }: { lead: any; activity: any[]; conversation?: any }) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [activity, setActivity] = useState(initialActivity);
  const [modal, setModal] = useState<{ newStatus: string } | null>(null);
  const [note, setNote] = useState("");
  const [followupDate, setFollowupDate] = useState(lead.next_followup_date || "");
  const [savingNote, setSavingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const currentStatusCfg = STATUSES.find((s) => s.value === lead.status) || STATUSES[0];

  // Extract plan data
  const planObj = lead.selected_plan && typeof lead.selected_plan === "object" ? lead.selected_plan : null;
  const planName = lead.selected_plan_name || planObj?.name || "";
  const metalInfo = planName ? detectMetal(planName) : null;
  const planPremium = planObj?.premium || null;
  const planAfterSubsidy = lead.selected_premium || planObj?.afterSubsidy || null;
  const planDeductible = planObj?.deductible || null;
  const planOopMax = planObj?.oopMax || null;
  const planPcp = planObj?.pcp || null;
  const planSpecialist = planObj?.specialist || null;
  const planEr = planObj?.er || null;
  const planRx = planObj?.genericRx || null;
  const planHiosId = planObj?.id || conversation?.selected_plan_hios_id || "";

  // Contact helpers
  const waPhone = (lead.contact_phone || "").replace(/\D/g, "");
  const waNum = waPhone.length === 10 ? `1${waPhone}` : waPhone;
  const firstName = lead.first_name || (lead.contact_name || "").split(" ")[0] || "";
  const lastName = lead.last_name || (lead.contact_name || "").split(" ").slice(1).join(" ") || "";

  const handleStatusSaved = (_leadId: string, newStatus: string) => {
    setLead((prev: any) => ({ ...prev, status: newStatus }));
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
      body: JSON.stringify({ leadId: lead.id, note: note.trim() || undefined, nextFollowupDate: followupDate || undefined }),
    });
    if (res.ok) {
      setNote("");
      if (followupDate) setLead((prev: any) => ({ ...prev, next_followup_date: followupDate }));
      const data = await fetch(`/api/leads/${lead.id}`).then((r) => r.json());
      if (data.activity) setActivity(data.activity);
    }
    setSavingNote(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
    router.push("/agentes/dashboard");
  };

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const allData = `Nombre: ${lead.contact_name || "—"}
Teléfono: ${lead.contact_phone || "—"}
Email: ${lead.contact_email || "N/A"}
ZIP: ${lead.zipcode || "—"}
Condado: ${lead.county || "—"}, ${lead.state || "FL"}
Hogar: ${lead.household_size || 1} miembros
Edades: ${lead.ages || "N/A"}
Ingreso: ${lead.annual_income ? "$" + Number(lead.annual_income).toLocaleString() + "/año" : "N/A"}
FPL: ${lead.fpl_percentage || "—"}%
Plan: ${planName || "N/A"}
HIOS ID: ${planHiosId || "N/A"}`;

  const healthSherpaData = `First Name: ${firstName}
Last Name: ${lastName}
DOB: ${lead.dob || ""}
Phone: ${waPhone}
Email: ${lead.contact_email || ""}
Address: ${lead.street_address || ""}${lead.apt_number ? " " + lead.apt_number : ""}
City: ${lead.city || ""}
State: ${lead.state_form || lead.state || "FL"}
ZIP: ${lead.zipcode || ""}
County: ${lead.county || ""}
Income: ${lead.annual_income ? "$" + Number(lead.annual_income).toLocaleString() : ""}
Household Size: ${lead.household_size || 1}
Household DOBs: ${lead.household_dobs || lead.ages || ""}
Plan: ${planName || "N/A"}
HIOS ID: ${planHiosId || "N/A"}
Premium: ${planAfterSubsidy ? "$" + planAfterSubsidy + "/mes after subsidy" : "N/A"}
Current Insurance: ${lead.current_insurance === "yes" ? "Sí — " + (lead.current_insurance_name || "") : lead.current_insurance === "no" ? "No" : "N/A"}
Contact Pref: ${lead.contact_preference || "N/A"}
Best Call Time: ${lead.best_call_time || "N/A"}`;

  // Parse AI conversation questions
  const aiQuestions: string[] = [];
  if (conversation?.messages && Array.isArray(conversation.messages)) {
    for (const msg of conversation.messages) {
      if (msg.role === "user" && msg.content) {
        aiQuestions.push(msg.content);
        if (aiQuestions.length >= 3) break;
      }
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #334155", fontSize: 14,
    background: "#0F172A", color: "#E2E8F0", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const cardStyle: React.CSSProperties = {
    background: "#1E293B", borderRadius: 16, padding: 24,
    border: "1px solid #334155", marginBottom: 20,
  };
  const statBox: React.CSSProperties = {
    background: "#0F172A", borderRadius: 8, padding: "10px 12px", textAlign: "center",
  };
  const statLabel: React.CSSProperties = {
    fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3,
  };
  const statVal: React.CSSProperties = {
    fontSize: 16, fontWeight: 900, color: "#E2E8F0", marginTop: 2,
  };
  const actionBtn = (bg: string, color: string): React.CSSProperties => ({
    padding: "10px 16px", borderRadius: 10, border: "none", background: bg,
    color, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
    textDecoration: "none", textAlign: "center", display: "inline-flex", alignItems: "center", gap: 6,
  });

  return (
    <div style={{ fontFamily: "'Satoshi', -apple-system, sans-serif", minHeight: "100vh", background: "#0F172A", color: "#E2E8F0" }}>
      {modal && (
        <StatusModal leadId={lead.id} leadName={lead.contact_name || "Lead"} currentStatus={lead.status} newStatus={modal.newStatus} onClose={() => setModal(null)} onSaved={handleStatusSaved} />
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{ background: "#1E293B", borderRadius: 16, padding: 28, border: "1px solid rgba(239,68,68,0.3)", width: "100%", maxWidth: 400, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#E2E8F0", marginBottom: 8 }}>¿Eliminar este lead?</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 24 }}>Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "12px 20px", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{deleting ? "..." : "Eliminar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ background: "rgba(8,9,13,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => router.push("/agentes/dashboard")} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>← Dashboard</button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#E2E8F0" }}>{lead.contact_name || "Visitante anónimo"}</span>
          <span style={{ marginLeft: 10, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color: currentStatusCfg.color, background: `${currentStatusCfg.color}18` }}>{currentStatusCfg.label}</span>
        </div>
      </header>

      {/* Action Buttons Bar — sticky */}
      <div style={{ background: "#0F172A", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "10px 20px", position: "sticky", top: 53, zIndex: 40, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {lead.contact_phone && (
          <>
            <a href={`tel:${lead.contact_phone}`} style={actionBtn("#10b981", "#fff")}>📞 Llamar</a>
            <a href={`https://wa.me/${waNum}?text=${encodeURIComponent(`Hola ${lead.contact_name || ""}, soy tu agente de seguros de salud en EnrollSalud.${planName ? ` Vi que te interesó el plan ${planName}.` : ""} ¿Tienes unos minutos para hablar?`)}`} target="_blank" rel="noopener noreferrer" style={actionBtn("#25D366", "#fff")}>💬 WhatsApp</a>
          </>
        )}
        {lead.contact_email && (
          <a href={`mailto:${lead.contact_email}?subject=Tu seguro médico - EnrollSalud&body=${encodeURIComponent(`Hola ${lead.contact_name || ""},\n\nSoy tu agente de seguros de salud.${planName ? ` Vi que te interesó el plan ${planName}.` : ""}\n\n¿Tienes unos minutos para hablar sobre tu cobertura?\n\nSaludos`)}`} style={actionBtn("#3b82f6", "#fff")}>📧 Email</a>
        )}
        <button onClick={() => copyText(allData, "datos")} style={actionBtn("rgba(255,255,255,0.08)", copied === "datos" ? "#10b981" : "#8b8fa3")}>{copied === "datos" ? "✓ Copiado" : "📋 Copiar datos"}</button>
        <button onClick={() => copyText(healthSherpaData, "sherpa")} style={actionBtn("rgba(245,158,11,0.15)", copied === "sherpa" ? "#10b981" : "#f59e0b")}>{copied === "sherpa" ? "✓ Copiado" : "📋 HealthSherpa"}</button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" }}>

        {/* Contact / Location / Financial */}
        <div style={cardStyle}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
            <div>
              <div style={statLabel}>Contacto</div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>{lead.contact_name || <span style={{ fontStyle: "italic", color: "#94A3B8" }}>Sin nombre</span>}</div>
              {lead.dob && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>DOB: {lead.dob}</div>}
              {lead.contact_phone && <a href={`tel:${lead.contact_phone}`} style={{ color: "#10b981", fontSize: 14, textDecoration: "none", display: "block", marginTop: 4 }}>{lead.contact_phone}</a>}
              {lead.contact_email && <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{lead.contact_email}</div>}
              {lead.contact_preference && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Pref: {lead.contact_preference}</div>}
              {lead.best_call_time && <div style={{ fontSize: 12, color: "#94A3B8" }}>Horario: {lead.best_call_time}</div>}
            </div>
            <div>
              <div style={statLabel}>Ubicación</div>
              {lead.street_address && <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{lead.street_address}{lead.apt_number ? ` ${lead.apt_number}` : ""}</div>}
              {lead.city && <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{lead.city}, {lead.state_form || lead.state || "FL"}</div>}
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{lead.county || "—"} · ZIP: {lead.zipcode || "—"}</div>
            </div>
            <div>
              <div style={statLabel}>Financiero</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{lead.annual_income ? `$${Number(lead.annual_income).toLocaleString()}/año` : "—"}</div>
              <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 2 }}>{lead.fpl_percentage ? `${lead.fpl_percentage}% FPL` : "—"} · {lead.household_size || 1} miembros</div>
              {lead.current_insurance && (
                <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>
                  Seguro actual: {lead.current_insurance === "yes" ? `Sí${lead.current_insurance_name ? " — " + lead.current_insurance_name : ""}` : lead.current_insurance === "no" ? "No" : "No sabe"}
                </div>
              )}
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 20, paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            <div><span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>CREADO</span><div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{formatDate(lead.created_at)}</div></div>
            {lead.contacted_at && <div><span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>CONTACTADO</span><div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{formatDate(lead.contacted_at)}</div></div>}
            {lead.quoted_at && <div><span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>COTIZADO</span><div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{formatDate(lead.quoted_at)}</div></div>}
            {lead.enrolled_at && <div><span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>INSCRITO</span><div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{formatDate(lead.enrolled_at)}</div></div>}
            {lead.next_followup_date && <div><span style={{ fontSize: 10, color: "#8b5cf6", fontWeight: 700 }}>SEGUIMIENTO</span><div style={{ fontSize: 12, color: "#8b5cf6", marginTop: 2 }}>{lead.next_followup_date}</div></div>}
          </div>
        </div>

        {/* Plan Seleccionado */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            🏥 Plan Seleccionado
            {metalInfo && <span style={{ padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 900, color: "#000", background: metalInfo.color }}>{metalInfo.label}</span>}
          </div>
          {planName ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#E2E8F0", marginBottom: 12 }}>{planName}</div>
              {planHiosId && <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 14 }}>HIOS ID: {planHiosId}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {planPremium != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Prima Bruta</div>
                    <div style={{ ...statVal, color: "#94A3B8", textDecoration: "line-through", fontSize: 14 }}>${planPremium}/mes</div>
                  </div>
                )}
                {planAfterSubsidy != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Con Subsidio</div>
                    <div style={{ ...statVal, color: "#10b981" }}>${planAfterSubsidy}/mes</div>
                  </div>
                )}
                {planDeductible != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Deducible</div>
                    <div style={statVal}>${Number(planDeductible).toLocaleString()}</div>
                  </div>
                )}
                {planOopMax != null && (
                  <div style={statBox}>
                    <div style={statLabel}>OOP Máximo</div>
                    <div style={statVal}>${Number(planOopMax).toLocaleString()}</div>
                  </div>
                )}
                {planPcp != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Copay PCP</div>
                    <div style={statVal}>${planPcp}</div>
                  </div>
                )}
                {planSpecialist != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Especialista</div>
                    <div style={statVal}>${planSpecialist}</div>
                  </div>
                )}
                {planEr != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Emergencia</div>
                    <div style={statVal}>${planEr}</div>
                  </div>
                )}
                {planRx != null && (
                  <div style={statBox}>
                    <div style={statLabel}>Rx Genérico</div>
                    <div style={statVal}>${planRx}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, fontStyle: "italic", color: "#94A3B8" }}>Sin plan seleccionado aún</div>
          )}
        </div>

        {/* AI Advisor Summary */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>🤖 Resumen del AI Advisor</div>
          {conversation?.conversation_summary ? (
            <>
              <div style={{ fontSize: 14, color: "#E2E8F0", lineHeight: 1.7, marginBottom: 12 }}>{conversation.conversation_summary}</div>
              {aiQuestions.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>Preguntas del cliente</div>
                  {aiQuestions.map((q, i) => (
                    <div key={i} style={{ fontSize: 13, color: "#94A3B8", marginBottom: 6, paddingLeft: 12, borderLeft: "2px solid rgba(139,92,246,0.3)" }}>{q}</div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 14, fontStyle: "italic", color: "#94A3B8" }}>El cliente no usó el AI Advisor</div>
          )}
        </div>

        {/* Household */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>👨‍👩‍👧 Hogar</div>
          {lead.household_members && Array.isArray(lead.household_members) && lead.household_members.length > 0 ? (
            lead.household_members.map((m: any, idx: number) => {
              const flags: string[] = [];
              if (m.tobacco) flags.push("Tabaco");
              if (m.hasEmployerCoverage) flags.push("Cobertura empleador");
              if (m.isParentGuardian) flags.push("Padre/tutor");
              if (m.isPregnant) flags.push("Embarazada");
              return (
                <div key={idx} style={{ fontSize: 13, color: "#E2E8F0", marginBottom: 6, padding: "6px 0", borderBottom: idx < lead.household_members.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <span style={{ fontWeight: 700 }}>Persona {idx + 1}:</span> {m.age} años, {m.gender === "Male" ? "Masculino" : "Femenino"}
                  {flags.length > 0 && <span style={{ color: "#f59e0b", fontWeight: 600 }}> — {flags.join(", ")}</span>}
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 13, color: "#94A3B8" }}>
              {lead.household_size || 1} miembro{(lead.household_size || 1) > 1 ? "s" : ""}
              {lead.ages && <span> · Edades: {lead.ages}</span>}
              {lead.uses_tobacco && <span style={{ color: "#f59e0b" }}> · Tabaco: Sí</span>}
            </div>
          )}
        </div>

        {/* Status Actions */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Cambiar Estado</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUSES.filter((s) => s.value !== lead.status).map((s) => (
              <button key={s.value} onClick={() => setModal({ newStatus: s.value })} style={{
                padding: "8px 18px", borderRadius: 8, border: `1px solid ${s.color}40`, background: `${s.color}10`,
                color: s.color, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>→ {s.label}</button>
            ))}
          </div>
        </div>

        {/* Add Note */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>Agregar Nota</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe una nota..." rows={3} style={{ ...inputStyle, resize: "vertical", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700 }}>Seguimiento:</label>
              <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} style={{ ...inputStyle, marginTop: 4 }} />
            </div>
            <button onClick={handleAddNote} disabled={savingNote || (!note.trim() && !followupDate)} style={{
              padding: "10px 24px", borderRadius: 8, border: "none",
              background: savingNote ? "rgba(255,255,255,0.1)" : "#10b981",
              color: savingNote ? "#5a5e72" : "#000",
              fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-end",
            }}>{savingNote ? "..." : "Guardar"}</button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Actividad</div>
          <ActivityTimeline activity={activity} />
        </div>

        {/* Delete */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: "10px 20px" }}>🗑️ Eliminar lead</button>
        </div>
      </div>
    </div>
  );
}
