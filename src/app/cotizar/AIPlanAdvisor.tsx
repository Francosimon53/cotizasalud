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
}

export default function AIPlanAdvisor({ plan, household, income, fplPct, aptc, lang, t }: AIPlanAdvisorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const householdDesc = household.map((m, i) =>
    `Person ${i + 1}: ${m.age}yo ${m.gender}${m.tobacco ? " (tobacco)" : ""}`
  ).join(", ");

  const generateExplanation = async () => {
    setLoading(true);
    setError(false);
    setExplanation("");
    setStreaming(true);

    const systemPrompt = lang === "es"
      ? `Eres un asesor de seguros médicos ACA experto. Explicas planes de salud en español simple y claro para familias hispanas.

REGLAS DE FORMATO ESTRICTAS:
- Usa ## para títulos de sección principales (máximo 5 secciones)
- Usa **texto** para resaltar cifras y conceptos clave dentro de párrafos
- Usa viñetas (- ) para listas cortas de pros/contras
- Usa números (1. 2. 3.) para pasos o escenarios secuenciales
- NO uses ### (solo ## para secciones)
- NO uses emojis en títulos de sección
- Usa UN emoji relevante al inicio de líneas importantes de veredicto (✅ o ⚠️)
- Escribe párrafos fluidos de 2-3 oraciones, no oraciones sueltas
- Separa secciones con una línea vacía
- El tono debe ser como un amigo experto que te explica en la cocina de su casa
- Usa analogías cotidianas (plan de celular, membresía de gym, etc.)
- SIEMPRE incluye cifras específicas en dólares, nunca digas "depende"
- NUNCA recomiendes inscribirse sin un agente licenciado`
      : `You are an expert ACA health insurance advisor. You explain health plans in simple, clear English for families.

STRICT FORMAT RULES:
- Use ## for main section headers (max 5 sections)
- Use **text** to highlight dollar amounts and key concepts within paragraphs
- Use bullets (- ) for short pro/con lists
- Use numbers (1. 2. 3.) for sequential steps or scenarios
- Do NOT use ### (only ## for sections)
- Do NOT use emojis in section headers
- Use ONE relevant emoji at the start of verdict lines only (✅ or ⚠️)
- Write fluid 2-3 sentence paragraphs, not single sentences
- Separate sections with a blank line
- Tone should be like a knowledgeable friend explaining at their kitchen table
- Use everyday analogies (cell phone plan, gym membership, etc.)
- ALWAYS include specific dollar figures, never say "it depends"
- NEVER recommend enrolling without a licensed agent`;

    const userPrompt = lang === "es"
      ? `Explica este plan de seguro médico para mi familia de forma clara y personalizada.

**MI FAMILIA:**
${household.map((m, i) => `- Persona ${i + 1}: ${m.age} años, ${m.gender === "Female" ? "Mujer" : "Hombre"}${m.tobacco ? " (usa tabaco)" : ""}`).join("\n")}
- Ingreso anual: $${income.toLocaleString()} (${fplPct}% del Nivel Federal de Pobreza)
- Subsidio mensual estimado (APTC): $${aptc}

**EL PLAN:**
- Nombre: ${plan.name}
- Aseguradora: ${plan.issuer}
- Nivel: ${plan.metal}
- Prima mensual: $${plan.premium} → $${plan.afterSubsidy}/mes después del subsidio
- Deducible: $${plan.deductible.toLocaleString()}
- Máximo de bolsillo: $${plan.oopMax.toLocaleString()}
- Visita médico general: $${plan.pcp} copay
- Visita especialista: $${plan.specialist} copay
- Medicamento genérico: $${plan.genericRx} copay
- Emergencia: $${plan.er} copay
- Calificación: ${plan.rating}/5 estrellas
- HSA elegible: ${plan.hsa ? "Sí" : "No"}
- Costo anual estimado (uso bajo): $${plan.yLow.toLocaleString()}
- Costo anual estimado (uso medio): $${plan.yMed.toLocaleString()}
- Costo anual estimado (uso alto): $${plan.yHigh.toLocaleString()}

Por favor incluye:
1. **Resumen rápido** - ¿Para quién es ideal este plan? (2-3 oraciones)
2. **Cómo funciona tu deducible** - Explica con un ejemplo real basado en mi familia
3. **3 escenarios reales** para mi hogar específico:
   - Año saludable (solo chequeos y visitas preventivas)
   - Año con necesidades moderadas (una persona necesita especialista + medicamentos)
   - Año con emergencia o cirugía
4. **Lo bueno y lo malo** - Pros y contras honestos de este plan
5. **Veredicto** - ¿Vale la pena este plan para mi familia?`
      : `Explain this health insurance plan to my family in a clear, personalized way.

**MY FAMILY:**
${household.map((m, i) => `- Person ${i + 1}: ${m.age} years old, ${m.gender}${m.tobacco ? " (tobacco user)" : ""}`).join("\n")}
- Annual income: $${income.toLocaleString()} (${fplPct}% of Federal Poverty Level)
- Estimated monthly subsidy (APTC): $${aptc}

**THE PLAN:**
- Name: ${plan.name}
- Issuer: ${plan.issuer}
- Metal level: ${plan.metal}
- Monthly premium: $${plan.premium} → $${plan.afterSubsidy}/mo after subsidy
- Deductible: $${plan.deductible.toLocaleString()}
- Out-of-pocket max: $${plan.oopMax.toLocaleString()}
- Doctor visit: $${plan.pcp} copay
- Specialist visit: $${plan.specialist} copay
- Generic Rx: $${plan.genericRx} copay
- Emergency room: $${plan.er} copay
- Quality rating: ${plan.rating}/5 stars
- HSA eligible: ${plan.hsa ? "Yes" : "No"}
- Est. annual cost (low use): $${plan.yLow.toLocaleString()}
- Est. annual cost (medium use): $${plan.yMed.toLocaleString()}
- Est. annual cost (high use): $${plan.yHigh.toLocaleString()}

Please include:
1. **Quick summary** - Who is this plan ideal for? (2-3 sentences)
2. **How your deductible works** - Explain with a real example based on my family
3. **3 real scenarios** for my specific household:
   - Healthy year (just checkups and preventive visits)
   - Moderate needs year (one person needs specialist + medications)
   - Emergency or surgery year
4. **The good and the bad** - Honest pros and cons
5. **Verdict** - Is this plan worth it for my family?`;

    try {
      const response = await fetch("/api/ai-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
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
      setStreaming(false);
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
          <span style={{ fontSize: 18 }}>🤖</span>
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
        maxHeight: 400,
        overflowY: "auto",
        fontSize: 13,
        lineHeight: 1.7,
        color: "#8b8fa3",
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
            <div style={{ color: "#5a5e72", fontSize: 11, marginTop: 4 }}>{t.aiScenarios}</div>
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
                  parts.push(<strong key={`b${m.index}`} style={{ color: "#f0f1f5", fontWeight: 700 }}>{m[1]}</strong>);
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
                    color: isSection ? "#c4b5fd" : "#a78bfa",
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
                    fontWeight: 800, color: "#c4b5fd", fontSize: 14,
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
                    <span style={{ fontSize: 13, lineHeight: 1.6, flex: 1, color: "#8b8fa3" }}>
                      {renderInline(text)}
                    </span>
                  </div>
                );
              }

              // Empty lines
              if (!line.trim()) return <div key={i} style={{ height: 6 }} />;

              // Verdict/highlight lines (contains ✅ ⚠️ 🏆 💡)
              if (/^[✅⚠️🏆💡🎯]/.test(line.trim()) || line.includes("Veredicto") || line.includes("Verdict")) {
                return (
                  <div key={i} style={{
                    background: line.includes("✅") || line.includes("Sí,") ? "rgba(16,185,129,0.1)" : line.includes("⚠️") ? "rgba(251,191,36,0.1)" : "rgba(139,92,246,0.05)",
                    border: `1px solid ${line.includes("✅") || line.includes("Sí,") ? "rgba(16,185,129,0.3)" : line.includes("⚠️") ? "rgba(251,191,36,0.3)" : "rgba(139,92,246,0.2)"}`,
                    borderRadius: 8, padding: "10px 14px", marginTop: 8, marginBottom: 4,
                    fontSize: 13, fontWeight: 600, lineHeight: 1.6,
                    color: line.includes("✅") || line.includes("Sí,") ? "#10b981" : line.includes("⚠️") ? "#fbbf24" : "#a78bfa",
                  }}>
                    {renderInline(line)}
                  </div>
                );
              }

              // Regular paragraph text
              return (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: "#8b8fa3", marginBottom: 2 }}>
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
          color: "#5a5e72",
          textAlign: "center",
          lineHeight: 1.5,
        }}>
          ⚠️ {t.aiDisclaimer}
        </div>
      )}
    </div>
  );
}
