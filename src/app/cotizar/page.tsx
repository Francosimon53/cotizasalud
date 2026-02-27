"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { saveLead, saveConsent, savePlanSelection } from "@/lib/save-lead";
import { i18n, type Lang, type Translations } from "@/lib/i18n";
import { lookupCounties, getFPL, getFPLpct } from "@/lib/data";
import { generateQuote } from "@/lib/plans";
import type { County, HouseholdMember, Plan, QuoteResults, AgentBrand } from "@/lib/types";
import AIPlanAdvisor from "./AIPlanAdvisor";
import CMSConsentForm, { type ConsentRecord } from "./CMSConsentForm";

// ==================== URL PARSER ====================
function parseSmartLink() {
  if (typeof window === "undefined") return { name: "", zip: "", phone: "", email: "", source: "direct", agentSlug: "", utm_source: "", utm_medium: "", utm_campaign: "", lang: "" };
  const p = new URLSearchParams(window.location.search);
  const path = window.location.pathname;
  const slugMatch = path.match(/\/q\/([a-zA-Z0-9_-]+)/);
  return {
    name: p.get("n") || p.get("name") || "",
    zip: p.get("z") || p.get("zip") || "",
    phone: p.get("p") || p.get("phone") || "",
    email: p.get("e") || p.get("email") || "",
    source: p.get("src") || p.get("source") || "direct",
    agentSlug: slugMatch?.[1] || p.get("agent") || "",
    utm_source: p.get("utm_source") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_campaign: p.get("utm_campaign") || "",
    lang: p.get("lang") || "",
  };
}

// ==================== SMALL COMPONENTS ====================
function Stars({ n }: { n: number }) {
  return (
    <span style={{ fontSize: 13, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= n ? "#f59e0b" : "#2a2d3a" }}>★</span>
      ))}
    </span>
  );
}

function Badge({ metal, t }: { metal: string; t: Record<string, string> }) {
  const c: Record<string, string> = {
    catastrophic: "#6b7280", bronze: "#92400e", silver: "#9ca3af", gold: "#b45309", platinum: "#4338ca",
  };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 4, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: "#fff", backgroundColor: c[metal] || "#6b7280" }}>
      {t[metal] || metal}
    </span>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, margin: "0 0 24px" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? "#10b981" : "#1a1c26", transition: "all .3s" }} />
      ))}
    </div>
  );
}

function StepLabel({ num, label }: { num: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#10b981", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{num}</div>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#10b981" }}>{label}</span>
    </div>
  );
}

