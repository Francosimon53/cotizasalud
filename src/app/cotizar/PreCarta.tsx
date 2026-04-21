"use client";

import { useState, useRef, useEffect } from "react";
import DobSelect from "./DobSelect";

interface PreCartaProps {
  agentName: string;
  agentNPN: string;
  agentPhone: string;
  lang: string;
  onComplete: (data: { firstName: string; lastName: string; dob: string; signatureDataUrl: string; pdfStorageUrl?: string }) => void;
}

export default function PreCarta({ agentName, agentNPN, agentPhone, lang, onComplete }: PreCartaProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [hasSig, setHasSig] = useState(false);
  const [showError, setShowError] = useState(false);
  const [signed, setSigned] = useState(false);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const sigDataRef = useRef("");
  const storageUrlRef = useRef("");

  const isEs = lang === "es";
  const clientName = `${firstName} ${lastName}`.trim();

  // Canvas setup — one-time, ref-based to prevent re-render clearing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1E293B";

    let isDown = false;
    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const t = e.touches[0];
        if (!t) return null;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      }
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e: MouseEvent | TouchEvent) => { e.preventDefault(); isDown = true; const p = getPos(e); if (p) { ctx.beginPath(); ctx.moveTo(p.x, p.y); } };
    const move = (e: MouseEvent | TouchEvent) => { if (!isDown) return; e.preventDefault(); const p = getPos(e); if (p) { ctx.lineTo(p.x, p.y); ctx.stroke(); } };
    const end = () => { if (!isDown) return; isDown = false; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSig(false);
  };

  const checkHasSig = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) { if (data[i] > 0) return true; }
    return false;
  };

  const firstValid = firstName.trim().length >= 2;
  const lastValid = lastName.trim().length >= 2;
  const dobValid = dob.length === 10;

  const handleSubmit = async () => {
    const sigExists = checkHasSig();
    setHasSig(sigExists);
    if (!firstValid || !lastValid || !dobValid || !sigExists) {
      setShowError(true);
      return;
    }

    const sigData = canvasRef.current?.toDataURL("image/png") || "";
    sigDataRef.current = sigData;
    setSigned(true);
    setGenerating(true);

    // Generate and upload PDF in background
    try {
      const res = await fetch("/api/precarta-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: `${firstName.trim()} ${lastName.trim()}`,
          clientDob: dob,
          agentName,
          agentNPN,
          agentPhone,
          signatureDataUrl: sigData,
          signedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        storageUrlRef.current = json.storageUrl || "";
      }
    } catch (err) {
      console.error("Pre-carta PDF generation error:", err);
    }
    setGenerating(false);
  };

  const handleContinue = () => {
    onCompleteRef.current({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      signatureDataUrl: sigDataRef.current,
      pdfStorageUrl: storageUrlRef.current,
    });
  };

  const S = {
    card: { background: "#FFFFFF", borderRadius: 14, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)", border: "1px solid #E2E8F0", maxWidth: 640, margin: "0 auto" } as React.CSSProperties,
    label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#1E293B", textTransform: "uppercase" as const, letterSpacing: 0.5 } as React.CSSProperties,
    input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 15, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit", background: "#FFFFFF", color: "#1E293B" } as React.CSSProperties,
    select: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 15, outline: "none", boxSizing: "border-box" as const, background: "#FFFFFF", fontFamily: "inherit", color: "#1E293B" } as React.CSSProperties,
  };

  // ===== SIGNED STATE — clean, no download button =====
  if (signed) {
    return (
      <div style={S.card}>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>&#10003;</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#059669", marginBottom: 8 }}>
            {isEs ? "Autorización Firmada" : "Authorization Signed"}
          </div>
          <div style={{ fontSize: 14, color: "#64748B", marginBottom: 24 }}>
            {isEs
              ? `${clientName} — ${dob ? new Date(dob + "T00:00:00").toLocaleDateString("es-US", { day: "numeric", month: "long", year: "numeric" }) : ""}`
              : `${clientName} — ${dob}`}
          </div>

          {generating && (
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 16 }}>
              {isEs ? "Procesando..." : "Processing..."}
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={generating}
            style={{
              display: "block", width: "100%", padding: "15px 28px", borderRadius: 10,
              border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer",
              fontFamily: "inherit", background: "#0D9488", color: "#fff", minHeight: 48,
              opacity: generating ? 0.5 : 1,
            }}
          >
            {isEs ? "Comenzar Cotización →" : "Start Quote →"}
          </button>
        </div>
      </div>
    );
  }

  // ===== FORM STATE =====
  return (
    <div style={S.card}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#1E3A5F", letterSpacing: 0.3 }}>
          {isEs ? "AUTORIZACIÓN PARA COTIZACIÓN" : "QUOTE AUTHORIZATION"}
        </div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>
          {isEs ? "Requerida antes de iniciar la cotización" : "Required before starting the quote"}
        </div>
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.8, color: "#374151", marginBottom: 20 }}>
        {isEs ? "Yo, " : "I, "}
        <strong>{clientName || (isEs ? "[Nombre del Cliente]" : "[Client Name]")}</strong>
        {isEs
          ? " estoy solicitando asistencia para recibir una COTIZACIÓN de Seguro de Salud por Medio del Mercado de Seguros Médicos. Certifico que he recibido y entendido la asesoría brindada por:"
          : " am requesting assistance to receive a Health Insurance QUOTE through the Health Insurance Marketplace. I certify that I have received and understood the advice provided by:"}
      </div>

      <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, border: "1px solid #E2E8F0", marginBottom: 24 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 32px", fontSize: 13, color: "#374151" }}>
          <div><span style={{ fontWeight: 700 }}>{isEs ? "Agente Autorizado" : "Authorized Agent"}:</span> {agentName}</div>
          <div><span style={{ fontWeight: 700 }}>NPN:</span> {agentNPN}</div>
          <div><span style={{ fontWeight: 700 }}>{isEs ? "Teléfono" : "Phone"}:</span> {agentPhone}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={S.label}>{isEs ? "Nombre" : "First Name"} <span style={{ color: "#DC2626" }}>*</span></label>
          <input style={{ ...S.input, borderColor: showError && !firstValid ? "#ef4444" : "#E2E8F0" }} value={firstName} onChange={(e) => { setFirstName(e.target.value); setShowError(false); }} placeholder={isEs ? "Nombre" : "First name"} />
        </div>
        <div>
          <label style={S.label}>{isEs ? "Apellido" : "Last Name"} <span style={{ color: "#DC2626" }}>*</span></label>
          <input style={{ ...S.input, borderColor: showError && !lastValid ? "#ef4444" : "#E2E8F0" }} value={lastName} onChange={(e) => { setLastName(e.target.value); setShowError(false); }} placeholder={isEs ? "Apellido" : "Last name"} />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={S.label}>{isEs ? "Fecha de Nacimiento" : "Date of Birth"} <span style={{ color: "#DC2626" }}>*</span></label>
        <DobSelect
          id="precarta-dob"
          value={dob}
          onChange={(v) => { setDob(v); setShowError(false); }}
          lang={lang}
          selectStyle={S.select}
          labelStyle={{ ...S.label, fontSize: 10, marginBottom: 3 }}
        />
        {showError && !dobValid && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{isEs ? "Fecha de nacimiento requerida" : "Date of birth required"}</div>}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={S.label}>{isEs ? "Firma" : "Signature"} <span style={{ color: "#DC2626" }}>*</span></label>
          <button type="button" onClick={clearSig} style={{ fontSize: 12, color: "#64748B", background: "none", border: "1px solid #CBD5E1", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            {isEs ? "Limpiar" : "Clear"}
          </button>
        </div>
        <div style={{ border: showError && !hasSig ? "2px solid #ef4444" : "2px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff", touchAction: "none" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: 120, display: "block", cursor: "crosshair" }} />
        </div>
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
          {isEs ? "Dibuje su firma con el dedo o ratón" : "Draw your signature with finger or mouse"}
        </div>
        {showError && !hasSig && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{isEs ? "Se requiere firma" : "Signature required"}</div>}
      </div>

      <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.6, marginBottom: 20 }}>
        {isEs
          ? "Al firmar, autorizo al agente mencionado a recopilar mi información personal únicamente para el propósito de generar una cotización de seguro de salud a través del Mercado de Seguros."
          : "By signing, I authorize the mentioned agent to collect my personal information solely for the purpose of generating a health insurance quote through the Marketplace."}
      </div>

      <button
        onClick={handleSubmit}
        style={{
          width: "100%", padding: "15px 28px", borderRadius: 10, border: "none",
          fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          background: "#0D9488", color: "#fff", minHeight: 48,
        }}
      >
        {isEs ? "Firmar y Comenzar Cotización →" : "Sign & Start Quote →"}
      </button>
    </div>
  );
}
