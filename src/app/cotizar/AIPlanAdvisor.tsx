"use client";
import { useState, useEffect, useRef } from "react";

interface AIPlanAdvisorProps {
  plan: any;
  household: Array<{ age: number; gender: string; tobacco: boolean }>;
  income: number;
  fplPct: number;
  aptc: number;
  lang: string;
  t: Record<string, string>;
  householdSize: number;
  fplThreshold400: number;
  isOverCliff: boolean;
  isNearCliff: boolean;
  excessOverCliff: number;
  selectedDrug?: { rxcui: string; name: string } | null;
  drugCoverageStatus?: "covered" | "not_covered" | "unknown" | "checking" | null;
  selectedDoctor?: { npi: string; name: string; specialty: string } | null;
  doctorNetworkStatus?: "in_network" | "not_found" | "checking" | null;
}

export default function AIPlanAdvisor({ plan, household, income, fplPct, aptc, lang, t, householdSize, fplThreshold400, isOverCliff, isNearCliff, excessOverCliff, selectedDrug, drugCoverageStatus, selectedDoctor, doctorNetworkStatus }: AIPlanAdvisorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isFamily = householdSize >= 2;
  const hsaLimit = isFamily ? 8550 : 4300;
  const buffer = fplThreshold400 - income;
  const maxAge = Math.max(...household.map(m => m.age));
  const fullPremium = maxAge >= 55 ? 950 : maxAge >= 40 ? 650 : 400;

  // Estimate 2025 ARP premium (enhanced subsidies capped premiums as % of income, no cliff)
  const show2025 = fplPct > 300;
  let est2025Monthly = 0;
  if (show2025) {
    let pctOfIncome: number;
    if (fplPct <= 150) pctOfIncome = 0;
    else if (fplPct <= 200) pctOfIncome = 0.02;
    else if (fplPct <= 250) pctOfIncome = 0.04;
    else if (fplPct <= 300) pctOfIncome = 0.06;
    else if (fplPct <= 350) pctOfIncome = 0.085;
    else pctOfIncome = 0.085; // 400%+ was still 8.5% under ARP
    est2025Monthly = Math.round((income * pctOfIncome) / 12 / 10) * 10;
  }
  const current2026Monthly = plan.afterSubsidy;
  const monthlyDiff = current2026Monthly - est2025Monthly;
  const annualDiff = monthlyDiff * 12;

  const generateExplanation = async () => {
    setLoading(true);
    setError(false);
    setExplanation("");

    const section2025es = show2025 ? `
## Lo Que Cambió en 2026
INCLUYE ESTA SECCIÓN (3-4 oraciones máximo). Datos que te doy:
- En 2025, esta persona hubiera pagado aproximadamente $${est2025Monthly}/mes por un plan similar gracias a una protección del gobierno que ayudaba a todos.
- En 2026, con este plan paga $${current2026Monthly}/mes — eso son $${monthlyDiff} más al mes ($${annualDiff.toLocaleString()} más al año).
- Explica esto de forma empática: reconoce que duele, explica brevemente que el Congreso no renovó la ley que extendía la ayuda, y luego transiciona a las soluciones: "La buena noticia es que hay formas de recuperar parte de esa ayuda..."
- NO hagas esta sección larga. 3-4 oraciones y pasa a la siguiente sección.
` : "";

    const section2025en = show2025 ? `
## What Changed in 2026
INCLUDE THIS SECTION (3-4 sentences max). Data provided:
- In 2025, this person would have paid approximately $${est2025Monthly}/mo for a similar plan thanks to government protection that helped everyone.
- In 2026, with this plan they pay $${current2026Monthly}/mo — that's $${monthlyDiff} more per month ($${annualDiff.toLocaleString()} more per year).
- Explain empathetically: acknowledge it sucks, briefly explain Congress didn't renew the law that extended help, then transition to solutions: "The good news is there are ways to recover some of that help..."
- Do NOT make this section long. 3-4 sentences then move to the next section.
` : "";

    const systemPrompt = lang === "es"
      ? `Eres un asesor de seguros de salud amigable y bilingüe. Cuando explicas un plan, debes cubrir TODO lo que la persona necesita saber en UNA sola conversación — tanto los detalles del plan COMO su situación financiera.

ESTRUCTURA TU RESPUESTA:

## Resumen Rápido
Qué es este plan, para quién es, costo mensual. Mantenlo simple. 2-3 oraciones.

## Cómo Funciona: Ejemplo Real
Usa un escenario real con los números del plan. Explica como si hablaras con alguien que nunca ha tenido seguro.
${section2025es}
## Tu Situación Financiera con Este Plan
ESTO ES CRÍTICO:
- Explica su situación de descuento del gobierno en lenguaje simple (SIN siglas)
- Si están por encima del límite: explica qué significa para su bolsillo, cuánto más están pagando
- Si este plan es elegible para cuenta de ahorros médicos Y están cerca/por encima del límite: explica exactamente cómo abrir una cuenta de ahorros médicos con este plan podría ayudarles a recuperar el descuento del gobierno. Usa sus números REALES.
- Da un ejemplo concreto: "Si eliges este plan y depositas $X en tu cuenta de ahorros médicos, tu ingreso para el gobierno baja de $Y a $Z. Eso te devuelve el descuento y tu prima podría bajar a $0/mes. Te ahorras $W al año."
- Si están bien por debajo del límite: explica que tienen el descuento del gobierno y cuánto están ahorrando

${selectedDrug || selectedDoctor ? `## Tu Medicamento y Doctor
Si el usuario proporcionó un medicamento y/o doctor, incluye esta sección:
- Di claramente si el medicamento está cubierto o no por este plan
- Di claramente si su doctor está en la red de este plan
- Si alguno NO está cubierto, explica qué opciones tiene
- Mantén esta sección corta: 2-3 oraciones máximo
` : ""}## Lo Que Te Recomiendo
UNA recomendación clara que combine la mejor opción de plan CON la mejor estrategia financiera.${selectedDrug || selectedDoctor ? " Si el medicamento no está cubierto o el doctor no está en la red, incluye eso como factor en tu recomendación." : ""} Si aplica, incluye los pasos exactos.

REGLAS:
- NUNCA uses MAGI, FPL, APTC, ACA, IRA como siglas solas. Siempre explica en lenguaje simple.
- En lugar de "MAGI" di "tu ingreso ajustado para el gobierno"
- En lugar de "subsidio/APTC" di "el descuento del gobierno" o "la ayuda del gobierno"
- En lugar de "HSA" di "cuenta de ahorros médicos (HSA)" la primera vez, luego "cuenta de ahorros médicos"
- Habla como un amigo que se preocupa, usa "tú"
- Usa cifras reales en dólares del plan y del ingreso del usuario
- Máximo 500 palabras
- Si el plan es elegible para cuenta de ahorros médicos y el usuario está por encima/cerca del límite, esto es lo MÁS importante a resaltar
- Usa ## para títulos de sección
- Usa **texto** para resaltar cifras clave
- Usa viñetas (- ) para listas cortas
- Usa UN emoji (✅ o ⚠️) solo al inicio de líneas de veredicto
- NUNCA recomiendes inscribirse sin un agente licenciado`
      : `You are a friendly bilingual health insurance advisor. When explaining a plan, you must cover EVERYTHING the person needs to know in ONE conversation — both the plan details AND their financial situation.

STRUCTURE YOUR RESPONSE:

## Quick Summary
What this plan is, who it's for, monthly cost. Keep it simple. 2-3 sentences.

## How It Works: Real Example
Use a real scenario with actual plan numbers. Explain as if talking to someone who's never had insurance before.
${section2025en}
## Your Financial Situation with This Plan
THIS IS CRITICAL:
- Explain their government discount situation in simple language (NO acronyms)
- If they're over the cliff: explain what that means for their wallet, how much more they're paying
- If this plan is medical savings account eligible AND they're near/over the cliff: explain exactly how opening a medical savings account with this plan could help them get the government discount back. Use their ACTUAL numbers.
- Give a concrete example: "If you choose this plan and deposit $X into your medical savings account, your income for the government drops from $Y to $Z. That gets your discount back and your premium could drop to $0/mo. You save $W per year."
- If they're well under the cliff: explain they have the government discount and how much they're saving

${selectedDrug || selectedDoctor ? `## Your Medication & Doctor
If the user provided a medication and/or doctor, include this section:
- Clearly state whether the medication is covered or not by this plan
- Clearly state whether their doctor is in this plan's network
- If either is NOT covered, explain what options they have
- Keep this section short: 2-3 sentences max
` : ""}## What I Recommend
ONE clear recommendation that combines the best plan choice WITH the best financial strategy.${selectedDrug || selectedDoctor ? " If the medication is not covered or the doctor is not in-network, include that as a factor in your recommendation." : ""} If applicable, include exact steps.

RULES:
- NEVER use MAGI, FPL, APTC, ACA, IRA as standalone acronyms. Always explain in plain language.
- Instead of "MAGI" say "your adjusted income for the government"
- Instead of "subsidy/APTC" say "the government discount" or "government help"
- Instead of "HSA" say "medical savings account (HSA)" first time, then "medical savings account"
- Speak like a caring friend, use "you"
- Use real dollar amounts from the plan and the user's income
- Maximum 500 words
- If the plan is medical savings account eligible and the user is over/near the cliff, this is the MOST important thing to highlight
- Use ## for section headers
- Use **text** to highlight key dollar amounts
- Use bullets (- ) for short lists
- Use ONE emoji (✅ or ⚠️) only at the start of verdict lines
- NEVER recommend enrolling without a licensed agent`;

    const cliffDesc = lang === "es"
      ? (isOverCliff
          ? `ESTOY POR ENCIMA del límite del descuento del gobierno por $${excessOverCliff.toLocaleString()}. NO recibo ninguna ayuda ahora mismo. Pago prima completa (~$${fullPremium}/mes).`
          : isNearCliff
            ? `Estoy a solo $${buffer.toLocaleString()} del límite. EN RIESGO de perder el descuento si mi ingreso sube.`
            : fplPct < 138
              ? "Podría calificar para Medicaid."
              : fplPct < 250
                ? "Recibo la MÁXIMA ayuda del gobierno disponible."
                : "Recibo ayuda moderada del gobierno.")
      : (isOverCliff
          ? `I'm ABOVE the government discount limit by $${excessOverCliff.toLocaleString()}. I get NO help right now. I pay full premium (~$${fullPremium}/mo).`
          : isNearCliff
            ? `I'm only $${buffer.toLocaleString()} from the limit. AT RISK of losing the discount if my income goes up.`
            : fplPct < 138
              ? "I may qualify for Medicaid."
              : fplPct < 250
                ? "I receive MAXIMUM government help available."
                : "I receive moderate government help.");

    const userPrompt = lang === "es"
      ? `Explica este plan de seguro médico Y mi situación financiera de forma clara y personalizada.

**MI FAMILIA:**
${household.map((m, i) => `- Persona ${i + 1}: ${m.age} años, ${m.gender === "Female" ? "Mujer" : "Hombre"}${m.tobacco ? " (usa tabaco)" : ""}`).join("\n")}
- Ingreso anual: $${income.toLocaleString()}
- Tamaño del hogar: ${householdSize} persona${householdSize > 1 ? "s" : ""}
- Porcentaje del límite de pobreza: ${fplPct}%
- Límite para descuento del gobierno (400%): $${fplThreshold400.toLocaleString()}
- ${cliffDesc}
- Descuento mensual estimado: $${aptc}

**EL PLAN:**
- Nombre: ${plan.name}
- Aseguradora: ${plan.issuer}
- Nivel: ${plan.metal}
- Prima mensual: $${plan.premium} → $${plan.afterSubsidy}/mes con descuento
- Deducible: $${plan.deductible.toLocaleString()}
- Máximo de bolsillo: $${plan.oopMax.toLocaleString()}
- Visita médico general: $${plan.pcp} copay
- Visita especialista: $${plan.specialist} copay
- Medicamento genérico: $${plan.genericRx} copay
- Emergencia: $${plan.er} copay
- Calificación: ${plan.rating}/5 estrellas
- Elegible para cuenta de ahorros médicos (HSA): ${plan.hsa ? "SÍ" : "No"}
- Costo anual estimado (uso bajo): $${plan.yLow.toLocaleString()}
- Costo anual estimado (uso medio): $${plan.yMed.toLocaleString()}
- Costo anual estimado (uso alto): $${plan.yHigh.toLocaleString()}

**DATOS FINANCIEROS:**
- Límite de cuenta de ahorros médicos (HSA): $${hsaLimit.toLocaleString()}/año ${isFamily ? "(familia)" : "(individual)"}
- IRA tradicional: $${(maxAge >= 50 ? 8000 : 7000).toLocaleString()}/año
- 401(k): $23,500/año
- Prima completa estimada sin ayuda: ~$${fullPremium}/mes
${show2025 ? `
**COMPARACIÓN 2025 vs 2026:**
- Prima estimada en 2025 (con protección extendida): ~$${est2025Monthly}/mes
- Prima actual en 2026 con este plan: $${current2026Monthly}/mes
- Diferencia: +$${monthlyDiff}/mes (+$${annualDiff.toLocaleString()}/año)
- Razón: El Congreso no renovó la ley que extendía la ayuda del gobierno a más personas.` : ""}

${selectedDrug ? `\n**MI MEDICAMENTO:**\n- Medicamento: ${selectedDrug.name} (RxCUI: ${selectedDrug.rxcui})\n- Cobertura en este plan: ${drugCoverageStatus === "covered" ? "✅ CUBIERTO por este plan" : drugCoverageStatus === "not_covered" ? "❌ NO cubierto por este plan" : "❓ Datos no disponibles — recomendar verificar con la aseguradora"}\n- ${drugCoverageStatus === "covered" ? "Menciona esto como un punto positivo del plan." : drugCoverageStatus === "not_covered" ? "ADVIERTE que este medicamento NO está cubierto y que debería considerar otro plan o verificar alternativas genéricas." : "Recomienda verificar directamente con la aseguradora."}\n` : ""}${selectedDoctor ? `\n**MI DOCTOR:**\n- Doctor: ${selectedDoctor.name}${selectedDoctor.specialty ? ` (${selectedDoctor.specialty})` : ""}\n- Red de este plan: ${doctorNetworkStatus === "in_network" ? "✅ ESTÁ en la red de este plan" : doctorNetworkStatus === "not_found" ? "⚠️ NO se encontró en la red de este plan" : "Verificando..."}\n- ${doctorNetworkStatus === "in_network" ? "Menciona que su doctor está cubierto como punto positivo." : "ADVIERTE que su doctor podría no estar en la red y que debería verificar antes de inscribirse, o considerar otro plan donde sí esté."}\n` : ""}
Explícame todo lo que necesito saber sobre este plan y mi situación financiera en UNA sola explicación.`
      : `Explain this health insurance plan AND my financial situation in a clear, personalized way.

**MY FAMILY:**
${household.map((m, i) => `- Person ${i + 1}: ${m.age} years old, ${m.gender}${m.tobacco ? " (tobacco user)" : ""}`).join("\n")}
- Annual income: $${income.toLocaleString()}
- Household size: ${householdSize} person${householdSize > 1 ? "s" : ""}
- Federal poverty percentage: ${fplPct}%
- Government discount limit (400%): $${fplThreshold400.toLocaleString()}
- ${cliffDesc}
- Estimated monthly discount: $${aptc}

**THE PLAN:**
- Name: ${plan.name}
- Issuer: ${plan.issuer}
- Metal level: ${plan.metal}
- Monthly premium: $${plan.premium} → $${plan.afterSubsidy}/mo with discount
- Deductible: $${plan.deductible.toLocaleString()}
- Out-of-pocket max: $${plan.oopMax.toLocaleString()}
- Doctor visit: $${plan.pcp} copay
- Specialist visit: $${plan.specialist} copay
- Generic Rx: $${plan.genericRx} copay
- Emergency room: $${plan.er} copay
- Quality rating: ${plan.rating}/5 stars
- Medical savings account (HSA) eligible: ${plan.hsa ? "YES" : "No"}
- Est. annual cost (low use): $${plan.yLow.toLocaleString()}
- Est. annual cost (medium use): $${plan.yMed.toLocaleString()}
- Est. annual cost (high use): $${plan.yHigh.toLocaleString()}

**FINANCIAL DATA:**
- Medical savings account (HSA) limit: $${hsaLimit.toLocaleString()}/yr ${isFamily ? "(family)" : "(individual)"}
- Traditional IRA: $${(maxAge >= 50 ? 8000 : 7000).toLocaleString()}/yr
- 401(k): $23,500/yr
- Estimated full premium without help: ~$${fullPremium}/mo
${show2025 ? `
**2025 vs 2026 COMPARISON:**
- Estimated 2025 premium (with extended protection): ~$${est2025Monthly}/mo
- Actual 2026 premium with this plan: $${current2026Monthly}/mo
- Difference: +$${monthlyDiff}/mo (+$${annualDiff.toLocaleString()}/yr)
- Reason: Congress did not renew the law that extended government help to more people.` : ""}

${selectedDrug ? `\n**MY MEDICATION:**\n- Medication: ${selectedDrug.name} (RxCUI: ${selectedDrug.rxcui})\n- Coverage under this plan: ${drugCoverageStatus === "covered" ? "✅ COVERED by this plan" : drugCoverageStatus === "not_covered" ? "❌ NOT covered by this plan" : "❓ Data not available — recommend verifying with the insurer"}\n- ${drugCoverageStatus === "covered" ? "Mention this as a positive point about the plan." : drugCoverageStatus === "not_covered" ? "WARN that this medication is NOT covered and they should consider another plan or check for generic alternatives." : "Recommend verifying directly with the insurer."}\n` : ""}${selectedDoctor ? `\n**MY DOCTOR:**\n- Doctor: ${selectedDoctor.name}${selectedDoctor.specialty ? ` (${selectedDoctor.specialty})` : ""}\n- Network status for this plan: ${doctorNetworkStatus === "in_network" ? "✅ IS in this plan's network" : doctorNetworkStatus === "not_found" ? "⚠️ NOT found in this plan's network" : "Checking..."}\n- ${doctorNetworkStatus === "in_network" ? "Mention that their doctor is covered as a positive." : "WARN that their doctor may not be in-network and they should verify before enrolling, or consider another plan where the doctor is covered."}\n` : ""}
Explain everything I need to know about this plan and my financial situation in ONE explanation.`;

    try {
      const response = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1800,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const text = data.content?.map((c: any) => c.text || "").join("") || "";
      setExplanation(text);
    } catch (err) {
      console.error("AI error:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !explanation && !loading && !error) {
      generateExplanation();
    }
  }, [open]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [explanation]);

  if (!open) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 9,
          border: "1.5px solid #8b5cf6",
          background: "linear-gradient(135deg, #f5f3ff, #ede9fe)",
          color: "#a78bfa",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "all .2s",
          marginTop: 10,
          marginBottom: 4,
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = "translateY(-1px)"; (e.target as HTMLElement).style.boxShadow = "0 4px 12px rgba(139,92,246,.2)"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = ""; (e.target as HTMLElement).style.boxShadow = ""; }}
      >
        {t.aiBtn}
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} style={{
      marginTop: 10,
      borderRadius: 12,
      border: "1.5px solid #c4b5fd",
      background: "linear-gradient(135deg, #faf5ff, #f5f3ff)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
        color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{t.aiTitle}</span>
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: "rgba(255,255,255,.15)",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          color: "#fff",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}>{t.aiClose}</button>
      </div>

      {/* Content */}
      <div ref={contentRef} style={{
        padding: 16,
        maxHeight: 500,
        overflowY: "auto",
        fontSize: 13,
        lineHeight: 1.7,
        color: "#4b5563",
      }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid #e9d5ff",
              borderTopColor: "#7c3aed", borderRadius: "50%",
              animation: "aispin 0.8s linear infinite",
              margin: "0 auto 12px",
            }} />
            <div style={{ color: "#a78bfa", fontWeight: 700, fontSize: 13 }}>{t.aiLoading}</div>
            <div style={{ color: "#6b7280", fontSize: 11, marginTop: 4 }}>{t.aiScenarios}</div>
            <style>{`@keyframes aispin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ color: "#dc2626", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
              {lang === "es" ? "No se pudo generar la explicación" : "Could not generate explanation"}
            </div>
            <button onClick={generateExplanation} style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: "#7c3aed", color: "#fff", fontSize: 13,
              fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{t.aiRetry}</button>
          </div>
        )}

        {explanation && (
          <div style={{ wordBreak: "break-word" }}>
            {explanation.split("\n").map((line, i) => {
              const renderInline = (text: string) => {
                const parts: React.ReactNode[] = [];
                let last = 0;
                const re = /\*\*(.*?)\*\*/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                  if (m.index > last) parts.push(<span key={`t${last}`}>{text.slice(last, m.index)}</span>);
                  parts.push(<strong key={`b${m.index}`} style={{ color: "#1f2937", fontWeight: 700 }}>{m[1]}</strong>);
                  last = m.index + m[0].length;
                }
                if (last < text.length) parts.push(<span key={`e${last}`}>{text.slice(last)}</span>);
                return parts.length > 0 ? parts : text;
              };

              // --- Dividers
              if (line.trim() === "---" || line.trim() === "___") {
                return <div key={i} style={{ height: 1, background: "linear-gradient(90deg, transparent, #d8b4fe, transparent)", margin: "16px 0" }} />;
              }

              // ## and ### Headers
              if (line.startsWith("### ") || line.startsWith("## ") || line.startsWith("# ")) {
                const level = line.startsWith("### ") ? 3 : line.startsWith("## ") ? 2 : 1;
                const text = line.replace(/^#{1,3}\s+/, "").replace(/\*\*/g, "");
                const isSection = level <= 2;
                return (
                  <div key={i} style={{
                    fontSize: level === 1 ? 16 : level === 2 ? 15 : 14,
                    fontWeight: 800,
                    color: isSection ? "#5b21b6" : "#6d28d9",
                    marginTop: i > 0 ? (isSection ? 20 : 14) : 0,
                    marginBottom: 6,
                    paddingBottom: isSection ? 6 : 0,
                    borderBottom: isSection ? "2px solid #ede9fe" : "none",
                    letterSpacing: -0.3,
                    lineHeight: 1.3,
                  }}>
                    {text}
                  </div>
                );
              }

              // **Bold-only lines** (full line bold)
              if (line.match(/^\*\*.*\*\*$/) && !line.startsWith("#")) {
                const text = line.replace(/\*\*/g, "");
                return (
                  <div key={i} style={{
                    fontWeight: 800, color: "#5b21b6", fontSize: 14,
                    marginTop: i > 0 ? 16 : 0, marginBottom: 4,
                    lineHeight: 1.4,
                  }}>
                    {text}
                  </div>
                );
              }

              // Numbered items (1. 2. 3.)
              if (line.match(/^\d+\.\s/)) {
                const num = line.match(/^(\d+)\./)?.[1];
                const text = line.replace(/^\d+\.\s*/, "");
                return (
                  <div key={i} style={{ display: "flex", gap: 10, marginTop: 10, marginBottom: 4, alignItems: "flex-start" }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 12, flexShrink: 0,
                      background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                      color: "#fff", fontSize: 12, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginTop: 1,
                    }}>{num}</span>
                    <span style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}>
                      {renderInline(text)}
                    </span>
                  </div>
                );
              }

              // Bullet points
              if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ") || line.trimStart().startsWith("* ")) {
                const indent = line.length - line.trimStart().length;
                const text = line.trimStart().replace(/^[-•*]\s+/, "");
                return (
                  <div key={i} style={{
                    display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start",
                    paddingLeft: indent > 0 ? 20 : 6,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                      background: "#8b5cf6", marginTop: 7,
                    }} />
                    <span style={{ fontSize: 13, lineHeight: 1.6, flex: 1, color: "#4b5563" }}>
                      {renderInline(text)}
                    </span>
                  </div>
                );
              }

              // Empty lines
              if (!line.trim()) return <div key={i} style={{ height: 6 }} />;

              // Verdict/highlight lines (contains checkmarks, warnings, etc.)
              if (/^[✅⚠️🏆💡🎯]/.test(line.trim()) || line.includes("Veredicto") || line.includes("Verdict") || line.includes("Recomiendo") || line.includes("Recommend")) {
                return (
                  <div key={i} style={{
                    background: line.includes("✅") || line.includes("Sí,") ? "rgba(16,185,129,0.08)" : line.includes("⚠️") ? "rgba(251,191,36,0.08)" : "rgba(139,92,246,0.08)",
                    border: `1px solid ${line.includes("✅") || line.includes("Sí,") ? "rgba(16,185,129,0.25)" : line.includes("⚠️") ? "rgba(251,191,36,0.25)" : "rgba(139,92,246,0.2)"}`,
                    borderRadius: 8, padding: "10px 14px", marginTop: 8, marginBottom: 4,
                    fontSize: 13, fontWeight: 600, lineHeight: 1.6,
                    color: line.includes("✅") || line.includes("Sí,") ? "#059669" : line.includes("⚠️") ? "#d97706" : "#6d28d9",
                  }}>
                    {renderInline(line)}
                  </div>
                );
              }

              // Regular paragraph text
              return (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#4b5563", marginBottom: 2 }}>
                  {renderInline(line)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disclaimer footer */}
      {explanation && (
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid #e9d5ff",
          background: "rgba(139,92,246,0.05)",
          fontSize: 10,
          color: "#6b7280",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          ⚠️ {t.aiDisclaimer}
        </div>
      )}
    </div>
  );
}
