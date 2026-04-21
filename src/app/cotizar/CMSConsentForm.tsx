"use client";
import { useState } from "react";

interface PlanDetails {
  name: string;
  premium: number;
  afterSubsidy: number;
  deductible: number;
  oopMax: number;
}

interface CMSConsentFormProps {
  consumerName: string;
  consumerPhone: string;
  consumerEmail: string;
  consumerDob: string;
  consumerIncome: number;
  agentName?: string;
  agentNPN?: string;
  agentPhone?: string;
  selectedPlan?: PlanDetails;
  effectiveDate?: string;
  lang: string;
  t: Record<string, string>;
  onConsent: (consentData: ConsentRecord) => void;
  onBack: () => void;
}

export interface ConsentRecord {
  consumerName: string;
  consumerPhone: string;
  consumerEmail: string;
  consumerDob: string;
  consumerIncome: number;
  agentName: string;
  agentNPN: string;
  agentPhone: string;
  planName: string;
  planPremium: number;
  planDeductible: number;
  planMaxOop: number;
  effectiveDate: string;
  consentDate: string;
  consentTimestamp: number;
  typedSignature: string;
  consentGranted: boolean;
  ipAddress?: string;
}

function fmtCurrency(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" });
}

export default function CMSConsentForm({
  consumerName,
  consumerPhone,
  consumerEmail,
  consumerDob,
  consumerIncome,
  agentName,
  agentNPN,
  agentPhone,
  selectedPlan,
  effectiveDate,
  lang,
  t: parentT,
  onConsent,
  onBack,
}: CMSConsentFormProps) {
  const [typedSignature, setTypedSignature] = useState("");
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const signatureDateStr = now.toLocaleString("es-US", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "America/New_York",
  });

  const agentDisplay = agentName || "EnrollSalud Agent";
  const agentNpnDisplay = agentNPN || "N/A";
  const agentPhoneDisplay = agentPhone || "N/A";

  const planName = selectedPlan?.name || "N/A";
  const premium = selectedPlan ? fmtCurrency(selectedPlan.afterSubsidy) : "N/A";
  const deductible = selectedPlan ? fmtCurrency(selectedPlan.deductible) : "N/A";
  const maxOop = selectedPlan ? fmtCurrency(selectedPlan.oopMax) : "N/A";
  const incomeDisplay = consumerIncome ? fmtCurrency(consumerIncome) : "N/A";
  const effectiveDateDisplay = effectiveDate ? fmtDate(effectiveDate) : "N/A";

  const isValid = typedSignature.trim().length >= 2;

  const handleSubmit = () => {
    if (!isValid) {
      setShowError(true);
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    onConsent({
      consumerName,
      consumerPhone,
      consumerEmail,
      consumerDob,
      consumerIncome,
      agentName: agentDisplay,
      agentNPN: agentNpnDisplay,
      agentPhone: agentPhoneDisplay,
      planName,
      planPremium: selectedPlan?.afterSubsidy || 0,
      planDeductible: selectedPlan?.deductible || 0,
      planMaxOop: selectedPlan?.oopMax || 0,
      effectiveDate: effectiveDate || "",
      consentDate: now.toISOString(),
      consentTimestamp: now.getTime(),
      typedSignature: typedSignature.trim(),
      consentGranted: true,
    });
  };

  // Styles
  const card: React.CSSProperties = {
    background: "#fff", borderRadius: 14, padding: "32px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)",
    maxWidth: 640, margin: "0 auto", border: "1px solid #E2E8F0",
  };
  const legalText: React.CSSProperties = {
    fontSize: 13, lineHeight: 1.8, color: "#374151", marginBottom: 16,
  };
  const sectionDivider: React.CSSProperties = {
    height: 1, background: "#E2E8F0", margin: "20px 0",
  };
  const infoGrid: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px",
    fontSize: 13, color: "#374151", marginBottom: 16,
  };
  const infoLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase",
    letterSpacing: 0.5,
  };
  const infoValue: React.CSSProperties = {
    fontSize: 14, fontWeight: 600, color: "#1E293B", marginTop: 2,
  };
  const btn: React.CSSProperties = {
    padding: "14px 28px", borderRadius: 10, border: "none",
    fontSize: 15, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", transition: "all .2s",
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1E3A5F", letterSpacing: 0.5 }}>
          CARTA DE CONSENTIMIENTO
        </div>
      </div>

      {/* Main consent body */}
      <div style={legalText}>
        Yo, <strong>{consumerName || "[Nombre del Cliente]"}</strong>
        {" "}estoy solicitando asistencia para enrolarme en un Seguro de Salud por Medio del Mercado de Seguros Médicos. He brindado la información necesaria para ser elegible al crédito fiscal que otorga el Mercado de Seguros Médicos y así obtener beneficios de una prima reducida. Certifico que he recibido y entendido la asesoría brindada por:
      </div>

      {/* Agent info inline */}
      <div style={{
        background: "#F8FAFC", borderRadius: 10, padding: 16,
        border: "1px solid #E2E8F0", marginBottom: 20,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 32px", fontSize: 13, color: "#374151" }}>
          <div><span style={{ fontWeight: 700 }}>Agente Autorizado:</span> {agentDisplay}</div>
          <div><span style={{ fontWeight: 700 }}>NPN:</span> {agentNpnDisplay}</div>
          <div><span style={{ fontWeight: 700 }}>Teléfono:</span> {agentPhoneDisplay}</div>
        </div>
      </div>

      <div style={legalText}>
        Por este medio doy permiso a <strong>{agentDisplay}</strong> para actuar como mi Agente, de Seguro de Salud de mi familia. Al dar mi consentimiento a este acuerdo, autorizo a utilizar la información confidencial proporcionada por escrito, electrónicamente o por teléfono, solo para los fines de uno o más de los siguientes propósitos:
      </div>

      {/* Numbered purposes */}
      <div style={{ ...legalText, paddingLeft: 8 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>1.</strong> Búsqueda y/o creación de una aplicación en el Mercado de Seguros.
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>2.</strong> Completar una solicitud de elegibilidad e inscripción en un Plan de Salud del Mercado u otros programas gubernamentales de asequibilidad de seguros o créditos fiscales anticipados para ayudar a pagar las primas del Mercado.
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>3.</strong> Brindar mantenimiento continuo de la cuenta y asistencia para la inscripción según sea necesario.
        </div>
        <div style={{ marginBottom: 8 }}>
          <strong>4.</strong> Responder a consultas del Mercado con respecto a mi solicitud.
        </div>
      </div>

      <div style={sectionDivider} />

      {/* Plan Details */}
      <div style={{ fontSize: 14, fontWeight: 800, color: "#1E3A5F", marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Detalles del Plan
      </div>
      <div style={{
        background: "#F0FDF4", borderRadius: 10, padding: 16,
        border: "1px solid #BBF7D0", marginBottom: 20,
      }}>
        <div style={infoGrid}>
          <div>
            <div style={infoLabel}>Nombre del Plan</div>
            <div style={infoValue}>{planName}</div>
          </div>
          <div>
            <div style={infoLabel}>Prima Mensual</div>
            <div style={{ ...infoValue, color: "#059669" }}>{premium}</div>
          </div>
          <div>
            <div style={infoLabel}>Deducible</div>
            <div style={infoValue}>{deductible}</div>
          </div>
          <div>
            <div style={infoLabel}>Gasto máximo de bolsillo</div>
            <div style={infoValue}>{maxOop}</div>
          </div>
          <div>
            <div style={infoLabel}>Ingreso Total</div>
            <div style={infoValue}>{incomeDisplay}</div>
          </div>
          <div>
            <div style={infoLabel}>Fecha de Vigencia</div>
            <div style={infoValue}>{effectiveDateDisplay}</div>
          </div>
        </div>
      </div>

      {/* Ongoing consent text */}
      <div style={legalText}>
        Entiendo que mi consentimiento permanece vigente hasta que sea revocado o modificado poniéndome en contacto con el agente arriba mencionado y que mi información personal no será divulgada y será guardada de forma segura. Así mismo entiendo que en casos de cambios tales como:
      </div>

      <div style={{ ...legalText, paddingLeft: 16 }}>
        <div style={{ marginBottom: 4 }}>• Estatus Marital.</div>
        <div style={{ marginBottom: 4 }}>• Cambios de Ingresos.</div>
        <div style={{ marginBottom: 4 }}>• Cambios en el número de personas en mi declaración de Impuestos.</div>
        <div style={{ marginBottom: 4 }}>• Cambios en el número de personas que necesitan cobertura médica en mi aplicación.</div>
        <div style={{ marginBottom: 4 }}>• Cambios de estatus migratorio.</div>
        <div style={{ marginBottom: 4 }}>• Cambios de dirección.</div>
      </div>

      <div style={legalText}>
        Debo notificar a mi representante inmediatamente si ocurren estos cambios y sean actualizados en el Sistema. De la misma manera confirmo no tener otro seguro médico.
      </div>

      <div style={sectionDivider} />

      {/* Client footer info */}
      <div style={{ marginBottom: 20 }}>
        <div style={infoGrid}>
          <div>
            <div style={infoLabel}>Fecha de Nacimiento</div>
            <div style={infoValue}>{consumerDob ? fmtDate(consumerDob) : "N/A"}</div>
          </div>
          <div>
            <div style={infoLabel}>Teléfono</div>
            <div style={infoValue}>{consumerPhone || "N/A"}</div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={infoLabel}>Email</div>
            <div style={infoValue}>{consumerEmail || "N/A"}</div>
          </div>
        </div>
      </div>

      <div style={sectionDivider} />

      {/* Signature area */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.7, marginBottom: 14 }}>
          Al firmar digitalmente escribiendo su nombre en este espacio, usted representa legalmente su firma real y reconoce que la información proporcionada es precisa y válida.
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>
            Firma (escriba su nombre completo)
          </label>
          <input
            type="text"
            value={typedSignature}
            onChange={(e) => { setTypedSignature(e.target.value); setShowError(false); }}
            placeholder="Escriba su nombre aquí como firma"
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 8,
              border: showError && !isValid ? "2px solid #ef4444" : "1.5px solid #E2E8F0",
              fontSize: 18, fontFamily: "'Georgia', 'Times New Roman', serif",
              fontStyle: "italic", outline: "none", boxSizing: "border-box",
              background: "#FAFAFA", color: "#1E293B",
            }}
            aria-required="true"
            aria-label="Firma digital"
          />
          {showError && !isValid && (
            <div role="alert" style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
              Se requiere escribir su nombre como firma
            </div>
          )}
        </div>

        <div style={{ fontSize: 13, color: "#6B7280" }}>
          <span style={{ fontWeight: 700 }}>Fecha de Firma:</span> {signatureDateStr}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onBack} style={{
          ...btn, flex: 1, background: "#F8FAFC", color: "#64748B",
          border: "1px solid #CBD5E1",
        }}>
          ← Volver
        </button>
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            ...btn, flex: 2,
            background: isValid && !submitting ? "#0D9488" : "#F1F5F9",
            color: isValid && !submitting ? "#fff" : "#94A3B8",
          }}
        >
          {submitting ? "Procesando..." : "Firmar y Continuar →"}
        </button>
      </div>
    </div>
  );
}
