"use client";

import { useState, useEffect, useCallback } from "react";
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
function SubsidyCliffAlert({ fplPct, income, houseSize, lang, maxAge }: {
  fplPct: number; income: number; houseSize: number; lang: string; maxAge: number;
}) {
  const [eduOpen, setEduOpen] = useState(false);
  const isEs = lang === "es";
  const fplBase = 15650 + (houseSize - 1) * 5500;
  const threshold400 = fplBase * 4;
  const excess = income - threshold400;
  const buffer = threshold400 - income;
  const isFamily = houseSize >= 2;
  const hsaLimit = isFamily ? 8550 : 4300;

  // Zone
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

  // Premium estimates
  const fullPremium = maxAge >= 55 ? 950 : maxAge >= 40 ? 650 : 400;
  const subsidizedMap: Record<string, number> = { medicaid: 0, max: 50, moderate: 150, yellow: 300, red: fullPremium };
  const subsidizedPremium = subsidizedMap[zone];

  // Recovery calc for red zone
  const recoveryCalc = () => {
    if (zone !== "red") return null;
    const hsaContrib = Math.min(excess + 100, hsaLimit);
    const afterHsa = income - hsaContrib;
    const hsaRecovers = afterHsa < threshold400;
    const iraLimit = maxAge >= 50 ? 8000 : 7000;
    const afterHsaIra = income - hsaLimit - iraLimit;
    const hsaIraRecovers = afterHsaIra < threshold400;
    const k401needed = afterHsaIra >= threshold400 ? afterHsaIra - threshold400 + 100 : 0;
    const afterAll = income - hsaLimit - iraLimit - k401needed;
    return { hsaContrib, afterHsa, hsaRecovers, iraLimit, afterHsaIra, hsaIraRecovers, k401needed, afterAll };
  };
  const rc = recoveryCalc();

  // Protection calc for yellow zone
  const protectionCalc = () => {
    if (zone !== "yellow") return null;
    const suggested = Math.min(buffer < 3000 ? hsaLimit : Math.round(hsaLimit * 0.5), hsaLimit);
    const iraAmount = Math.min(buffer < 1500 ? (maxAge >= 50 ? 8000 : 7000) : 0, maxAge >= 50 ? 8000 : 7000);
    const newMagi = income - suggested - iraAmount;
    return { suggested, iraAmount, newMagi, totalContrib: suggested + iraAmount };
  };
  const pc = protectionCalc();

  // Meter positions
  const meterMax = 520;
  const pctPos = Math.min(Math.max((fplPct - 100) / (meterMax - 100) * 100, 0), 100);
  const zP = (v: number) => ((v - 100) / (meterMax - 100)) * 100;

  // Shared styles
  const sH = { fontSize: 13, fontWeight: 700 as const, marginBottom: 6, marginTop: 16, display: "flex" as const, alignItems: "center" as const, gap: 6 };
  const sBox = { background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 };
  const sLabel = { fontSize: 10, color: "#5a5e72", fontWeight: 600 as const, textTransform: "uppercase" as const, letterSpacing: 0.3 };
  const sBig = (c: string) => ({ fontSize: 20, fontWeight: 800 as const, color: c, marginTop: 2 });

  return (
    <div style={{ background: "#12141c", border: `1px solid ${zoneBorder}`, borderRadius: 12, marginBottom: 18, overflow: "hidden" }}>
      {/* Title bar */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#f0f1f5", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>📊</span>
          {isEs ? "Tu Análisis de Subsidio APTC 2026" : "Your 2026 APTC Subsidy Analysis"}
        </div>
        <div style={{ fontSize: 11, color: "#5a5e72", marginTop: 3 }}>
          {isEs ? "Análisis personalizado basado en tu perfil" : "Personalized analysis based on your profile"}
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* PART 1: FPL METER */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ position: "relative", height: 14, borderRadius: 7, background: "rgba(255,255,255,0.04)", overflow: "visible" }}>
            {/* Zone segments */}
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${zP(250)}%`, borderRadius: "7px 0 0 7px", background: "rgba(16,185,129,0.35)" }} />
            <div style={{ position: "absolute", left: `${zP(250)}%`, top: 0, bottom: 0, width: `${zP(300) - zP(250)}%`, background: "rgba(16,185,129,0.2)" }} />
            <div style={{ position: "absolute", left: `${zP(300)}%`, top: 0, bottom: 0, width: `${zP(350) - zP(300)}%`, background: "rgba(251,191,36,0.25)" }} />
            <div style={{ position: "absolute", left: `${zP(350)}%`, top: 0, bottom: 0, width: `${zP(400) - zP(350)}%`, background: "rgba(249,115,22,0.35)" }} />
            <div style={{ position: "absolute", left: `${zP(400)}%`, top: 0, bottom: 0, right: 0, borderRadius: "0 7px 7px 0", background: "rgba(239,68,68,0.35)" }} />
            {/* 400% cliff line */}
            <div style={{ position: "absolute", left: `${zP(400)}%`, top: -6, bottom: -6, width: 2, background: "#ef4444", zIndex: 2 }} />
            {/* User marker */}
            <div style={{ position: "absolute", left: `${pctPos}%`, top: "50%", transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: 9, background: "#fff", border: `3px solid ${zoneColor}`, zIndex: 3, boxShadow: `0 0 10px ${zoneColor}60` }} />
          </div>
          {/* Zone labels */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "#5a5e72", fontWeight: 600 }}>
            <span style={{ color: "#10b981" }}>138%</span>
            <span>250%</span>
            <span>300%</span>
            <span>350%</span>
            <span style={{ color: "#ef4444", fontWeight: 800 }}>400%</span>
            <span>500%+</span>
          </div>
          {/* User position label */}
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#8b8fa3" }}>
            {isEs ? "Tu posición" : "Your position"}: <strong style={{ color: zoneColor, fontSize: 14 }}>{fplPct}% FPL</strong> — <span style={{ color: zoneColor, fontWeight: 600 }}>{zoneName}</span>
          </div>
        </div>

        {/* PART 2: ZONE-SPECIFIC CONTENT */}
        <div style={{ borderLeft: `4px solid ${zoneBorder}`, borderRadius: 8, background: "rgba(255,255,255,0.02)", padding: 16 }}>

          {/* ===== MEDICAID ===== */}
          {zone === "medicaid" && (<>
            <div style={{ ...sH, color: "#60a5fa" }}>ℹ️ {isEs ? "Posible elegibilidad para Medicaid" : "Possible Medicaid eligibility"}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3" }}>
              {isEs
                ? `Con un ingreso de $${income.toLocaleString()} para ${houseSize} persona${houseSize > 1 ? "s" : ""}, estás al ${fplPct}% del nivel federal de pobreza. En Florida, podrías calificar para Medicaid. Te recomendamos verificar tu elegibilidad en AccessFlorida.com antes de comprar un plan del Marketplace.`
                : `With an income of $${income.toLocaleString()} for ${houseSize} person${houseSize > 1 ? "s" : ""}, you're at ${fplPct}% of the Federal Poverty Level. In Florida, you may qualify for Medicaid. We recommend verifying your eligibility at AccessFlorida.com before purchasing a Marketplace plan.`}
            </div>
          </>)}

          {/* ===== MAX SUBSIDY (138-250%) ===== */}
          {zone === "max" && (<>
            <div style={{ ...sH, color: "#10b981" }}>✅ {isEs ? "Máximo subsidio disponible" : "Maximum subsidy available"}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3" }}>
              {isEs
                ? `Excelente posición. Con $${income.toLocaleString()} para ${houseSize} persona${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), calificas para el máximo nivel de subsidio APTC. También podrías calificar para Cost Sharing Reductions (CSR) en planes Plata, que reducen tus deducibles y copagos.`
                : `Excellent position. With $${income.toLocaleString()} for ${houseSize} person${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), you qualify for the maximum level of APTC subsidy. You may also qualify for Cost Sharing Reductions (CSR) on Silver plans, which reduce your deductibles and copays.`}
            </div>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", fontSize: 12, color: "#10b981", fontWeight: 600, lineHeight: 1.6 }}>
              💡 {isEs
                ? "Tip: Los planes PLATA con CSR son tu mejor opción — pides precio de Plata pero recibes beneficios casi de Oro."
                : "Tip: SILVER plans with CSR are your best option — you pay Silver prices but get near-Gold benefits."}
            </div>
          </>)}

          {/* ===== MODERATE SUBSIDY (250-350%) ===== */}
          {zone === "moderate" && (<>
            <div style={{ ...sH, color: "#10b981" }}>✅ {isEs ? "Subsidio moderado disponible" : "Moderate subsidy available"}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3" }}>
              {isEs
                ? `Con $${income.toLocaleString()} para ${houseSize} persona${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), calificas para subsidio APTC que reducirá tu prima mensual. Tu subsidio estimado se refleja en los precios de los planes abajo.`
                : `With $${income.toLocaleString()} for ${houseSize} person${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), you qualify for APTC subsidy that will reduce your monthly premium. Your estimated subsidy is reflected in plan prices below.`}
            </div>
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 6, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", fontSize: 12, color: "#10b981", fontWeight: 600, lineHeight: 1.6 }}>
              💡 {isEs
                ? "Tip: Compara bien entre Bronce y Plata. A veces la diferencia de prima es pequeña pero la cobertura de Plata es significativamente mejor."
                : "Tip: Compare Bronze and Silver carefully. Sometimes the premium difference is small but Silver coverage is significantly better."}
            </div>
          </>)}

          {/* ===== YELLOW ZONE (350-400%) ===== */}
          {zone === "yellow" && (<>
            <div style={{ ...sH, color: "#fbbf24", fontSize: 14 }}>⚠️ {isEs ? "ZONA DE RIESGO — Cerca del Subsidy Cliff" : "RISK ZONE — Near the Subsidy Cliff"}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3", marginBottom: 12 }}>
              {isEs
                ? `Con $${income.toLocaleString()} para ${houseSize} persona${houseSize > 1 ? "s" : ""}, estás al ${fplPct}% del FPL — a solo $${buffer.toLocaleString()} del límite donde PIERDES TODO el subsidio.`
                : `With $${income.toLocaleString()} for ${houseSize} person${houseSize > 1 ? "s" : ""}, you're at ${fplPct}% FPL — only $${buffer.toLocaleString()} from the limit where you LOSE ALL subsidy.`}
            </div>

            {/* Urgency box */}
            <div style={{ ...sBox, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3" }}>
                <strong style={{ color: "#fbbf24" }}>⚠️ {isEs ? `Si tu ingreso real en 2026 supera $${threshold400.toLocaleString()} por tan solo $1:` : `If your actual 2026 income exceeds $${threshold400.toLocaleString()} by just $1:`}</strong>
                <div style={{ paddingLeft: 10, marginTop: 6 }}>
                  {(isEs ? [
                    "Pierdes TODO el subsidio APTC",
                    `Tu prima sube de ~$${subsidizedPremium}/mes a ~$${fullPremium}/mes`,
                    "Tendrías que devolver el subsidio al IRS al declarar impuestos",
                  ] : [
                    "You lose ALL APTC subsidy",
                    `Your premium jumps from ~$${subsidizedPremium}/mo to ~$${fullPremium}/mo`,
                    "You'd have to repay the subsidy to the IRS when filing taxes",
                  ]).map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3 }}>
                      <span style={{ color: "#ef4444", flexShrink: 0 }}>•</span><span>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, color: "#6b7280", fontStyle: "italic" }}>
                  {isEs
                    ? "El 21% de las personas en el Marketplace tienen ingresos volátiles. Un bono, horas extras, o ingreso freelance podría empujarte sobre el límite."
                    : "21% of Marketplace enrollees have volatile incomes. A bonus, overtime, or freelance income could push you over the limit."}
                </div>
              </div>
            </div>

            {/* Strategies */}
            <div style={{ ...sH, color: "#10b981", marginTop: 14 }}>🛡️ {isEs ? "ESTRATEGIAS PARA PROTEGER TU SUBSIDIO" : "STRATEGIES TO PROTECT YOUR SUBSIDY"}</div>
            {(isEs ? [
              [`Contribuye a una HSA (si eliges plan HSA-elegible)`, `Individual: hasta $4,300 · Familia: hasta $8,550 — reduce tu MAGI directamente`],
              [`Contribuye a IRA Tradicional`, `Hasta $7,000/año ($8,000 si tienes 50+) — reduce directamente tu MAGI`],
              [`Contribuye más a tu 401(k) o 403(b)`, `Hasta $23,500/año en 2026. Las contribuciones pre-tax reducen tu MAGI`],
              [`Monitorea tu ingreso durante el año`, `Reporta cambios al Marketplace inmediatamente. Ajusta tu estimado si recibes un aumento o bono`],
            ] : [
              [`Contribute to an HSA (if you choose an HSA-eligible plan)`, `Individual: up to $4,300 · Family: up to $8,550 — directly reduces your MAGI`],
              [`Contribute to Traditional IRA`, `Up to $7,000/yr ($8,000 if age 50+) — directly reduces your MAGI`],
              [`Increase your 401(k) or 403(b) contributions`, `Up to $23,500/yr in 2026. Pre-tax contributions reduce your MAGI`],
              [`Monitor your income throughout the year`, `Report changes to the Marketplace immediately. Adjust your estimate if you receive a raise or bonus`],
            ]).map(([title, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12.5 }}>
                <span style={{ color: "#10b981", fontWeight: 800, fontSize: 13, minWidth: 18, flexShrink: 0 }}>{i + 1}.</span>
                <div>
                  <div style={{ fontWeight: 700, color: "#f0f1f5" }}>{title}</div>
                  <div style={{ color: "#6b7280", marginTop: 1, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}

            {/* Personalized calculation */}
            {pc && (
              <div style={{ ...sBox, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10 }}>
                  💰 {isEs ? "CÁLCULO PERSONALIZADO" : "PERSONALIZED CALCULATION"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                  <div><div style={sLabel}>{isEs ? "Tu ingreso" : "Your income"}</div><div style={sBig("#f0f1f5")}>${income.toLocaleString()}</div></div>
                  <div><div style={sLabel}>{isEs ? "Límite 400%" : "400% limit"}</div><div style={sBig("#ef4444")}>${threshold400.toLocaleString()}</div></div>
                  <div><div style={sLabel}>{isEs ? "Margen" : "Buffer"}</div><div style={sBig("#fbbf24")}>${buffer.toLocaleString()}</div></div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 10, fontSize: 12, color: "#8b8fa3", lineHeight: 1.7 }}>
                  {isEs
                    ? `Si contribuyes $${pc.totalContrib.toLocaleString()} a HSA${pc.iraAmount > 0 ? " + IRA" : ""}:`
                    : `If you contribute $${pc.totalContrib.toLocaleString()} to HSA${pc.iraAmount > 0 ? " + IRA" : ""}:`}<br />
                  → MAGI: <strong style={{ color: "#f0f1f5" }}>${pc.newMagi.toLocaleString()}</strong><br />
                  → {isEs ? "Resultado" : "Result"}: <strong style={{ color: "#10b981" }}>
                    {isEs ? "Subsidio protegido ✅" : "Subsidy protected ✅"}
                  </strong><br />
                  → {isEs ? "Ahorro estimado" : "Est. savings"}: <strong style={{ color: "#10b981" }}>~${((fullPremium - subsidizedPremium) * 12).toLocaleString()}/{isEs ? "año en primas" : "yr in premiums"}</strong>
                </div>
              </div>
            )}
          </>)}

          {/* ===== RED ZONE (>400%) ===== */}
          {zone === "red" && (<>
            <div style={{ ...sH, color: "#ef4444", fontSize: 14 }}>🚨 {isEs ? "SUBSIDY CLIFF — Sin subsidio APTC" : "SUBSIDY CLIFF — No APTC Subsidy"}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "#8b8fa3", marginBottom: 12 }}>
              {isEs
                ? `Con $${income.toLocaleString()} para ${houseSize} persona${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), tu ingreso supera el límite de $${threshold400.toLocaleString()} (400% FPL) por $${excess.toLocaleString()}. No calificas para ningún subsidio APTC en 2026. Los precios que ves abajo son el costo completo.`
                : `With $${income.toLocaleString()} for ${houseSize} person${houseSize > 1 ? "s" : ""} (${fplPct}% FPL), your income exceeds the $${threshold400.toLocaleString()} limit (400% FPL) by $${excess.toLocaleString()}. You don't qualify for any APTC subsidy in 2026. The prices below are full cost.`}
            </div>

            {/* Impact box */}
            <div style={{ ...sBox, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#ef4444", marginBottom: 10 }}>
                📊 {isEs ? "IMPACTO EN TU BOLSILLO" : "IMPACT ON YOUR WALLET"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600, marginBottom: 4 }}>
                    {isEs ? `Si estuvieras $1 debajo ($${(threshold400 - 1).toLocaleString()})` : `If you were $1 below ($${(threshold400 - 1).toLocaleString()})`}
                  </div>
                  <div style={{ fontSize: 10, color: "#5a5e72" }}>{isEs ? "Prima estimada" : "Est. premium"}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>~$350<span style={{ fontSize: 11, fontWeight: 600 }}>{isEs ? "/mes" : "/mo"}</span></div>
                  <div style={{ fontSize: 10, color: "#5a5e72" }}>{isEs ? "Costo anual" : "Annual cost"}: ~$4,200</div>
                </div>
                <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600, marginBottom: 4 }}>
                    {isEs ? "Tu situación actual (sobre el cliff)" : "Your current situation (over cliff)"}
                  </div>
                  <div style={{ fontSize: 10, color: "#5a5e72" }}>{isEs ? "Prima" : "Premium"}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>~${fullPremium}<span style={{ fontSize: 11, fontWeight: 600 }}>{isEs ? "/mes" : "/mo"}</span></div>
                  <div style={{ fontSize: 10, color: "#5a5e72" }}>{isEs ? "Costo anual" : "Annual cost"}: ~${(fullPremium * 12).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ marginTop: 10, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#fbbf24" }}>
                💸 {isEs ? "Diferencia" : "Difference"}: ~${((fullPremium * 12) - 4200).toLocaleString()}/{isEs ? "año — este es el costo real del Subsidy Cliff" : "yr — this is the real cost of the Subsidy Cliff"}
              </div>
            </div>

            {/* Recovery strategies */}
            {rc && (
              <>
                <div style={{ ...sH, color: "#10b981", marginTop: 14, fontSize: 13 }}>
                  🔧 {isEs ? "PLAN DE ACCIÓN PARA RECUPERAR EL SUBSIDIO" : "ACTION PLAN TO RESTORE YOUR SUBSIDY"}
                </div>
                <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 10 }}>
                  {isEs
                    ? `Necesitas reducir tu MAGI en al menos $${(excess + 1).toLocaleString()}`
                    : `You need to reduce your MAGI by at least $${(excess + 1).toLocaleString()}`}
                </div>

                {/* Option A — HSA only */}
                {excess < hsaLimit && (
                  <div style={{ ...sBox, background: excess < hsaLimit ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                      {isEs ? "Opción A — Solo HSA" : "Option A — HSA Only"} {rc.hsaRecovers ? "✅" : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b8fa3", lineHeight: 1.7 }}>
                      HSA: ${rc.hsaContrib.toLocaleString()} → MAGI: <strong style={{ color: "#f0f1f5" }}>${rc.afterHsa.toLocaleString()}</strong>
                      {rc.hsaRecovers && <span style={{ color: "#10b981", fontWeight: 700 }}> → {isEs ? "Subsidio recuperado" : "Subsidy restored"} ✅</span>}
                    </div>
                  </div>
                )}

                {/* Option B — HSA + IRA */}
                {excess >= hsaLimit && excess < (hsaLimit + rc.iraLimit) && (
                  <div style={{ ...sBox, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>
                      {isEs ? "Opción B — HSA + IRA Tradicional" : "Option B — HSA + Traditional IRA"} {rc.hsaIraRecovers ? "✅" : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b8fa3", lineHeight: 1.7 }}>
                      HSA: ${hsaLimit.toLocaleString()} + IRA: ${Math.min(excess - hsaLimit + 100, rc.iraLimit).toLocaleString()} = <strong style={{ color: "#f0f1f5" }}>${(hsaLimit + Math.min(excess - hsaLimit + 100, rc.iraLimit)).toLocaleString()}</strong><br />
                      → MAGI: <strong style={{ color: "#f0f1f5" }}>${rc.afterHsaIra.toLocaleString()}</strong>
                      {rc.hsaIraRecovers && <span style={{ color: "#10b981", fontWeight: 700 }}> → {isEs ? "Subsidio recuperado" : "Subsidy restored"} ✅</span>}
                    </div>
                  </div>
                )}

                {/* Option C — HSA + IRA + 401k */}
                {excess >= (hsaLimit + rc.iraLimit) && (
                  <div style={{ ...sBox, background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>
                      {isEs ? "Opción C — HSA + IRA + 401(k)" : "Option C — HSA + IRA + 401(k)"}
                    </div>
                    <div style={{ fontSize: 12, color: "#8b8fa3", lineHeight: 1.7 }}>
                      HSA: ${hsaLimit.toLocaleString()} + IRA: ${rc.iraLimit.toLocaleString()} + 401(k): ${rc.k401needed.toLocaleString()}<br />
                      → MAGI: <strong style={{ color: "#f0f1f5" }}>${rc.afterAll.toLocaleString()}</strong>
                      {rc.afterAll < threshold400
                        ? <span style={{ color: "#10b981", fontWeight: 700 }}> → {isEs ? "Subsidio recuperado" : "Subsidy restored"} ✅</span>
                        : <span style={{ color: "#fbbf24", fontWeight: 700 }}> → {isEs ? "Necesitas más reducción" : "Needs more reduction"} ⚠️</span>}
                    </div>
                  </div>
                )}

                {/* Option D — fallback */}
                <div style={{ ...sBox, background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#8b8fa3", marginBottom: 6 }}>
                    {isEs ? "Si no puedes reducir tu MAGI lo suficiente:" : "If you can't reduce your MAGI enough:"}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
                    {(isEs ? [
                      "Considera planes Catastrophic (disponibles sin límite de edad si no tienes subsidio)",
                      "Busca planes Bronze HSA para primas más bajas",
                      "El dinero que depositas en HSA al menos te da beneficio fiscal",
                    ] : [
                      "Consider Catastrophic plans (available without age limit if you have no subsidy)",
                      "Look for Bronze HSA plans for lower premiums",
                      "Money you deposit in an HSA at least gives you a tax benefit",
                    ]).map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                        <span style={{ color: "#5a5e72", flexShrink: 0 }}>•</span><span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Personalized example with user's numbers */}
            {rc && (
              <div style={{ ...sBox, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", marginTop: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginBottom: 10 }}>
                  📝 {isEs ? "EJEMPLO CON TUS NÚMEROS" : "EXAMPLE WITH YOUR NUMBERS"}
                </div>
                <div style={{ fontSize: 12, color: "#8b8fa3", lineHeight: 1.8 }}>
                  {isEs ? "Tu ingreso" : "Your income"}: <strong style={{ color: "#f0f1f5" }}>${income.toLocaleString()}</strong><br />
                  {isEs ? "Contribuyes" : "You contribute"} ${Math.min(hsaLimit, excess + 500).toLocaleString()} {isEs ? "a HSA" : "to HSA"} → MAGI: <strong style={{ color: "#f0f1f5" }}>${(income - Math.min(hsaLimit, excess + 500)).toLocaleString()}</strong>
                  {(income - Math.min(hsaLimit, excess + 500)) < threshold400 ? (
                    <><br /><strong style={{ color: "#10b981" }}>→ {isEs ? "Bajo el límite — subsidio recuperado" : "Under the limit — subsidy restored"} ✅</strong></>
                  ) : (
                    <><br />{isEs ? "Aún sobre el límite. Agrega IRA" : "Still over. Add IRA"}: ${Math.min(rc.iraLimit, (income - Math.min(hsaLimit, excess + 500)) - threshold400 + 100).toLocaleString()} → MAGI: <strong style={{ color: "#f0f1f5" }}>${(income - Math.min(hsaLimit, excess + 500) - Math.min(rc.iraLimit, (income - Math.min(hsaLimit, excess + 500)) - threshold400 + 100)).toLocaleString()}</strong>
                    {(income - Math.min(hsaLimit, excess + 500) - Math.min(rc.iraLimit, (income - Math.min(hsaLimit, excess + 500)) - threshold400 + 100)) < threshold400 && <><br /><strong style={{ color: "#10b981" }}>→ {isEs ? "Subsidio recuperado" : "Subsidy restored"} ✅</strong></>}
                    </>
                  )}<br /><br />
                  {isEs ? "Beneficio fiscal de HSA" : "HSA tax benefit"}: ~${Math.round(Math.min(hsaLimit, excess + 500) * 0.22).toLocaleString()} ({isEs ? "bracket 22%" : "22% bracket"})<br />
                  {(income - Math.min(hsaLimit, excess + 500)) < threshold400 && (
                    <>{isEs ? "Beneficio en subsidio" : "Subsidy benefit"}: ~${((fullPremium - 350) * 12).toLocaleString()}/{isEs ? "año" : "yr"}<br />
                    <strong style={{ color: "#10b981" }}>{isEs ? "Total ahorrado" : "Total saved"}: ~${(Math.round(Math.min(hsaLimit, excess + 500) * 0.22) + (fullPremium - 350) * 12).toLocaleString()}/{isEs ? "año" : "yr"}</strong></>
                  )}
                </div>
              </div>
            )}
          </>)}
        </div>

        {/* PART 3: Educational section — collapsible */}
        <div style={{ marginTop: 16, borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <button
            onClick={() => setEduOpen(!eduOpen)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "none",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: "#8b8fa3" }}>
              📚 {isEs ? "Entender el Subsidy Cliff — ¿Por qué pasa esto?" : "Understanding the Subsidy Cliff — Why does this happen?"}
            </span>
            <span style={{ fontSize: 10, color: "#5a5e72", transition: "transform .2s", transform: eduOpen ? "rotate(180deg)" : "none" }}>▼</span>
          </button>
          <div style={{ maxHeight: eduOpen ? 800 : 0, overflow: "hidden", transition: "max-height .4s ease" }}>
            <div style={{ padding: "12px 14px", fontSize: 12, lineHeight: 1.75, color: "#6b7280" }}>
              {isEs ? (<>
                <p style={{ marginBottom: 10 }}>El &ldquo;Subsidy Cliff&rdquo; (precipicio de subsidio) es una regla del ACA (Obamacare) que elimina TODA la ayuda financiera si tu ingreso supera el 400% del Nivel Federal de Pobreza.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>¿Por qué existe?</p>
                <p style={{ marginBottom: 10 }}>De 2021 a 2025, el gobierno eliminó temporalmente este límite gracias al American Rescue Plan. Cualquier persona podía recibir subsidio sin importar su ingreso. Pero el Congreso no extendió esta protección para 2026, y el cliff regresó.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>¿A quién afecta?</p>
                <div style={{ paddingLeft: 8, marginBottom: 10 }}>
                  • 22 millones de personas vieron sus primas aumentar en 2026<br />
                  • Las primas se duplicaron en promedio para quienes recibían subsidio<br />
                  • 1.6 millones de personas perdieron TODO su subsidio por estar sobre el 400% FPL
                </div>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>¿Qué es MAGI?</p>
                <p style={{ marginBottom: 10 }}>MAGI (Modified Adjusted Gross Income) es el ingreso que usa el IRS para calcular tu elegibilidad. NO es tu salario bruto — es tu ingreso después de ciertas deducciones como HSA, IRA tradicional, y contribuciones 401(k) pre-tax. Por eso estas contribuciones pueden &ldquo;bajar&rdquo; tu ingreso para efectos del subsidio.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>¿Puede cambiar esto?</p>
                <p>Sí. El Congreso puede votar para extender los subsidios mejorados en cualquier momento. Varios proyectos de ley están en discusión. Mientras tanto, las estrategias de reducción de MAGI son la mejor herramienta disponible.</p>
              </>) : (<>
                <p style={{ marginBottom: 10 }}>The &ldquo;Subsidy Cliff&rdquo; is an ACA (Obamacare) rule that eliminates ALL financial assistance if your income exceeds 400% of the Federal Poverty Level.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>Why does it exist?</p>
                <p style={{ marginBottom: 10 }}>From 2021 to 2025, the government temporarily removed this limit through the American Rescue Plan. Anyone could receive a subsidy regardless of income. But Congress did not extend this protection for 2026, and the cliff returned.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>Who is affected?</p>
                <div style={{ paddingLeft: 8, marginBottom: 10 }}>
                  • 22 million people saw their premiums increase in 2026<br />
                  • Premiums doubled on average for those receiving subsidies<br />
                  • 1.6 million people lost ALL subsidy for being over 400% FPL
                </div>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>What is MAGI?</p>
                <p style={{ marginBottom: 10 }}>MAGI (Modified Adjusted Gross Income) is the income the IRS uses to calculate your eligibility. It&apos;s NOT your gross salary — it&apos;s your income after certain deductions like HSA, traditional IRA, and pre-tax 401(k) contributions. That&apos;s why these contributions can &ldquo;lower&rdquo; your income for subsidy purposes.</p>
                <p style={{ fontWeight: 700, color: "#8b8fa3", marginBottom: 4 }}>Can this change?</p>
                <p>Yes. Congress can vote to extend the enhanced subsidies at any time. Several bills are under discussion. In the meantime, MAGI reduction strategies are the best available tool.</p>
              </>)}
              <div style={{ marginTop: 10, fontSize: 10, color: "#3a3d4a" }}>
                {isEs ? "Fuente" : "Source"}: IRS.gov, Healthcare.gov, KFF.org
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 12, fontSize: 10, color: "#3a3d4a", lineHeight: 1.5, textAlign: "center" }}>
          ⚠️ {isEs
            ? "Las estimaciones son aproximadas y con fines educativos. Consulta con tu agente o un asesor fiscal para cálculos exactos. CotizaSalud no provee asesoría fiscal."
            : "Estimates are approximate and for educational purposes. Consult your agent or a tax advisor for exact calculations. CotizaSalud does not provide tax advice."}
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
  const [hsaOpen, setHsaOpen] = useState(false);

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
            <SubsidyCliffAlert fplPct={fpl} income={Number(income)} houseSize={house.length} lang={lang} maxAge={Math.max(...house.map(h => h.age))} />

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
                    {plan.hsa && fpl >= 350 ? (
                      <div style={{
                        ...S.stat,
                        background: fpl > 400 ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)",
                        border: `1px solid ${fpl > 400 ? "rgba(251,191,36,0.3)" : "rgba(16,185,129,0.25)"}`,
                        borderRadius: 8, padding: "8px 10px", gridColumn: "1 / -1",
                        animation: "hsa-glow 2s ease-in-out infinite",
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: fpl > 400 ? "#fbbf24" : "#10b981" }}>
                          🏦 HSA {lang === "es" ? "Elegible" : "Eligible"} — {fpl > 400
                            ? (lang === "es" ? "Ver cómo recuperar tu subsidio ↓" : "See how to restore your subsidy ↓")
                            : (lang === "es" ? "Ver cómo proteger tu subsidio ↓" : "See how to protect your subsidy ↓")}
                        </div>
                      </div>
                    ) : (
                      <div style={S.stat}><div style={S.statL}>HSA</div><div style={{ ...S.statV, fontSize: 14, color: plan.hsa ? "#10b981" : "#2a2d3a" }}>{plan.hsa ? "✓" : "—"}</div></div>
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

                      {/* HSA Education Card — only for HSA plans when FPL >= 350% */}
                      {plan.hsa && fpl >= 350 && (() => {
                        const isEs = lang === "es";
                        const userIncome = Number(income);
                        const fplBase = 15650 + (house.length - 1) * 5500;
                        const threshold400 = fplBase * 4;
                        const overCliff = fpl > 400;
                        const excess = userIncome - threshold400;
                        const hsaLimit = house.length >= 2 ? 8550 : 4300;
                        const contribution = overCliff ? Math.min(excess + 100, hsaLimit) : 0;
                        const newMagi = userIncome - contribution;
                        const recoversSubsidy = newMagi < threshold400;
                        const estMonthlySavings = recoversSubsidy ? (fpl > 450 ? 300 : fpl > 420 ? 400 : 500) : 0;

                        const sH = { fontSize: 13, fontWeight: 700 as const, color: "#10b981", marginBottom: 6, marginTop: 16, display: "flex", alignItems: "center", gap: 6 };
                        const sP = { fontSize: 12.5, lineHeight: 1.65, color: "#8b8fa3", marginBottom: 0 };
                        const sBullet = { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3, fontSize: 12.5, color: "#8b8fa3" as const };
                        const sDot = { color: "#10b981", fontSize: 8, marginTop: 6, flexShrink: 0 as const };

                        return (
                          <div onClick={(e) => e.stopPropagation()} style={{
                            marginTop: 16, background: "#1a1c26", borderRadius: 10,
                            borderLeft: "4px solid #10b981", border: "1px solid rgba(16,185,129,0.2)",
                            borderLeftWidth: 4, overflow: "hidden",
                          }}>
                            <div style={{ padding: "16px 16px 14px" }}>
                              {/* Title */}
                              <div style={{ fontSize: 15, fontWeight: 800, color: "#f0f1f5", display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 18 }}>🏦</span>
                                {isEs ? "Plan Elegible para HSA (Health Savings Account)" : "HSA-Eligible Plan (Health Savings Account)"}
                              </div>

                              {/* Section 1 — What is an HSA */}
                              <div style={sH}>
                                {isEs ? "¿Qué es una HSA?" : "What is an HSA?"}
                              </div>
                              <div style={sP}>
                                {isEs
                                  ? "Una HSA es una cuenta de ahorros especial exclusivamente para gastos médicos. El dinero que depositas NO paga impuestos — ni al entrar, ni al crecer, ni al usarlo en gastos médicos."
                                  : "An HSA is a special savings account exclusively for medical expenses. The money you deposit is NOT taxed — not going in, not while growing, and not when used for medical expenses."}
                              </div>

                              {/* Section 2 — Contribution limits */}
                              <div style={sH}>
                                {isEs ? "¿Cuánto puedes depositar en 2026?" : "How much can you contribute in 2026?"}
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 2 }}>
                                {[
                                  { label: "Individual", value: "$4,300", sub: isEs ? "/año" : "/yr" },
                                  { label: isEs ? "Familia" : "Family", value: "$8,550", sub: isEs ? "/año" : "/yr" },
                                  { label: "55+", value: "+$1,000", sub: "Bonus" },
                                ].map((item, idx) => (
                                  <div key={idx} style={{ background: "rgba(16,185,129,0.06)", borderRadius: 6, padding: "8px 10px", textAlign: "center" }}>
                                    <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{item.label}</div>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: "#10b981", marginTop: 2 }}>{item.value}</div>
                                    <div style={{ fontSize: 9, color: "#5a5e72" }}>{item.sub}</div>
                                  </div>
                                ))}
                              </div>

                              {/* Section 3 — What can you pay for */}
                              <div style={sH}>
                                {isEs ? "¿Para qué sirve?" : "What can you use it for?"}
                              </div>
                              <div style={sP}>
                                {isEs
                                  ? "Paga doctor, especialista, medicinas, lentes, dentista, laboratorios, emergencias — todo libre de impuestos. Lo que no uses se acumula año tras año. No lo pierdes nunca."
                                  : "Pay for doctor, specialist, prescriptions, glasses, dentist, labs, emergencies — all tax-free. Unused funds roll over year after year. You never lose them."}
                              </div>

                              {/* Section 4 — Subsidy strategy (ONLY > 400% FPL) */}
                              {overCliff && (
                                <>
                                  <div style={{ ...sH, color: "#fbbf24", marginTop: 18 }}>
                                    💡 {isEs ? "Estrategia para recuperar tu subsidio" : "Strategy to restore your subsidy"}
                                  </div>
                                  <div style={{
                                    background: "rgba(16,185,129,0.06)", borderRadius: 8, padding: 14,
                                    border: "1px solid rgba(16,185,129,0.12)", marginBottom: 2,
                                  }}>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
                                          {isEs ? "Tu ingreso" : "Your income"}
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 2 }}>${userIncome.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
                                          {isEs ? "Límite 400% FPL" : "400% FPL Limit"}
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>${threshold400.toLocaleString()}</div>
                                      </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 10 }}>
                                      {isEs ? "Excedes el límite por" : "You exceed the limit by"}: <strong style={{ color: "#ef4444" }}>${excess.toLocaleString()}</strong>
                                    </div>

                                    <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                                      <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 6 }}>
                                        {isEs ? `Si contribuyes $${contribution.toLocaleString()} a una HSA:` : `If you contribute $${contribution.toLocaleString()} to an HSA:`}
                                      </div>
                                      <div style={{ fontSize: 12, color: "#8b8fa3", marginBottom: 4 }}>
                                        → MAGI: <strong style={{ color: "#f0f1f5" }}>${newMagi.toLocaleString()}</strong>
                                      </div>
                                      {recoversSubsidy ? (
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#10b981", marginTop: 8, padding: "8px 10px", background: "rgba(16,185,129,0.1)", borderRadius: 6 }}>
                                          ✅ {isEs ? "Vuelves a calificar para subsidio APTC" : "You qualify for APTC subsidy again"}
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fbbf24", marginTop: 8, padding: "8px 10px", background: "rgba(251,191,36,0.08)", borderRadius: 6 }}>
                                          ⚠️ {isEs
                                            ? "Aún sobre el límite. Considera también IRA tradicional ($7,000/año) o contribuciones 401k."
                                            : "Still over the limit. Also consider traditional IRA ($7,000/yr) or 401k contributions."}
                                        </div>
                                      )}
                                    </div>

                                    {recoversSubsidy && estMonthlySavings > 0 && (
                                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#10b981", textAlign: "center" }}>
                                        {isEs ? "Ahorro potencial" : "Potential savings"}: ~${(estMonthlySavings * 12).toLocaleString()}/{isEs ? "año en primas" : "yr in premiums"}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Section 5 — How to open */}
                              <div style={sH}>
                                {isEs ? "¿Cómo abrir una HSA?" : "How to open an HSA?"}
                              </div>
                              <div style={{ paddingLeft: 4 }}>
                                {(isEs ? [
                                  "Elige este plan HSA-elegible",
                                  "Abre una cuenta HSA en tu banco (Fidelity, Lively, y muchos bancos ofrecen cuentas gratis)",
                                  "Deposita antes del 15 de abril de 2027 para que cuente para impuestos 2026",
                                  "Usa los fondos con tu tarjeta HSA cuando vayas al doctor o farmacia",
                                ] : [
                                  "Choose this HSA-eligible plan",
                                  "Open an HSA at your bank (Fidelity, Lively, and many banks offer free accounts)",
                                  "Deposit by April 15, 2027 for it to count toward 2026 taxes",
                                  "Use the funds with your HSA card at the doctor or pharmacy",
                                ]).map((item, idx) => (
                                  <div key={idx} style={sBullet}>
                                    <span style={{ color: "#10b981", fontWeight: 700, fontSize: 12, minWidth: 16, flexShrink: 0 }}>{idx + 1}.</span>
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Section 6 — Real example (ONLY > 400% FPL) */}
                              {overCliff && (
                                <>
                                  <div style={sH}>
                                    {isEs ? "Ejemplo real" : "Real-world example"}
                                  </div>
                                  <div style={{
                                    background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: 12,
                                    border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, lineHeight: 1.7, color: "#8b8fa3",
                                  }}>
                                    {isEs ? (
                                      <>
                                        <strong style={{ color: "#f0f1f5" }}>María</strong> gana $65,000/año (familia de 1). El límite es $62,600.<br />
                                        <span style={{ color: "#ef4444" }}>Sin HSA:</span> Paga $450/mes de prima completa = $5,400/año<br />
                                        <span style={{ color: "#10b981" }}>Con HSA:</span> Deposita $4,300 → MAGI baja a $60,700 → Recupera subsidio → Prima $0/mes<br />
                                        <strong style={{ color: "#10b981" }}>Ahorro total: $5,400/año en primas + $1,075 en impuestos = $6,475/año</strong>
                                      </>
                                    ) : (
                                      <>
                                        <strong style={{ color: "#f0f1f5" }}>María</strong> earns $65,000/yr (family of 1). The limit is $62,600.<br />
                                        <span style={{ color: "#ef4444" }}>Without HSA:</span> Pays $450/mo full premium = $5,400/yr<br />
                                        <span style={{ color: "#10b981" }}>With HSA:</span> Deposits $4,300 → MAGI drops to $60,700 → Subsidy restored → $0/mo premium<br />
                                        <strong style={{ color: "#10b981" }}>Total savings: $5,400/yr in premiums + $1,075 in taxes = $6,475/yr</strong>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Source */}
                              <div style={{ fontSize: 10, color: "#3a3d4a", marginTop: 14, textAlign: "right" }}>
                                {isEs ? "Fuente" : "Source"}: IRS.gov Publication 969
                              </div>
                            </div>
                          </div>
                        );
                      })()}

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

              {/* HSA Expandable Card */}
              {plan.hsa && (() => {
                const isEs = lang === "es";
                return (
                  <div style={{ marginTop: 16, borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", background: "#12141c", overflow: "hidden" }}>
                    {/* Collapsed header — always visible */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setHsaOpen(!hsaOpen); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 14px", background: "rgba(16,185,129,0.08)", border: "none",
                        cursor: "pointer", fontFamily: "inherit", gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 13, color: "#10b981", fontWeight: 600 }}>
                        ✅ {isEs ? "Este plan es elegible para HSA — ahorra antes de impuestos" : "This plan is HSA-eligible — save pre-tax for medical expenses"}
                      </span>
                      <span style={{
                        fontSize: 11, color: "#5a5e72", fontWeight: 600, flexShrink: 0,
                        transition: "transform .2s", transform: hsaOpen ? "rotate(180deg)" : "rotate(0deg)",
                      }}>▼</span>
                    </button>

                    {/* Expanded body */}
                    <div style={{
                      maxHeight: hsaOpen ? 600 : 0, overflow: "hidden",
                      transition: "max-height .35s ease",
                    }}>
                      <div style={{ padding: "16px 14px", fontSize: 13, lineHeight: 1.7, color: "#8b8fa3" }}>
                        {/* Title */}
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#10b981", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>🏦</span>
                          {isEs ? "¿Qué es una HSA? (Health Savings Account)" : "What is an HSA? (Health Savings Account)"}
                        </div>

                        <div style={{ marginBottom: 14 }}>
                          {isEs
                            ? "Una HSA es como una cuenta de ahorros especial SOLO para gastos médicos. La ventaja es que el dinero que depositas NO paga impuestos."
                            : "An HSA is like a special savings account ONLY for medical expenses. The advantage is that the money you deposit is NOT taxed."}
                        </div>

                        {/* Tax savings */}
                        <div style={{ fontWeight: 700, color: "#f0f1f5", marginBottom: 6, fontSize: 13 }}>
                          💰 {isEs ? "¿Cuánto puedes ahorrar en impuestos?" : "How much can you save in taxes?"}
                        </div>
                        <div style={{ paddingLeft: 8, marginBottom: 14 }}>
                          {[
                            isEs ? "Individual: hasta $4,300/año (2026)" : "Individual: up to $4,300/year (2026)",
                            isEs ? "Familia: hasta $8,550/año (2026)" : "Family: up to $8,550/year (2026)",
                            isEs ? "Si tienes 55+: $1,000 adicional" : "Age 55+: additional $1,000 catch-up",
                          ].map((item, idx) => (
                            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3 }}>
                              <span style={{ color: "#10b981", fontSize: 8, marginTop: 6, flexShrink: 0 }}>●</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>

                        {/* How it works */}
                        <div style={{ fontWeight: 700, color: "#f0f1f5", marginBottom: 6, fontSize: 13 }}>
                          🏦 {isEs ? "¿Cómo funciona?" : "How does it work?"}
                        </div>
                        <div style={{ paddingLeft: 8, marginBottom: 14 }}>
                          {(isEs ? [
                            "Abres una cuenta HSA en tu banco (muchos son gratis)",
                            "Depositas dinero antes de impuestos",
                            "Usas ese dinero para pagar doctor, medicinas, lentes, dentista",
                            "Lo que no uses se acumula — no lo pierdes nunca",
                          ] : [
                            "Open an HSA at your bank (many are free)",
                            "Deposit money pre-tax",
                            "Use that money to pay for doctor, prescriptions, glasses, dentist",
                            "Unused funds roll over — you never lose them",
                          ]).map((item, idx) => (
                            <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3 }}>
                              <span style={{ color: "#10b981", fontWeight: 700, fontSize: 12, minWidth: 18, flexShrink: 0 }}>{idx + 1}.</span>
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>

                        {/* Agent bonus tip */}
                        <div style={{
                          background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: 12,
                          border: "1px solid rgba(16,185,129,0.15)", marginBottom: 4,
                        }}>
                          <div style={{ fontWeight: 700, color: "#10b981", marginBottom: 6, fontSize: 13 }}>
                            ⚡ {isEs ? "Beneficio extra para agentes:" : "Bonus tip for agents:"}
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            {isEs
                              ? "Contribuir a una HSA REDUCE tu ingreso gravable (MAGI). Si tu cliente está cerca del límite de subsidio (400% FPL), una HSA puede ayudarle a mantenerse elegible para el subsidio APTC."
                              : "Contributing to an HSA REDUCES your taxable income (MAGI). If your client is near the subsidy cliff (400% FPL), an HSA can help them stay eligible for the APTC subsidy."}
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#f0f1f5", lineHeight: 1.6 }}>
                            {isEs
                              ? "Ejemplo: Si ganas $64,000 (sobre el límite), contribuir $4,300 a una HSA baja tu MAGI a $59,700 — y vuelves a calificar para subsidio."
                              : "Example: If you earn $64,000 (over the limit), contributing $4,300 to an HSA lowers your MAGI to $59,700 — and you qualify for subsidy again."}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
