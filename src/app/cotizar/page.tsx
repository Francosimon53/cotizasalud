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
function SubsidyCliffAlert({ fplPct, income, houseSize, lang }: {
  fplPct: number; income: number; houseSize: number; lang: string;
}) {
  const [open, setOpen] = useState(true);

  const fplBase = 15650 + (houseSize - 1) * 5500;
  const threshold400 = fplBase * 4;
  const isEs = lang === "es";

  type Zone = "medicaid" | "green" | "yellow" | "red";
  let zone: Zone;
  if (fplPct < 138) zone = "medicaid";
  else if (fplPct < 350) zone = "green";
  else if (fplPct <= 400) zone = "yellow";
  else zone = "red";

  const cfg = {
    medicaid: {
      icon: "ℹ️", color: "#60a5fa",
      bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)",
      title: isEs ? "Posible elegibilidad para Medicaid" : "Possible Medicaid Eligibility",
      body: isEs
        ? "Con este ingreso podrías calificar para Medicaid en Florida. Te recomendamos verificar tu elegibilidad antes de comprar un plan del Marketplace."
        : "At this income level, you may qualify for Medicaid in Florida. We recommend verifying your eligibility before purchasing a Marketplace plan.",
    },
    green: {
      icon: "✅", color: "#10b981",
      bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)",
      title: isEs ? "Calificas para subsidio APTC" : "You qualify for APTC subsidy",
      body: isEs
        ? "Tu estimado de ahorro aparecerá en los planes. Estás en una zona cómoda, lejos del límite de subsidio."
        : "Your estimated savings will appear on plans. You're in a comfortable zone, well below the subsidy cliff.",
    },
    yellow: {
      icon: "⚠️", color: "#fbbf24",
      bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.3)",
      title: isEs ? "Cerca del límite de subsidio" : "Near the Subsidy Cliff",
      body: isEs
        ? `Tu ingreso está cerca del límite de subsidio (400% FPL). Si tu ingreso real en 2026 supera $${threshold400.toLocaleString()}, perderías TODO el subsidio.\n\nTip: Contribuciones a HSA o cuentas de retiro pre-tax pueden reducir tu ingreso elegible (MAGI).`
        : `Your income is near the subsidy cliff (400% FPL). If your actual 2026 income exceeds $${threshold400.toLocaleString()}, you'd lose ALL subsidy.\n\nTip: HSA contributions or pre-tax retirement accounts can reduce your eligible income (MAGI).`,
    },
    red: {
      icon: "🚨", color: "#ef4444",
      bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)",
      title: isEs ? "Subsidy Cliff — Sin subsidio" : "Subsidy Cliff — No Subsidy",
      body: isEs
        ? "Tu ingreso supera el 400% del nivel federal de pobreza. No calificas para subsidio APTC en 2026. Tu prima será el precio completo.\n\nOpciones: Revisa si puedes reducir tu MAGI con HSA ($4,300 individual / $8,550 familia) o contribuciones a IRA tradicional."
        : "Your income exceeds 400% of the Federal Poverty Level. You don't qualify for APTC subsidy in 2026. Your premium will be full price.\n\nOptions: Check if you can reduce your MAGI with HSA ($4,300 individual / $8,550 family) or traditional IRA contributions.",
    },
  };

  const a = cfg[zone];
  const meterMax = 500;
  const pctPos = Math.min((fplPct / meterMax) * 100, 100);
  const z300 = (300 / meterMax) * 100;
  const z380 = (380 / meterMax) * 100;
  const z400 = (400 / meterMax) * 100;

  return (
    <div style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 10, marginBottom: 18, overflow: "hidden" }}>
      {/* Header — always visible */}
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}>
        <span style={{ fontSize: 18 }}>{a.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: a.color }}>{a.title}</div>
          <div style={{ fontSize: 11, color: "#5a5e72", marginTop: 2 }}>
            ${income.toLocaleString()}{isEs ? "/año" : "/yr"} · {fplPct}% FPL · {houseSize}{isEs ? " personas" : "p"}
          </div>
        </div>
        <span style={{ fontSize: 11, color: "#5a5e72", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
      </div>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* FPL Meter */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: "relative", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${z300}%`, borderRadius: "4px 0 0 4px", background: "rgba(16,185,129,0.4)" }} />
              <div style={{ position: "absolute", left: `${z300}%`, top: 0, bottom: 0, width: `${z380 - z300}%`, background: "rgba(251,191,36,0.4)" }} />
              <div style={{ position: "absolute", left: `${z380}%`, top: 0, bottom: 0, width: `${z400 - z380}%`, background: "rgba(249,115,22,0.5)" }} />
              <div style={{ position: "absolute", left: `${z400}%`, top: 0, bottom: 0, right: 0, borderRadius: "0 4px 4px 0", background: "rgba(239,68,68,0.4)" }} />
              <div style={{ position: "absolute", left: `${z400}%`, top: -4, bottom: -4, width: 2, background: "#ef4444", zIndex: 2 }} />
              <div style={{ position: "absolute", left: `${pctPos}%`, top: "50%", transform: "translate(-50%, -50%)", width: 14, height: 14, borderRadius: 7, background: a.color, border: "2px solid #08090d", zIndex: 3, boxShadow: `0 0 8px ${a.color}40` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "#5a5e72", fontWeight: 600 }}>
              <span>138%</span>
              <span>300%</span>
              <span style={{ color: "#ef4444", fontWeight: 800 }}>400%</span>
              <span>500%</span>
            </div>
          </div>

          {/* Alert message */}
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "#8b8fa3" }}>
            {a.body.split("\n\n").map((p, i) => (
              <div key={i} style={{ marginBottom: i < a.body.split("\n\n").length - 1 ? 8 : 0 }}>
                {i > 0 && <span style={{ color: a.color, fontWeight: 700 }}>💡 </span>}{p}
              </div>
            ))}
          </div>

          {/* Threshold callout for yellow/red */}
          {(zone === "yellow" || zone === "red") && (
            <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 16, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {isEs ? "Límite 400% FPL" : "400% FPL Threshold"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#ef4444", marginTop: 2 }}>${threshold400.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {isEs ? "Tu ingreso" : "Your Income"}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: a.color, marginTop: 2 }}>${income.toLocaleString()}</div>
              </div>
              {zone === "yellow" && (
                <div style={{ marginLeft: "auto" }}>
                  <div style={{ fontSize: 10, color: "#5a5e72", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {isEs ? "Margen" : "Buffer"}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>${(threshold400 - income).toLocaleString()}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
            <SubsidyCliffAlert fplPct={fpl} income={Number(income)} houseSize={house.length} lang={lang} />

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
                    {(() => {
                      const hsaHighlight = plan.hsa && fpl >= 350;
                      const hsaUrgent = plan.hsa && fpl > 400;
                      if (hsaHighlight) {
                        return (
                          <div style={{
                            ...S.stat,
                            background: hsaUrgent ? "rgba(251,191,36,0.12)" : "rgba(16,185,129,0.12)",
                            border: `1px solid ${hsaUrgent ? "rgba(251,191,36,0.3)" : "rgba(16,185,129,0.25)"}`,
                            borderRadius: 8, padding: "8px 10px", gridColumn: "1 / -1",
                            animation: "hsa-glow 2s ease-in-out infinite",
                          }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: hsaUrgent ? "#fbbf24" : "#10b981", display: "flex", alignItems: "center", gap: 6 }}>
                              {hsaUrgent ? "🏦" : "✓"} HSA
                            </div>
                            <div style={{ fontSize: 11, color: hsaUrgent ? "#fcd34d" : "#34d399", fontWeight: 600, marginTop: 2 }}>
                              {hsaUrgent
                                ? (lang === "es" ? "Podría devolverte el subsidio" : "Could restore your subsidy")
                                : (lang === "es" ? "Puede reducir tu ingreso" : "Can lower your income")}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div style={S.stat}><div style={S.statL}>HSA</div><div style={{ ...S.statV, fontSize: 14, color: plan.hsa ? "#10b981" : "#2a2d3a" }}>{plan.hsa ? "✓" : "—"}</div></div>
                      );
                    })()}
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
