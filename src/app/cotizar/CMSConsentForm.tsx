"use client";
import { useState, useRef, useEffect } from "react";

interface SelectedPlanInfo {
  name: string;
  issuer: string;
  metal: string;
  premium: number;
  afterSubsidy: number;
  deductible: number;
}

interface CMSConsentFormProps {
  consumerName: string;
  consumerPhone: string;
  consumerEmail: string;
  agentName?: string;
  agentNPN?: string;
  agencyName?: string;
  selectedPlan?: SelectedPlanInfo;
  lang: string;
  t: Record<string, string>;
  onConsent: (consentData: ConsentRecord) => void;
  onBack: () => void;
}

export interface ConsentRecord {
  consumerName: string;
  consumerPhone: string;
  consumerEmail: string;
  agentName: string;
  agentNPN: string;
  agencyName: string;
  consentDate: string;
  consentTimestamp: number;
  signatureDataUrl: string;
  consentGranted: boolean;
  eligibilityReviewed: boolean;
  consentDuration: string;
  ipAddress?: string;
}

const TEXTS = {
  en: {
    title: "Authorization & Consent",
    subtitle: "Required by CMS before your agent can assist you",
    part1Title: "Consumer Consent",
    part1Body: (name: string, agent: string) =>
      `I, ${name || "[Your Name]"}, give my permission to ${agent || "[Agent/Agency]"} to serve as the health insurance agent or broker for myself and my entire household, if applicable, for purposes of enrollment in a Qualified Health Plan offered on the Marketplace.`,
    authItems: [
      "Search for an existing Marketplace application",
      "Complete an application for eligibility and enrollment in a Marketplace Qualified Health Plan or an application for Medicaid, CHIP, or advance payments of the premium tax credit (APTC)",
      "Provide ongoing account maintenance and enrollment assistance",
      "Respond to inquiries from the Marketplace regarding my application",
    ],
    authIntro:
      "By providing my consent, I authorize the above-mentioned agent/agency to view and use my confidential information, including personally identifiable information (PII), only for the following purposes:",
    privacyNote:
      "I understand that my PII will not be used or shared for any purposes other than those listed above. I do not have to share additional PII or protected health information (PHI) beyond what is required for the Marketplace application.",
    durationLabel: "This consent remains in effect for:",
    durationOptions: ["12 months", "24 months", "Until I revoke it"],
    revokeNote: (method: string) =>
      `I may revoke or modify my consent at any time by ${method}.`,
    revokeMethod: "contacting my agent directly",
    part2Title: "Eligibility Review",
    part2Body:
      "I confirm that I have reviewed the eligibility application information and confirmed its accuracy. The attestations at the end of the eligibility application have been explained to me and I was given an opportunity to ask questions.",
    agentInfo: "Agent Information",
    signHere: "Sign here (draw your signature)",
    clearSig: "Clear",
    checkConsent: "I authorize the above agent/agency to assist me as described",
    checkEligibility: "I confirm my eligibility information is accurate",
    submit: "Sign & Continue →",
    sigRequired: "Signature required",
    back: "← Back",
    dateLine: "Date",
    cmsRef: "Ref: CMS Model Consent Form · OMB 0938-1438",
  },
  es: {
    title: "Autorización y Consentimiento",
    subtitle: "Requerido por CMS antes de que tu agente pueda asistirte",
    part1Title: "Consentimiento del Consumidor",
    part1Body: (name: string, agent: string) =>
      `Yo, ${name || "[Tu Nombre]"}, autorizo a ${agent || "[Agente/Agencia]"} a servir como agente o broker de seguros de salud para mí y mi hogar, según corresponda, con el propósito de inscripción en un Plan de Salud Calificado ofrecido en el Mercado de Seguros.`,
    authItems: [
      "Buscar una solicitud existente en el Marketplace",
      "Completar una solicitud de elegibilidad e inscripción en un Plan de Salud Calificado o una solicitud para Medicaid, CHIP, o pagos adelantados del crédito fiscal de prima (APTC)",
      "Proveer mantenimiento continuo de cuenta y asistencia de inscripción",
      "Responder a consultas del Marketplace sobre mi solicitud",
    ],
    authIntro:
      "Al dar mi consentimiento, autorizo al agente/agencia mencionado a ver y usar mi información confidencial, incluyendo información de identificación personal (PII), solo para los siguientes propósitos:",
    privacyNote:
      "Entiendo que mi PII no será usada ni compartida para propósitos distintos a los listados arriba. No tengo que compartir PII adicional o información de salud protegida (PHI) más allá de lo requerido para la solicitud del Marketplace.",
    durationLabel: "Este consentimiento permanece en efecto por:",
    durationOptions: ["12 meses", "24 meses", "Hasta que lo revoque"],
    revokeNote: (method: string) =>
      `Puedo revocar o modificar mi consentimiento en cualquier momento ${method}.`,
    revokeMethod: "contactando a mi agente directamente",
    part2Title: "Revisión de Elegibilidad",
    part2Body:
      "Confirmo que he revisado la información de mi solicitud de elegibilidad y que es correcta. Las atestaciones al final de la solicitud me fueron explicadas y tuve la oportunidad de hacer preguntas.",
    agentInfo: "Información del Agente",
    signHere: "Firma aquí (dibuja tu firma)",
    clearSig: "Borrar",
    checkConsent: "Autorizo al agente/agencia a asistirme según lo descrito",
    checkEligibility: "Confirmo que mi información de elegibilidad es correcta",
    submit: "Firmar y Continuar →",
    sigRequired: "Se requiere firma",
    back: "← Volver",
    dateLine: "Fecha",
    cmsRef: "Ref: Formulario Modelo CMS · OMB 0938-1438",
  },
};