// ==================== SUBSIDY CLIFF ALERT ====================
function SubsidyCliffAlert({ fplPct, income, houseSize, lang, maxAge, plans }: {
  fplPct: number; income: number; houseSize: number; lang: string; maxAge: number; plans: any[];
}) {
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const aiCalled = useRef(false);
  const isEs = lang === "es";
  const fplBase = 15650 + (houseSize - 1) * 5500;
  const threshold400 = fplBase * 4;
  const excess = income - threshold400;
  const buffer = threshold400 - income;
  const isFamily = houseSize >= 2;
  const hsaLimit = isFamily ? 8550 : 4300;

  type Zone = "medicaid" | "max" | "moderate" | "yellow" | "red";
  let zone: Zone;
  if (fplPct < 138) zone = "medicaid";
  else if (fplPct < 250) zone = "max";
  else if (fplPct < 350) zone = "moderate";
  else if (fplPct <= 400) zone = "yellow";
  else zone = "red";

  const zoneColor = { medicaid: "#60a5fa", max: "#10b981", moderate: "#10b981", yellow: "#fbbf24", red: "#ef4444" }[zone];
  const zoneBorder = { medicaid: "rgba(59,130,246,0.3)", max: "rgba(16,185,129,0.25)", moderate: "rgba(16,185,129,0.25)", yellow: "rgba(251,191,36,0.4)", red: "rgba(239,68,68,0.4)" }[zone];
  const zoneName = isEs
    ? { medicaid: "Posible Medicaid", max: "Subsidio Máximo", moderate: "Subsidio Moderado", yellow: "Zona de Riesgo", red: "Sin Subsidio (Cliff)" }[zone]
    : { medicaid: "Possible Medicaid", max: "Maximum Subsidy", moderate: "Moderate Subsidy", yellow: "Risk Zone", red: "No Subsidy (Cliff)" }[zone];

  const fullPremium = maxAge >= 55 ? 950 : maxAge >= 40 ? 650 : 400;

  // Meter positions
  const meterMax = 520;
  const pctPos = Math.min(Math.max((fplPct - 100) / (meterMax - 100) * 100, 0), 100);
  const zP = (v: number) => ((v - 100) / (meterMax - 100)) * 100;

  // AI call — auto-trigger once
  useEffect(() => {
    if (aiCalled.current || aiText) return;
    aiCalled.current = true;
    setAiLoading(true);

    const hsaPlans = plans.filter((p: any) => p.hsa).slice(0, 3);
    const topPlans = plans.slice(0, 5);
    const planSummary = topPlans.map((p: any) => `${p.name} (${p.metal}) — $${p.afterSubsidy}/mo, deductible $${p.deductible.toLocaleString()}${p.hsa ? ", HSA-eligible" : ""}`).join("\n");

    const sysPrompt = isEs
      ? `Eres un asesor de seguros de salud amigable y bilingüe que ayuda a una persona real a entender su situación financiera para el seguro médico ACA en 2026.

REGLAS CRÍTICAS:
- Habla como un amigo o familiar que se preocupa por ti, NO como un asesor financiero
- NUNCA uses siglas como MAGI, FPL, APTC, ACA, IRA sin explicarlas primero en lenguaje simple
- En lugar de "MAGI" di "tu ingreso ajustado para el gobierno"
- En lugar de "FPL" di "el límite de pobreza federal"
- En lugar de "APTC" di "la ayuda del gobierno para pagar tu seguro"
- En lugar de "HSA" di "cuenta de ahorros médicos (HSA)" la primera vez, luego solo "cuenta de ahorros médicos"
- En lugar de "subsidio" di "la ayuda del gobierno" o "el descuento del gobierno"
- Usa analogías del mundo real y ejemplos con los números de esta persona
- Da UNA recomendación clara al final: "Lo que yo te recomiendo hacer:"
- Usa "tú" no "usted"
- Máximo 350 palabras

FORMATO:
## Tu Situación
Un párrafo explicando dónde estás (usa sus números reales)

## Qué Significa Para Ti
Qué significa esto en términos prácticos (costo mensual, qué pueden/no pueden obtener)

## Lo Que Te Recomiendo
UNA recomendación clara y accionable con pasos exactos. Si es relevante, incluye un ejemplo con números: "Por ejemplo: Si depositas $X en [tipo de cuenta], tu ingreso baja a $Y y recuperas el descuento."`
      : `You are a friendly bilingual health insurance advisor helping a real person understand their financial situation for ACA health insurance in 2026.

CRITICAL RULES:
- Speak like a caring friend or family member, NOT a financial advisor
- NEVER use acronyms like MAGI, FPL, APTC, ACA, IRA without explaining them first in simple language
- Instead of "MAGI" say "your adjusted income for the government"
- Instead of "FPL" say "the federal poverty guideline"
- Instead of "APTC" say "the government's help paying for your insurance"
- Instead of "HSA" say "medical savings account (HSA)" the first time, then just "medical savings account"
- Instead of "subsidy" say "government help" or "government discount"
- Use real-world analogies and examples with this person's actual numbers
- Give ONE clear recommendation at the end: "What I recommend you do:"
- Keep it warm and conversational
- Maximum 350 words

FORMAT:
## Your Situation
One paragraph explaining where they stand (use their real numbers)

## What This Means For You
What this means in practical terms (monthly cost, what they can/can't get)

## What I Recommend
ONE clear, actionable recommendation with exact steps. If relevant, include an example: "For example: If you deposit $X into [account type], your income drops to $Y and you get the discount back."`;

    const userPrompt = isEs
      ? `Mi situación:
- Ingreso anual: $${income.toLocaleString()}
- Tamaño del hogar: ${houseSize} persona${houseSize > 1 ? "s" : ""}
- Porcentaje del límite de pobreza: ${fplPct}%
- Límite para ayuda del gobierno (400%): $${threshold400.toLocaleString()}
- ${zone === "red" ? `Estoy $${excess.toLocaleString()} POR ENCIMA del límite — NO recibo ayuda` : zone === "yellow" ? `Estoy a solo $${buffer.toLocaleString()} del límite — en riesgo` : zone === "max" ? "Estoy en la mejor zona — máxima ayuda disponible" : zone === "moderate" ? "Recibo ayuda moderada" : "Podría calificar para Medicaid"}
- Persona mayor del hogar: ${maxAge} años
- ${isFamily ? "Familia" : "Individual"}
- Límite de cuenta de ahorros médicos: $${hsaLimit.toLocaleString()}/año
- Prima completa estimada (sin ayuda): ~$${fullPremium}/mes

Planes disponibles (los mejores 5):
${planSummary}

${hsaPlans.length > 0 ? `Planes elegibles para cuenta de ahorros médicos: ${hsaPlans.map((p: any) => p.name).join(", ")}` : "Ningún plan elegible para cuenta de ahorros médicos en los primeros resultados"}

Explícame mi situación y qué debo hacer.`
      : `My situation:
- Annual income: $${income.toLocaleString()}
- Household size: ${houseSize} person${houseSize > 1 ? "s" : ""}
- Federal poverty percentage: ${fplPct}%
- Government help limit (400%): $${threshold400.toLocaleString()}
- ${zone === "red" ? `I'm $${excess.toLocaleString()} ABOVE the limit — I get NO help` : zone === "yellow" ? `I'm only $${buffer.toLocaleString()} from the limit — at risk` : zone === "max" ? "I'm in the best zone — maximum help available" : zone === "moderate" ? "I receive moderate help" : "I may qualify for Medicaid"}
- Oldest person in household: ${maxAge} years old
- ${isFamily ? "Family" : "Individual"}
- Medical savings account limit: $${hsaLimit.toLocaleString()}/year
- Estimated full premium (no help): ~$${fullPremium}/mo

Available plans (top 5):
${planSummary}

${hsaPlans.length > 0 ? `Plans eligible for medical savings account: ${hsaPlans.map((p: any) => p.name).join(", ")}` : "No medical savings account eligible plans in top results"}

Explain my situation and what I should do.`;

    fetch("/api/ai-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system: sysPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    })
      .then((r) => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then((data) => { setAiText(data.content?.map((c: any) => c.text || "").join("") || ""); })
      .catch(() => setAiError(true))
      .finally(() => setAiLoading(false));
  }, []);

  // Render AI text with simple markdown
  const renderAI = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) {
        const t = line.replace(/^##\s+/, "").replace(/\*\*/g, "");
        const isRec = t.includes("Recomiendo") || t.includes("Recommend");
        return <div key={i} style={{ fontSize: 14, fontWeight: 800, color: isRec ? "#10b981" : "#f0f1f5", marginTop: i > 0 ? 16 : 0, marginBottom: 6 }}>{t}</div>;
      }
      if (!line.trim()) return <div key={i} style={{ height: 4 }} />;
      // Inline bold
      const parts: React.ReactNode[] = [];
      let last = 0;
      const re = /\*\*(.*?)\*\*/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        if (m.index > last) parts.push(<span key={`t${i}-${last}`}>{line.slice(last, m.index)}</span>);
        parts.push(<strong key={`b${i}-${m.index}`} style={{ color: "#f0f1f5" }}>{m[1]}</strong>);
        last = m.index + m[0].length;
      }
      if (last < line.length) parts.push(<span key={`e${i}-${last}`}>{line.slice(last)}</span>);
      const isRecLine = line.includes("Recomiendo") || line.includes("recommend") || line.includes("ejemplo:") || line.includes("example:");
      return (
        <div key={i} style={{
          fontSize: 13, lineHeight: 1.7, color: "#8b8fa3", marginBottom: 2,
          ...(isRecLine ? { background: "rgba(16,185,129,0.08)", borderRadius: 6, padding: "6px 10px", borderLeft: "3px solid #10b981", marginTop: 4, marginBottom: 4 } : {}),
        }}>
          {parts.length > 0 ? parts : line}
        </div>
      );
    });
  };

  return (
    <div style={{ background: "#12141c", border: `1px solid ${zoneBorder}`, borderRadius: 12, marginBottom: 18, overflow: "hidden" }}>
      {/* Title bar */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f0f1f5", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          {isEs ? "Tu Asesor Financiero de Salud" : "Your Health Financial Advisor"}
        </div>
        <div style={{ fontSize: 11, color: "#5a5e72", marginTop: 3 }}>
          {isEs ? "Análisis personalizado de tu situación" : "Personalized analysis of your situation"}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* FPL METER — kept */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", height: 14, borderRadius: 7, background: "rgba(255,255,255,0.04)", overflow: "visible" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${zP(250)}%`, borderRadius: "7px 0 0 7px", background: "rgba(16,185,129,0.35)" }} />
            <div style={{ position: "absolute", left: `${zP(250)}%`, top: 0, bottom: 0, width: `${zP(300) - zP(250)}%`, background: "rgba(16,185,129,0.2)" }} />
            <div style={{ position: "absolute", left: `${zP(300)}%`, top: 0, bottom: 0, width: `${zP(350) - zP(300)}%`, background: "rgba(251,191,36,0.25)" }} />
            <div style={{ position: "absolute", left: `${zP(350)}%`, top: 0, bottom: 0, width: `${zP(400) - zP(350)}%`, background: "rgba(249,115,22,0.35)" }} />
            <div style={{ position: "absolute", left: `${zP(400)}%`, top: 0, bottom: 0, right: 0, borderRadius: "0 7px 7px 0", background: "rgba(239,68,68,0.35)" }} />
            <div style={{ position: "absolute", left: `${zP(400)}%`, top: -6, bottom: -6, width: 2, background: "#ef4444", zIndex: 2 }} />
            <div style={{ position: "absolute", left: `${pctPos}%`, top: "50%", transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: 9, background: "#fff", border: `3px solid ${zoneColor}`, zIndex: 3, boxShadow: `0 0 10px ${zoneColor}60` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "#5a5e72", fontWeight: 600 }}>
            <span style={{ color: "#10b981" }}>138%</span>
            <span>250%</span>
            <span>300%</span>
            <span>350%</span>
            <span style={{ color: "#ef4444", fontWeight: 800 }}>400%</span>
            <span>500%+</span>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#8b8fa3" }}>
            {isEs ? "Tu posición" : "Your position"}: <strong style={{ color: zoneColor, fontSize: 14 }}>{fplPct}%</strong> — <span style={{ color: zoneColor, fontWeight: 600 }}>{zoneName}</span>
          </div>
        </div>

        {/* AI EXPLANATION */}
        <div style={{ borderLeft: `4px solid ${zoneBorder}`, borderRadius: 8, background: "rgba(255,255,255,0.02)", padding: 16 }}>
          {aiLoading && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 32, height: 32, border: "3px solid rgba(16,185,129,0.2)", borderTopColor: "#10b981", borderRadius: "50%", animation: "aispin 0.8s linear infinite", margin: "0 auto 10px" }} />
              <div style={{ color: "#10b981", fontWeight: 700, fontSize: 13 }}>
                🧠 {isEs ? "Analizando tu situación financiera..." : "Analyzing your financial situation..."}
              </div>
              <div style={{ color: "#5a5e72", fontSize: 11, marginTop: 4 }}>
                {isEs ? "Preparando recomendaciones personalizadas" : "Preparing personalized recommendations"}
              </div>
              <style>{`@keyframes aispin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {aiError && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 700, marginBottom: 8 }}>
                {isEs ? "No se pudo generar el análisis" : "Could not generate analysis"}
              </div>
              <button onClick={() => { setAiError(false); aiCalled.current = false; }} style={{
                padding: "8px 20px", borderRadius: 8, border: "none", background: "#10b981",
                color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
              }}>{isEs ? "Reintentar" : "Retry"}</button>
            </div>
          )}

          {aiText && (
            <div style={{ wordBreak: "break-word" }}>
              {renderAI(aiText)}
            </div>
          )}
        </div>

        {/* Technical details toggle */}
        <div style={{ marginTop: 14, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <button
            onClick={() => setTechOpen(!techOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#5a5e72" }}>
              📊 {isEs ? "Ver datos técnicos detallados" : "View detailed technical data"}
            </span>
            <span style={{ fontSize: 10, color: "#5a5e72", transition: "transform .2s", transform: techOpen ? "rotate(180deg)" : "none" }}>▼</span>
          </button>
          <div style={{ maxHeight: techOpen ? 2000 : 0, overflow: "hidden", transition: "max-height .4s ease" }}>
            <div style={{ padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "#6b7280" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>FPL%</div><div style={{ fontSize: 18, fontWeight: 800, color: zoneColor, marginTop: 2 }}>{fplPct}%</div></div>
                <div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{isEs ? "Límite 400%" : "400% Limit"}</div><div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 2 }}>${threshold400.toLocaleString()}</div></div>
                <div><div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{zone === "red" ? (isEs ? "Exceso" : "Excess") : (isEs ? "Margen" : "Buffer")}</div><div style={{ fontSize: 18, fontWeight: 800, color: zone === "red" ? "#ef4444" : "#fbbf24", marginTop: 2 }}>${(zone === "red" ? excess : buffer).toLocaleString()}</div></div>
              </div>
              <div style={{ marginBottom: 8, fontSize: 11 }}>
                <strong style={{ color: "#8b8fa3" }}>MAGI {isEs ? "reducción opciones" : "reduction options"}:</strong>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                • HSA ({isFamily ? (isEs ? "familia" : "family") : "individual"}): ${hsaLimit.toLocaleString()}/{isEs ? "año" : "yr"}<br />
                • IRA: ${(maxAge >= 50 ? 8000 : 7000).toLocaleString()}/{isEs ? "año" : "yr"}<br />
                • 401(k): $23,500/{isEs ? "año" : "yr"}<br />
                • {isEs ? "Prima completa est." : "Est. full premium"}: ~${fullPremium}/{isEs ? "mes" : "mo"}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: "#3a3d4a" }}>
                {isEs ? "Fuente" : "Source"}: IRS.gov, Healthcare.gov, KFF.org
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 10, fontSize: 10, color: "#3a3d4a", lineHeight: 1.5, textAlign: "center" }}>
          ⚠️ {isEs
            ? "Explicación generada por IA con fines educativos. Consulta con un profesional para decisiones fiscales."
            : "AI-generated explanation for educational purposes. Consult a professional for tax decisions."}
        </div>
      </div>
    </div>
  );
}

// ==================== STYLES ====================
const S = {
  app: { fontFamily: "'Satoshi', 'DM Sans', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#08090d", color: "#f0f1f5" } as React.CSSProperties,
  hdr: { background: "linear-gradient(135deg, #08090d 0%, #0e1018 60%, #12141c 100%)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
  logo: { color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  logoIcon: { width: 30, height: 30, borderRadius: 7, background: "rgba(16,185,129,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 } as React.CSSProperties,
  langBtn: { padding: "5px 12px", borderRadius: 5, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  hero: { background: "linear-gradient(135deg, #08090d 0%, #0e1018 60%, #12141c 100%)", padding: "12px 20px 44px", textAlign: "center" as const } as React.CSSProperties,
  wrap: { maxWidth: 640, margin: "-24px auto 0", padding: "0 14px 40px", position: "relative" as const } as React.CSSProperties,
  card: { background: "#12141c", borderRadius: 14, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.2), 0 8px 20px rgba(0,0,0,.15)", border: "1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
  label: { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#8b8fa3", textTransform: "uppercase" as const, letterSpacing: 0.5 } as React.CSSProperties,
  input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit", background: "#0e1018", color: "#f0f1f5" } as React.CSSProperties,
  select: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.1)", fontSize: 15, outline: "none", boxSizing: "border-box" as const, background: "#0e1018", fontFamily: "inherit", color: "#f0f1f5" } as React.CSSProperties,
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 28px", borderRadius: 9, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  pri: { background: "#10b981", color: "#fff" },
  sec: { background: "#181a24", color: "#8b8fa3" },
  dis: { background: "#1a1c26", color: "#5a5e72", cursor: "not-allowed" },
  row: { display: "flex", gap: 10 } as React.CSSProperties,
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } as React.CSSProperties,
  g4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 } as React.CSSProperties,
  memberCard: { background: "#0e1018", borderRadius: 10, padding: 16, marginBottom: 12, border: "1px solid rgba(255,255,255,0.06)" } as React.CSSProperties,
  stat: { background: "#0e1018", borderRadius: 8, padding: "9px 10px", textAlign: "center" as const } as React.CSSProperties,
  statL: { fontSize: 9, color: "#5a5e72", textTransform: "uppercase" as const, fontWeight: 700, letterSpacing: 0.5 } as React.CSSProperties,
  statV: { fontSize: 16, fontWeight: 800, color: "#f0f1f5", marginTop: 1 } as React.CSSProperties,
  planCard: { background: "#12141c", borderRadius: 11, padding: 18, marginBottom: 12, border: "1.5px solid rgba(255,255,255,0.06)", cursor: "pointer" } as React.CSSProperties,
  planExp: { background: "#12141c", borderRadius: 11, padding: 18, marginBottom: 12, border: "2px solid #10b981", boxShadow: "0 4px 16px rgba(16,185,129,.1)" } as React.CSSProperties,
  alert: { background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 13, color: "#fbbf24", lineHeight: 1.5 } as React.CSSProperties,
  subBanner: { background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 18, marginBottom: 18, textAlign: "center" as const } as React.CSSProperties,
  tyCard: { background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05))", borderRadius: 14, padding: 32, textAlign: "center" as const, border: "1px solid rgba(16,185,129,0.2)" } as React.CSSProperties,
  footer: { textAlign: "center" as const, padding: "24px 14px", fontSize: 10, color: "#5a5e72", lineHeight: 1.6, maxWidth: 640, margin: "0 auto" } as React.CSSProperties,
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px", borderRadius: 20, border: `1.5px solid ${active ? "#10b981" : "rgba(255,255,255,0.1)"}`,
  fontSize: 11, fontWeight: 700, cursor: "pointer", background: active ? "rgba(16,185,129,0.1)" : "#12141c",
  color: active ? "#10b981" : "#5a5e72",
});

// ==================== MAIN COMPONENT ====================
export default function QuoterPage() {
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState(1);
  const [zip, setZip] = useState("");
  const [counties, setCounties] = useState<County[]>([]);
  const [county, setCounty] = useState<County | null>(null);
  const [house, setHouse] = useState<HouseholdMember[]>([{ age: 30, gender: "Female", tobacco: false }]);
  const [income, setIncome] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadLang, setLeadLang] = useState("es");
  const [consent, setConsent] = useState(false);
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [results, setResults] = useState<QuoteResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("afterSubsidy");
  const [metalFilter, setMetalFilter] = useState("all");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState<ReturnType<typeof parseSmartLink>>({ name: "", zip: "", phone: "", email: "", source: "direct", agentSlug: "", utm_source: "", utm_medium: "", utm_campaign: "", lang: "" });
  const [agentBrand, setAgentBrand] = useState<AgentBrand | null>(null);


  const t: Record<string, string> = i18n[lang];

  // Smart link init
  useEffect(() => {
    const params = parseSmartLink();
    setUrlParams(params);
    if (params.lang === "en" || params.lang === "es") setLang(params.lang);
    if (params.name) setLeadName(decodeURIComponent(params.name));
    if (params.phone) setLeadPhone(params.phone);
    if (params.email) setLeadEmail(decodeURIComponent(params.email));
    if (params.zip && /^\d{5}$/.test(params.zip)) setZip(params.zip);
    if (params.agentSlug) {
      setAgentBrand({ slug: params.agentSlug, name: params.agentSlug, npn: "XXXXXX" });
    }
  }, []);

  // ZIP lookup
  useEffect(() => {
    if (zip.length === 5) {
      const found = lookupCounties(zip);
      setCounties(found);
      if (found.length === 1) setCounty(found[0]);
    } else {
      setCounties([]); setCounty(null);
    }
  }, [zip]);

  // Auto-skip location if ZIP pre-filled
  useEffect(() => {
    if (urlParams.zip && county && step === 1) setStep(2);
  }, [county, urlParams.zip, step]);

  const addPerson = () => house.length < 8 && setHouse([...house, { age: 25, gender: "Female", tobacco: false }]);
  const removePerson = (i: number) => house.length > 1 && setHouse(house.filter((_, j) => j !== i));
  const updatePerson = (i: number, k: keyof HouseholdMember, v: any) => {
    const h = [...house]; h[i] = { ...h[i], [k]: v }; setHouse(h);
  };

  const doSearch = () => {
    if (!county) return;
    setLoading(true);
    setTimeout(() => {
      setResults(generateQuote(county, house, Number(income)));
      setLoading(false);
      setStep(5);
    }, 1400);
  };

  const submitLead = async () => {
    setLoading(true);
    try {
      const result = await saveLead({
        agentSlug: urlParams.agentSlug || undefined,
        zipcode: zip,
        county: county?.name || '',
        state: county?.state || 'FL',
        householdSize: house.length,
        annualIncome: Number(income),
        fplPercentage: getFPLpct(Number(income), house.length),
        ages: house.map((h: any) => h.age).join(','),
        usesTobacco: house.some((h: any) => h.tobacco),
        language: lang,
        contactName: leadName,
        contactPhone: leadPhone,
        contactEmail: leadEmail || undefined,
      });
      if (result.leadId) setLeadId(result.leadId);
    } catch (err) {
      console.error('Failed to save lead:', err);
    }
    setLoading(false);
    doSearch(); // Always go straight to plans
  };

  const handleConsent = async (record: ConsentRecord) => {
    setConsentRecord(record);
    setConsent(true);
    try {
      await saveConsent({
        leadId: leadId || undefined,
        consumerName: record.consumerName,
        consumerSignature: record.signatureDataUrl,
        consentDate: record.consentDate,
        consentDuration: record.consentDuration || '12_months',
        authSearch: false,
        authEnrollment: false,
        authMaintenance: false,
        authInquiries: false,
        eligibilityVerified: record.eligibilityReviewed || false,
        agentName: record.agentName || 'CotizaSalud',
        agentNpn: record.agentNPN || undefined,
      });
    } catch (err) {
      console.error('Failed to save consent:', err);
    }
    setStep(6); // Go to confirm after consent
  };

  const selectPlan = async (plan: Plan) => {
    setSelectedPlanId(plan.id);
    if (leadId) {
      try {
        await savePlanSelection(leadId, {
          id: plan.id, name: plan.name, issuer: plan.issuer,
          metal: plan.metal, premium: plan.premium,
          afterSubsidy: plan.afterSubsidy, deductible: plan.deductible,
        });
      } catch (err) {
        console.error('Failed to save plan selection:', err);
      }
    }
    setTimeout(() => setStep(45), 300);
  };

  const confirmPlan = () => {
    // Production: PATCH /api/leads/{id} with confirmed plan
    // Trigger URGENT notification to agent
    setStep(7); // Step 7 = thank you
  };

  const resetAll = () => {
    setStep(1); setResults(null); setSelectedPlanId(null);
    setConsent(false); setConsentRecord(null); setLeadName(""); setLeadPhone(""); setLeadEmail("");
    setZip(""); setCounty(null); setIncome("");
    setHouse([{ age: 30, gender: "Female", tobacco: false }]);
  };

  const fpl = income ? getFPLpct(Number(income), house.length) : 0;
  const isMedicaid = fpl > 0 && fpl < 138;
  const filtered = results?.plans
    ?.filter((p) => metalFilter === "all" || p.metal === metalFilter)
    .sort((a, b) => sortKey === "rating" ? b.rating - a.rating : (a as any)[sortKey] - (b as any)[sortKey]);

  const brandName = agentBrand?.brand_name || agentBrand?.name || t.title;

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.hdr}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🏥</div>
          <span>{brandName}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {agentBrand && <span style={{ fontSize: 10, color: "rgba(255,255,255,.4)" }}>by {t.title}</span>}
          <button style={S.langBtn} onClick={() => setLang(lang === "en" ? "es" : "en")}>{t.langSwitch}</button>
        </div>
      </div>

      {/* Hero */}
      {step <= 4 && (
        <div style={S.hero}>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2 }}>{t.hero}</div>
          <div style={{ color: "#6ee7b7", fontSize: 22, fontWeight: 800 }}>{t.heroAccent}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 8 }}>{t.heroSub}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 600 }}>🛡️ {t.trustBadge}</div>
        </div>
      )}
      {step === 45 && !consentRecord && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{lang === "es" ? "📋 Autorización CMS" : "📋 CMS Authorization"}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{lang === "es" ? "Firma digital requerida para continuar" : "Digital signature required to continue"}</div>
        </div>
      )}
      {step === 5 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{t.s4}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>
            {county?.name}, {county?.state} · {house.length}p · ${Number(income).toLocaleString()}{lang === "es" ? "/año" : "/yr"} ({fpl}% FPL)
          </div>
        </div>
      )}
      {step === 6 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{t.confirmTitle || "Confirma tu plan"}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{t.confirmSub || "Review the details before confirming"}</div>
        </div>
      )}
      {step === 7 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>{t.tyTitle}</div>
        </div>
      )}

      {/* Content */}
      <div style={S.wrap}>
        {/* Step 1: Location */}
        {step === 1 && (
          <div style={S.card}>
            <StepLabel num={1} label={t.s1} />
            <Progress step={1} total={4} />
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>{t.zip}</label>
              <input style={S.input} type="text" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} placeholder={t.zipPh} autoFocus />
            </div>
            {counties.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>{t.county}</label>
                <select style={S.select} value={county?.fips || ""} onChange={(e) => setCounty(counties.find((c) => c.fips === e.target.value) || null)}>
                  <option value="">{t.pickCounty}</option>
                  {counties.map((c) => <option key={c.fips} value={c.fips}>{c.name}, {c.state}</option>)}
                </select>
              </div>
            )}
            {county && <div style={{ fontSize: 13, color: "#10b981", marginBottom: 18, fontWeight: 600 }}>📍 {county.name}, {county.state}</div>}
            <button style={{ ...S.btn, ...(county ? S.pri : S.dis), width: "100%" }} disabled={!county} onClick={() => setStep(2)}>{t.next}</button>
          </div>
        )}

        {/* Step 2: Household */}
        {step === 2 && (
          <div style={S.card}>
            <StepLabel num={2} label={t.s2} />
            <Progress step={2} total={4} />
            {house.map((m, i) => (
              <div key={i} style={S.memberCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#10b981" }}>{t.person} {i + 1}</span>
                  {i > 0 && <button style={{ ...S.btn, padding: "3px 10px", fontSize: 11, color: "#ef4444", background: "transparent" }} onClick={() => removePerson(i)}>{t.removePerson}</button>}
                </div>
                <div style={S.g3}>
                  <div><label style={S.label}>{t.age}</label><input style={S.input} type="number" min={0} max={120} value={m.age} onChange={(e) => updatePerson(i, "age", parseInt(e.target.value) || 0)} /></div>
                  <div><label style={S.label}>{t.gender}</label><select style={S.select} value={m.gender} onChange={(e) => updatePerson(i, "gender", e.target.value)}><option value="Female">{t.female}</option><option value="Male">{t.male}</option></select></div>
                  <div><label style={S.label}>{t.tobacco}</label><select style={S.select} value={m.tobacco ? "y" : "n"} onChange={(e) => updatePerson(i, "tobacco", e.target.value === "y")}><option value="n">{t.no}</option><option value="y">{t.yes}</option></select></div>
                </div>
              </div>
            ))}
            <button style={{ ...S.btn, ...S.sec, width: "100%", marginBottom: 14, fontSize: 13 }} onClick={addPerson}>{t.addPerson}</button>
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(1)}>{t.back}</button>
              <button style={{ ...S.btn, ...S.pri, flex: 2 }} onClick={() => setStep(3)}>{t.next}</button>
            </div>
          </div>
        )}

        {/* Step 3: Income */}
        {step === 3 && (
          <div style={S.card}>
            <StepLabel num={3} label={t.s3} />
            <Progress step={3} total={4} />
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>{t.income}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#5a5e72", fontWeight: 700 }}>$</span>
                <input style={{ ...S.input, paddingLeft: 26 }} type="text" value={income ? Number(income).toLocaleString() : ""} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} placeholder={t.incomePh} />
              </div>
            </div>
            {income && (
              <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#10b981" }}>
                <strong>{t.fplLabel}:</strong> {fpl}% FPL
                <span style={{ color: "#5a5e72", marginLeft: 6 }}>(${getFPL(house.length).toLocaleString()} / {house.length}p)</span>
              </div>
            )}
            {isMedicaid && <div style={S.alert}>⚠️ {t.medicaidMsg}</div>}
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(2)}>{t.back}</button>
              <button style={{ ...S.btn, ...(income && +income > 0 ? S.pri : S.dis), flex: 2 }} disabled={!income || +income <= 0} onClick={() => setStep(4)}>{t.next}</button>
            </div>
          </div>
        )}

        {/* Step 4: Lead Gate */}
        {step === 4 && (
          <div style={S.card}>
            <StepLabel num={4} label={t.sL} />
            <Progress step={4} total={4} />
            <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981", marginBottom: 4 }}>{t.leadTitle}</div>
            <div style={{ fontSize: 13, color: "#5a5e72", marginBottom: 20, lineHeight: 1.5 }}>{t.leadSub}</div>
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t.fullName}</label>
              <input style={S.input} value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder={t.namePh} autoFocus={!leadName} />
            </div>
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div><label style={S.label}>{t.phone}</label><input style={S.input} type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder={t.phonePh} /></div>
              <div><label style={S.label}>{t.email}</label><input style={S.input} type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={t.emailPh} /></div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={S.label}>{t.prefLang}</label>
              <div style={{ ...S.row, gap: 8 }}>
                {(["es", "en"] as const).map((l) => (
                  <button key={l} style={chip(leadLang === l)} onClick={() => setLeadLang(l)}>
                    {l === "es" ? "🇪🇸 Español" : "🇺🇸 English"}
                  </button>
                ))}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#8b8fa3", lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#10b981", cursor: "pointer" }} />
              {t.consent}
            </label>
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(3)}>{t.back}</button>
              <button style={{ ...S.btn, ...(leadName && leadPhone && consent ? S.pri : S.dis), flex: 2 }} disabled={!leadName || !leadPhone || !consent || loading} onClick={submitLead}>
                {loading ? t.saving : t.seeMyPlans}
              </button>
            </div>
          </div>
        )}

        {/* Step 4.5: CMS Consent Form */}
        {step === 45 && !consentRecord && (
          <CMSConsentForm
            consumerName={leadName}
            consumerPhone={leadPhone}
            consumerEmail={leadEmail}
            agentName={agentBrand?.name}
            agentNPN={agentBrand?.npn}
            agencyName={agentBrand?.brand_name}
            selectedPlan={selectedPlanId && results ? (() => {
              const p = results.plans.find((pl: any) => pl.id === selectedPlanId);
              return p ? { name: p.name, issuer: p.issuer, metal: p.metal, premium: p.premium, afterSubsidy: p.afterSubsidy, deductible: p.deductible } : undefined;
            })() : undefined}
            lang={lang}
            t={t}
            onConsent={handleConsent}
            onBack={() => setStep(5)}
          />
        )}

        {/* Step 5: Plans */}
        {step === 5 && results && (
          <div>
            <style>{`@keyframes hsa-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } 50% { box-shadow: 0 0 12px 2px rgba(16,185,129,0.15); } }`}</style>
            {/* Subsidy Cliff Alert */}
            <SubsidyCliffAlert fplPct={fpl} income={Number(income)} houseSize={house.length} lang={lang} maxAge={Math.max(...house.map(h => h.age))} plans={filtered || results.plans} />

            {results.aptc > 0 && (
              <div style={S.subBanner}>
                <div style={{ fontSize: 12, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{t.subsidyLabel}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#10b981", letterSpacing: -1 }}>${results.aptc}<span style={{ fontSize: 16, fontWeight: 600 }}>{t.mo}</span></div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {["all", "bronze", "silver", "gold", "platinum"].map((m) => (
                <button key={m} style={chip(metalFilter === m)} onClick={() => setMetalFilter(m)}>{t[m] || m}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "#5a5e72", fontWeight: 700 }}>{t.sort}:</span>
              <select style={{ ...S.select, width: "auto", padding: "5px 10px", fontSize: 12 }} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="afterSubsidy">{t.sortPremium}</option>
                <option value="deductible">{t.sortDeduct}</option>
                <option value="oopMax">{t.sortOop}</option>
                <option value="rating">{t.sortRate}</option>
              </select>
              <span style={{ fontSize: 12, color: "#5a5e72", marginLeft: "auto" }}>{filtered?.length} {t.planCount}</span>
            </div>
            {filtered?.map((plan) => {
              const exp = expandedPlan === plan.id;
              return (
                <div key={plan.id} style={exp ? S.planExp : S.planCard} onClick={() => setExpandedPlan(exp ? null : plan.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <Badge metal={plan.metal} t={t} />
                      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 7, color: "#f0f1f5", lineHeight: 1.3 }}>{plan.name}</div>
                      <div style={{ fontSize: 11, color: "#5a5e72", marginTop: 2 }}>{plan.issuer}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {plan.aptc > 0 && <div style={{ fontSize: 11, color: "#5a5e72", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#10b981", letterSpacing: -0.5 }}>${plan.afterSubsidy}</div>
                      <div style={{ fontSize: 10, color: "#5a5e72" }}>{t.mo}</div>
                    </div>
                  </div>
                  <div style={S.g4}>
                    <div style={S.stat}><div style={S.statL}>{t.deductible}</div><div style={{ ...S.statV, fontSize: 14 }}>${plan.deductible.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.oopMax}</div><div style={{ ...S.statV, fontSize: 14 }}>${plan.oopMax.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.quality}</div><Stars n={plan.rating} /></div>
                    {plan.hsa ? (
                      <div style={{
                        ...S.stat,
                        background: fpl >= 350 ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.06)",
                        border: fpl >= 350 ? "1px solid rgba(16,185,129,0.25)" : "none",
                        borderRadius: 8, padding: "8px 10px", gridColumn: "1 / -1",
                        ...(fpl >= 350 ? { animation: "hsa-glow 2s ease-in-out infinite" } : {}),
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>
                          {fpl >= 350
                            ? (lang === "es" ? "🏦 HSA Elegible — Tu asesor de IA arriba te explica cómo esto te puede ahorrar dinero ☝️" : "🏦 HSA Eligible — Your AI advisor above explains how this can save you money ☝️")
                            : (lang === "es" ? "🏦 HSA Elegible — Cuenta de ahorros médicos libre de impuestos" : "🏦 HSA Eligible — Tax-free medical savings account")}
                        </div>
                      </div>
                    ) : (
                      <div style={S.stat}><div style={S.statL}>HSA</div><div style={{ ...S.statV, fontSize: 14, color: "#2a2d3a" }}>—</div></div>
                    )}
                  </div>
                  {exp && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: 0.5 }}>Copays</div>
                      <div style={S.g4}>
                        <div style={S.stat}><div style={S.statL}>{t.pcp}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.pcp ? `$${plan.pcp}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.specialist}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.specialist ? `$${plan.specialist}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.rx}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.genericRx ? `$${plan.genericRx}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.er}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.er ? `$${plan.er}` : "—"}</div></div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, marginTop: 14, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
                      <div style={S.g3}>
                        <div style={{ ...S.stat, background: "rgba(16,185,129,0.08)" }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yLow.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "rgba(251,191,36,0.08)" }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yMed.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "rgba(239,68,68,0.08)" }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yHigh.toLocaleString()}</div></div>
                      </div>

                      {/* HSA Simple Badge */}
                      {plan.hsa && (
                        <div style={{
                          marginTop: 12, background: "rgba(16,185,129,0.08)", borderRadius: 8,
                          padding: "10px 14px", border: "1px solid rgba(16,185,129,0.15)",
                          display: "flex", alignItems: "center", gap: 8,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981", lineHeight: 1.5 }}>
                            {fpl >= 350
                              ? (lang === "es" ? "🏦 HSA Elegible — Tu asesor de IA arriba te explica cómo esto te puede ahorrar dinero ☝️" : "🏦 HSA Eligible — Your AI advisor above explains how this can save you money ☝️")
                              : (lang === "es" ? "🏦 HSA Elegible — Cuenta de ahorros médicos libre de impuestos" : "🏦 HSA Eligible — Tax-free medical savings account")}
                          </span>
                        </div>
                      )}

                      {/* AI Plan Advisor */}
                      <AIPlanAdvisor
                        plan={plan}
                        household={house}
                        income={Number(income)}
                        fplPct={results?.fplPct || 0}
                        aptc={results?.aptc || 0}
                        lang={lang}
                        t={t}
                      />
                      <button style={{ ...S.btn, ...S.pri, width: "100%", marginTop: 14, fontSize: 14 }} onClick={(e) => { e.stopPropagation(); selectPlan(plan); }}>
                        {t.wantPlan}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <button style={{ ...S.btn, ...S.sec, width: "100%", marginTop: 6 }} onClick={resetAll}>{t.newQuote}</button>
          </div>
        )}

        {/* Step 6: Plan Confirmation Detail */}
        {step === 6 && selectedPlanId && results && (() => {
          const plan = results.plans.find((p: any) => p.id === selectedPlanId);
          if (!plan) return null;
          return (
            <div style={S.card}>
              {/* Plan Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <Badge metal={plan.metal} t={t} />
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "#f0f1f5", lineHeight: 1.2 }}>{plan.name}</div>
                  <div style={{ fontSize: 13, color: "#5a5e72", marginTop: 4 }}>{plan.issuer}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {plan.aptc > 0 && <div style={{ fontSize: 12, color: "#5a5e72", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#10b981", letterSpacing: -1 }}>${plan.afterSubsidy}</div>
                  <div style={{ fontSize: 11, color: "#5a5e72" }}>{t.mo}</div>
                </div>
              </div>

              {/* Subsidy Banner */}
              {plan.aptc > 0 && (
                <div style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.subsidyLabel}</div>
                    <div style={{ fontSize: 11, color: "#5a5e72", marginTop: 2 }}>{t.subsidyApplied || "Applied to your premium"}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>-${plan.aptc}{t.mo}</div>
                </div>
              )}

              {/* Key Numbers */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.planDetails || "Plan Details"}</div>
              <div style={S.g2}>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.premium}</div>
                  <div style={{ ...S.statV, fontSize: 20 }}>${plan.afterSubsidy}<span style={{ fontSize: 11, fontWeight: 600, color: "#5a5e72" }}>{t.mo}</span></div>
                </div>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.deductible}</div>
                  <div style={{ ...S.statV, fontSize: 20 }}>${plan.deductible.toLocaleString()}</div>
                </div>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.oopMax}</div>
                  <div style={{ ...S.statV, fontSize: 20 }}>${plan.oopMax.toLocaleString()}</div>
                </div>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.quality}</div>
                  <div style={{ marginTop: 4 }}><Stars n={plan.rating} /></div>
                </div>
              </div>

              {/* Copays */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: 0.5 }}>Copays</div>
              <div style={S.g4}>
                <div style={S.stat}><div style={S.statL}>{t.pcp}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.pcp ? `$${plan.pcp}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.specialist}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.specialist ? `$${plan.specialist}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.rx}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.genericRx ? `$${plan.genericRx}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.er}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.er ? `$${plan.er}` : "—"}</div></div>
              </div>

              {/* Annual Cost Estimates */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#8b8fa3", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
              <div style={S.g3}>
                <div style={{ ...S.stat, background: "rgba(16,185,129,0.08)", padding: 14 }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yLow.toLocaleString()}</div><div style={{ fontSize: 10, color: "#5a5e72", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "rgba(251,191,36,0.08)", padding: 14 }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yMed.toLocaleString()}</div><div style={{ fontSize: 10, color: "#5a5e72", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "rgba(239,68,68,0.08)", padding: 14 }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yHigh.toLocaleString()}</div><div style={{ fontSize: 10, color: "#5a5e72", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
              </div>

              {/* HSA Simple Badge */}
              {plan.hsa && (
                <div style={{
                  marginTop: 16, background: "rgba(16,185,129,0.08)", borderRadius: 10,
                  padding: "12px 16px", border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981", lineHeight: 1.5 }}>
                    {fpl >= 350
                      ? (lang === "es" ? "🏦 HSA Elegible — Tu asesor de IA en la página de planes te explica cómo esto te puede ahorrar dinero" : "🏦 HSA Eligible — Your AI advisor on the plans page explains how this can save you money")
                      : (lang === "es" ? "🏦 HSA Elegible — Cuenta de ahorros médicos libre de impuestos" : "🏦 HSA Eligible — Tax-free medical savings account")}
                  </span>
                </div>
              )}

              {/* Summary for lead */}
              <div style={{ background: "#0e1018", borderRadius: 10, padding: 16, marginTop: 20, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#5a5e72", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{t.yourInfo || "Your Information"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#8b8fa3" }}>
                  <div>👤 {leadName}</div>
                  <div>📞 {leadPhone}</div>
                  <div>📍 {county?.name}, {county?.state} {zip}</div>
                  <div>👨‍👩‍👧‍👦 {house.length} {t.person?.toLowerCase() || "person"}{house.length > 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <button
                style={{ ...S.btn, ...S.pri, width: "100%", marginTop: 20, fontSize: 16, padding: "16px 28px" }}
                onClick={confirmPlan}
              >
                {t.confirmBtn || "✅ Confirmar — Contactar Agente"}
              </button>
              <button
                style={{ ...S.btn, ...S.sec, width: "100%", marginTop: 10 }}
                onClick={() => { setSelectedPlanId(null); setStep(5); }}
              >
                {t.backToPlans || "← Ver otros planes"}
              </button>
            </div>
          );
        })()}

        {/* Step 7: Thank You */}
        {step === 7 && (
          <div style={S.tyCard}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#10b981", marginBottom: 8 }}>{t.tyTitle}</div>
            <div style={{ fontSize: 14, color: "#10b981", marginBottom: 16, lineHeight: 1.6 }}>{t.tySub}</div>
            {selectedPlanId && results && (() => {
              const plan = results.plans.find((p: any) => p.id === selectedPlanId);
              if (!plan) return null;
              return (
                <div style={{ background: "#0e1018", borderRadius: 10, padding: 16, marginBottom: 16, textAlign: "left", border: "1px solid #d1fae5" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5a5e72", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t.tySelected}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><Badge metal={plan.metal} t={t} /><div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>{plan.name}</div></div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#10b981" }}>${plan.afterSubsidy}<span style={{ fontSize: 12, fontWeight: 600 }}>{t.mo}</span></div>
                  </div>
                </div>
              );
            })()}
            <div style={{ fontSize: 13, color: "#10b981", lineHeight: 1.6 }}>{t.tyDetail}</div>
            <button style={{ ...S.btn, ...S.sec, marginTop: 20 }} onClick={resetAll}>{t.newQuote}</button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ marginBottom: 4 }}>{t.poweredBy}</div>
        <div>{t.disclaimer}</div>
        {agentBrand && <div style={{ marginTop: 4 }}>Agent NPN: {agentBrand.npn}</div>}
      </div>
    </div>
  );
}