export default function CMSConsentForm({
  consumerName,
  consumerPhone,
  consumerEmail,
  agentName,
  agentNPN,
  agencyName,
  selectedPlan,
  lang,
  t: parentT,
  onConsent,
  onBack,
}: CMSConsentFormProps) {
  const txt = TEXTS[lang === "es" ? "es" : "en"];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [checkConsent, setCheckConsent] = useState(false);
  const [checkEligibility, setCheckEligibility] = useState(false);
  const [duration, setDuration] = useState(txt.durationOptions[0]);
  const [showError, setShowError] = useState(false);

  const agentDisplay = agentName || agencyName || (lang === "es" ? "CotizaSalud (plataforma)" : "CotizaSalud (platform)");
  const today = new Date();
  const dateStr = today.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  // Canvas signature pad
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSig(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const handleSubmit = () => {
    if (!checkConsent || !checkEligibility || !hasSig) {
      setShowError(true);
      return;
    }
    const sigData = canvasRef.current?.toDataURL("image/png") || "";
    onConsent({
      consumerName,
      consumerPhone,
      consumerEmail,
      agentName: agentName || "",
      agentNPN: agentNPN || "",
      agencyName: agencyName || "",
      consentDate: today.toISOString(),
      consentTimestamp: today.getTime(),
      signatureDataUrl: sigData,
      consentGranted: true,
      eligibilityReviewed: true,
      consentDuration: duration,
    });
  };

  const isValid = checkConsent && checkEligibility && hasSig;

  // Styles
  const card: React.CSSProperties = {
    background: "#fff", borderRadius: 16, padding: "24px 20px",
    boxShadow: "0 2px 12px rgba(0,0,0,.06)", maxWidth: 640, margin: "0 auto",
  };
  const sectionTitle: React.CSSProperties = {
    fontSize: 14, fontWeight: 800, color: "#064e3b", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: 0.5,
    display: "flex", alignItems: "center", gap: 8,
  };
  const legalText: React.CSSProperties = {
    fontSize: 12.5, lineHeight: 1.7, color: "#374151", marginBottom: 12,
  };
  const bulletItem: React.CSSProperties = {
    fontSize: 12.5, lineHeight: 1.6, color: "#374151", paddingLeft: 20,
    position: "relative" as const, marginBottom: 4,
  };
  const bulletDot: React.CSSProperties = {
    position: "absolute" as const, left: 6, top: 8,
    width: 5, height: 5, borderRadius: "50%", background: "#059669",
  };
  const divider: React.CSSProperties = {
    height: 1, background: "#e5e7eb", margin: "18px 0",
  };
  const checkRow: React.CSSProperties = {
    display: "flex", alignItems: "flex-start", gap: 10,
    marginBottom: 12, cursor: "pointer",
  };
  const infoBox: React.CSSProperties = {
    background: "#f0fdf4", borderRadius: 10, padding: 14,
    border: "1px solid #bbf7d0", marginBottom: 16,
  };
  const infoRow: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr",
    gap: 6, fontSize: 12, color: "#374151",
  };
  const btn: React.CSSProperties = {
    padding: "14px 28px", borderRadius: 10, border: "none",
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", transition: "all .2s",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#059669", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          📋 CMS Marketplace
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#064e3b", lineHeight: 1.2 }}>
          {txt.title}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          {txt.subtitle}
        </div>
      </div>

      {/* Selected Plan Summary */}
      {selectedPlan && (() => {
        const isEs = lang === "es";
        const metalLabels: Record<string, { en: string; es: string }> = {
          bronze: { en: "Bronze", es: "Bronce" },
          silver: { en: "Silver", es: "Plata" },
          gold: { en: "Gold", es: "Oro" },
          platinum: { en: "Platinum", es: "Platino" },
          catastrophic: { en: "Catastrophic", es: "Catastrófico" },
        };
        const metalColors: Record<string, string> = {
          catastrophic: "#374151", bronze: "#92400e", silver: "#6b7280", gold: "#b45309", platinum: "#4338ca",
        };
        const metalLabel = metalLabels[selectedPlan.metal]?.[isEs ? "es" : "en"] || selectedPlan.metal;
        return (
          <div style={{
            background: "linear-gradient(135deg, #f0fdf4, #ecfdf5)",
            border: "1.5px solid #6ee7b7",
            borderRadius: 12, padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              {isEs ? "Plan seleccionado" : "Selected Plan"}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <span style={{
                  display: "inline-block", padding: "2px 10px", borderRadius: 4,
                  fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8,
                  color: "#fff", backgroundColor: metalColors[selectedPlan.metal] || "#6b7280",
                }}>
                  {metalLabel}
                </span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginTop: 6, lineHeight: 1.3 }}>
                  {selectedPlan.name}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {selectedPlan.issuer}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {selectedPlan.afterSubsidy < selectedPlan.premium && (
                  <div style={{ fontSize: 11, color: "#b0b0b0", textDecoration: "line-through" }}>
                    ${selectedPlan.premium}{isEs ? "/mes" : "/mo"}
                  </div>
                )}
                <div style={{ fontSize: 24, fontWeight: 900, color: "#059669", letterSpacing: -0.5 }}>
                  ${selectedPlan.afterSubsidy}
                </div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>{isEs ? "/mes" : "/mo"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                  {isEs ? "Prima mensual" : "Monthly Premium"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginTop: 2 }}>
                  ${selectedPlan.afterSubsidy}
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,.7)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: 0.5 }}>
                  {isEs ? "Deducible" : "Deductible"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginTop: 2 }}>
                  ${selectedPlan.deductible.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Part 1: Consumer Consent */}
      <div style={sectionTitle}>
        <span style={{ fontSize: 18 }}>1️⃣</span> {txt.part1Title}
      </div>
      <div style={legalText}>
        {txt.part1Body(consumerName, agentDisplay)}
      </div>
      <div style={{ ...legalText, fontWeight: 600, color: "#064e3b", marginBottom: 8 }}>
        {txt.authIntro}
      </div>
      {txt.authItems.map((item, i) => (
        <div key={i} style={bulletItem}>
          <div style={bulletDot} />
          {item}
        </div>
      ))}
      <div style={{ ...legalText, marginTop: 12, fontStyle: "italic", color: "#6b7280" }}>
        {txt.privacyNote}
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
          {txt.durationLabel}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {txt.durationOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setDuration(opt)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: duration === opt ? "1.5px solid #059669" : "1px solid #d1d5db",
                background: duration === opt ? "#ecfdf5" : "#fff",
                color: duration === opt ? "#059669" : "#6b7280",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {opt}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 6 }}>
          {txt.revokeNote(txt.revokeMethod)}
        </div>
      </div>

      <div style={divider} />

      {/* Part 2: Eligibility Review */}
      <div style={sectionTitle}>
        <span style={{ fontSize: 18 }}>2️⃣</span> {txt.part2Title}
      </div>
      <div style={legalText}>
        {txt.part2Body}
      </div>

      <div style={divider} />

      {/* Agent Info */}
      {(agentName || agencyName) && (
        <>
          <div style={{ ...sectionTitle, fontSize: 12 }}>
            {txt.agentInfo}
          </div>
          <div style={infoBox}>
            <div style={infoRow}>
              {agentName && <div>👤 {agentName}</div>}
              {agentNPN && <div>🆔 NPN: {agentNPN}</div>}
              {agencyName && <div>🏢 {agencyName}</div>}
            </div>
          </div>
        </>
      )}

      {/* Consumer Info */}
      <div style={infoBox}>
        <div style={infoRow}>
          <div>👤 {consumerName}</div>
          <div>📞 {consumerPhone}</div>
          {consumerEmail && <div>📧 {consumerEmail}</div>}
          <div>📅 {dateStr}</div>
        </div>
      </div>

      {/* Checkboxes */}
      <label style={checkRow} onClick={() => setCheckConsent(!checkConsent)}>
        <input
          type="checkbox"
          checked={checkConsent}
          onChange={() => setCheckConsent(!checkConsent)}
          style={{ width: 20, height: 20, accentColor: "#059669", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
        />
        <span style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.5 }}>
          {txt.checkConsent}
        </span>
      </label>
      <label style={checkRow} onClick={() => setCheckEligibility(!checkEligibility)}>
        <input
          type="checkbox"
          checked={checkEligibility}
          onChange={() => setCheckEligibility(!checkEligibility)}
          style={{ width: 20, height: 20, accentColor: "#059669", cursor: "pointer", flexShrink: 0, marginTop: 1 }}
        />
        <span style={{ fontSize: 13, color: "#1f2937", lineHeight: 1.5 }}>
          {txt.checkEligibility}
        </span>
      </label>

      {/* Signature Pad */}
      <div style={{ marginTop: 8, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{txt.signHere}</div>
          {hasSig && (
            <button onClick={clearSig} style={{
              fontSize: 11, color: "#ef4444", background: "none", border: "none",
              cursor: "pointer", fontWeight: 600, fontFamily: "inherit",
            }}>{txt.clearSig}</button>
          )}
        </div>
        <div style={{
          border: showError && !hasSig ? "2px solid #ef4444" : "1.5px solid #d1d5db",
          borderRadius: 10, overflow: "hidden", background: "#fafafa",
          touchAction: "none",
        }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: 100, display: "block", cursor: "crosshair" }}
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        {showError && !hasSig && (
          <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{txt.sigRequired}</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>{txt.dateLine}: {dateStr}</div>
          <div style={{ fontSize: 10, color: "#d1d5db" }}>{txt.cmsRef}</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{
          ...btn, flex: 1, background: "#f3f4f6", color: "#374151",
          border: "1px solid #e5e7eb",
        }}>
          {txt.back}
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          style={{
            ...btn, flex: 2,
            background: isValid ? "#059669" : "#d1d5db",
            color: isValid ? "#fff" : "#9ca3af",
          }}
        >
          {txt.submit}
        </button>
      </div>
    </div>
  );
}
