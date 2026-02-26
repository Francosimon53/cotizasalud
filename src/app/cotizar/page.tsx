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
        <span key={i} style={{ color: i <= n ? "#f59e0b" : "#e5e7eb" }}>★</span>
      ))}
    </span>
  );
}

function Badge({ metal, t }: { metal: string; t: Record<string, string> }) {
  const c: Record<string, string> = {
    catastrophic: "#374151", bronze: "#92400e", silver: "#6b7280", gold: "#b45309", platinum: "#4338ca",
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
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < step ? "#059669" : "#e5e7eb", transition: "all .3s" }} />
      ))}
    </div>
  );
}

function StepLabel({ num, label }: { num: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#059669", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{num}</div>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#064e3b" }}>{label}</span>
    </div>
  );
}

// ==================== STYLES ====================
const S = {
  app: { fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#f7faf8", color: "#1a1a1a" } as React.CSSProperties,
  hdr: { background: "linear-gradient(135deg, #022c22 0%, #064e3b 60%, #065f46 100%)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  logo: { color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  logoIcon: { width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 } as React.CSSProperties,
  langBtn: { padding: "5px 12px", borderRadius: 5, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  hero: { background: "linear-gradient(135deg, #022c22 0%, #064e3b 60%, #065f46 100%)", padding: "12px 20px 44px", textAlign: "center" as const } as React.CSSProperties,
  wrap: { maxWidth: 640, margin: "-24px auto 0", padding: "0 14px 40px", position: "relative" as const } as React.CSSProperties,
  card: { background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 8px 20px rgba(0,0,0,.03)", border: "1px solid #e8ecea" } as React.CSSProperties,
  label: { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5, color: "#374151", textTransform: "uppercase" as const, letterSpacing: 0.5 } as React.CSSProperties,
  input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit" } as React.CSSProperties,
  select: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box" as const, background: "#fff", fontFamily: "inherit" } as React.CSSProperties,
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "13px 28px", borderRadius: 9, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  pri: { background: "#059669", color: "#fff" },
  sec: { background: "#f3f4f6", color: "#374151" },
  dis: { background: "#e5e7eb", color: "#9ca3af", cursor: "not-allowed" },
  row: { display: "flex", gap: 10 } as React.CSSProperties,
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } as React.CSSProperties,
  g4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 } as React.CSSProperties,
  memberCard: { background: "#f9fafb", borderRadius: 10, padding: 16, marginBottom: 12, border: "1px solid #e5e7eb" } as React.CSSProperties,
  stat: { background: "#f8faf9", borderRadius: 8, padding: "9px 10px", textAlign: "center" as const } as React.CSSProperties,
  statL: { fontSize: 9, color: "#6b7280", textTransform: "uppercase" as const, fontWeight: 700, letterSpacing: 0.5 } as React.CSSProperties,
  statV: { fontSize: 16, fontWeight: 800, color: "#1a1a1a", marginTop: 1 } as React.CSSProperties,
  planCard: { background: "#fff", borderRadius: 11, padding: 18, marginBottom: 12, border: "1.5px solid #e5e7eb", cursor: "pointer" } as React.CSSProperties,
  planExp: { background: "#fff", borderRadius: 11, padding: 18, marginBottom: 12, border: "2px solid #059669", boxShadow: "0 4px 16px rgba(5,150,105,.1)" } as React.CSSProperties,
  alert: { background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 13, color: "#92400e", lineHeight: 1.5 } as React.CSSProperties,
  subBanner: { background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", border: "1px solid #6ee7b7", borderRadius: 10, padding: 18, marginBottom: 18, textAlign: "center" as const } as React.CSSProperties,
  tyCard: { background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderRadius: 14, padding: 32, textAlign: "center" as const, border: "1px solid #6ee7b7" } as React.CSSProperties,
  footer: { textAlign: "center" as const, padding: "24px 14px", fontSize: 10, color: "#9ca3af", lineHeight: 1.6, maxWidth: 640, margin: "0 auto" } as React.CSSProperties,
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: "5px 13px", borderRadius: 20, border: `1.5px solid ${active ? "#059669" : "#d1d5db"}`,
  fontSize: 11, fontWeight: 700, cursor: "pointer", background: active ? "#ecfdf5" : "#fff",
  color: active ? "#059669" : "#6b7280",
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
            {county?.name}, {county?.state} · {house.length}p · ${Number(income).toLocaleString()}/yr
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
            {county && <div style={{ fontSize: 13, color: "#059669", marginBottom: 18, fontWeight: 600 }}>📍 {county.name}, {county.state}</div>}
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
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#064e3b" }}>{t.person} {i + 1}</span>
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
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontWeight: 700 }}>$</span>
                <input style={{ ...S.input, paddingLeft: 26 }} type="text" value={income ? Number(income).toLocaleString() : ""} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} placeholder={t.incomePh} />
              </div>
            </div>
            {income && (
              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#065f46" }}>
                <strong>{t.fplLabel}:</strong> {fpl}% FPL
                <span style={{ color: "#6b7280", marginLeft: 6 }}>(${getFPL(house.length).toLocaleString()} / {house.length}p)</span>
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
            <div style={{ fontSize: 18, fontWeight: 800, color: "#064e3b", marginBottom: 4 }}>{t.leadTitle}</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 1.5 }}>{t.leadSub}</div>
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
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }} />
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
            {results.aptc > 0 && (
              <div style={S.subBanner}>
                <div style={{ fontSize: 12, color: "#065f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{t.subsidyLabel}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#059669", letterSpacing: -1 }}>${results.aptc}<span style={{ fontSize: 16, fontWeight: 600 }}>{t.mo}</span></div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {["all", "bronze", "silver", "gold", "platinum"].map((m) => (
                <button key={m} style={chip(metalFilter === m)} onClick={() => setMetalFilter(m)}>{t[m] || m}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>{t.sort}:</span>
              <select style={{ ...S.select, width: "auto", padding: "5px 10px", fontSize: 12 }} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="afterSubsidy">{t.sortPremium}</option>
                <option value="deductible">{t.sortDeduct}</option>
                <option value="oopMax">{t.sortOop}</option>
                <option value="rating">{t.sortRate}</option>
              </select>
              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>{filtered?.length} {t.planCount}</span>
            </div>
            {filtered?.map((plan) => {
              const exp = expandedPlan === plan.id;
              return (
                <div key={plan.id} style={exp ? S.planExp : S.planCard} onClick={() => setExpandedPlan(exp ? null : plan.id)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <Badge metal={plan.metal} t={t} />
                      <div style={{ fontSize: 14, fontWeight: 800, marginTop: 7, color: "#1a1a1a", lineHeight: 1.3 }}>{plan.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{plan.issuer}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {plan.aptc > 0 && <div style={{ fontSize: 11, color: "#b0b0b0", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#059669", letterSpacing: -0.5 }}>${plan.afterSubsidy}</div>
                      <div style={{ fontSize: 10, color: "#6b7280" }}>{t.mo}</div>
                    </div>
                  </div>
                  <div style={S.g4}>
                    <div style={S.stat}><div style={S.statL}>{t.deductible}</div><div style={{ ...S.statV, fontSize: 14 }}>${plan.deductible.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.oopMax}</div><div style={{ ...S.statV, fontSize: 14 }}>${plan.oopMax.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.quality}</div><Stars n={plan.rating} /></div>
                    <div style={S.stat}><div style={S.statL}>HSA</div><div style={{ ...S.statV, fontSize: 14, color: plan.hsa ? "#059669" : "#d1d5db" }}>{plan.hsa ? "✓" : "—"}</div></div>
                  </div>
                  {exp && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Copays</div>
                      <div style={S.g4}>
                        <div style={S.stat}><div style={S.statL}>{t.pcp}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.pcp ? `$${plan.pcp}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.specialist}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.specialist ? `$${plan.specialist}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.rx}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.genericRx ? `$${plan.genericRx}` : "—"}</div></div>
                        <div style={S.stat}><div style={S.statL}>{t.er}</div><div style={{ ...S.statV, fontSize: 13 }}>{plan.er ? `$${plan.er}` : "—"}</div></div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, marginTop: 14, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
                      <div style={S.g3}>
                        <div style={{ ...S.stat, background: "#f0fdf4" }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yLow.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "#fffbeb" }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yMed.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "#fef2f2" }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yHigh.toLocaleString()}</div></div>
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
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "#1a1a1a", lineHeight: 1.2 }}>{plan.name}</div>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{plan.issuer}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {plan.aptc > 0 && <div style={{ fontSize: 12, color: "#b0b0b0", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#059669", letterSpacing: -1 }}>${plan.afterSubsidy}</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>{t.mo}</div>
                </div>
              </div>

              {/* Subsidy Banner */}
              {plan.aptc > 0 && (
                <div style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #6ee7b7" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.subsidyLabel}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{t.subsidyApplied || "Applied to your premium"}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>-${plan.aptc}{t.mo}</div>
                </div>
              )}

              {/* Key Numbers */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.planDetails || "Plan Details"}</div>
              <div style={S.g2}>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.premium}</div>
                  <div style={{ ...S.statV, fontSize: 20 }}>${plan.afterSubsidy}<span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280" }}>{t.mo}</span></div>
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
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Copays</div>
              <div style={S.g4}>
                <div style={S.stat}><div style={S.statL}>{t.pcp}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.pcp ? `$${plan.pcp}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.specialist}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.specialist ? `$${plan.specialist}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.rx}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.genericRx ? `$${plan.genericRx}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.er}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.er ? `$${plan.er}` : "—"}</div></div>
              </div>

              {/* Annual Cost Estimates */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
              <div style={S.g3}>
                <div style={{ ...S.stat, background: "#f0fdf4", padding: 14 }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yLow.toLocaleString()}</div><div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "#fffbeb", padding: 14 }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yMed.toLocaleString()}</div><div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "#fef2f2", padding: 14 }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yHigh.toLocaleString()}</div><div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
              </div>

              {/* HSA */}
              {plan.hsa && (
                <div style={{ background: "#eff6ff", borderRadius: 8, padding: 12, marginTop: 16, fontSize: 13, color: "#1e40af", border: "1px solid #bfdbfe" }}>
                  ✅ {t.hsaEligible || "This plan is HSA-eligible — you can save pre-tax for medical expenses"}
                </div>
              )}

              {/* Summary for lead */}
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16, marginTop: 20, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{t.yourInfo || "Your Information"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#374151" }}>
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
            <div style={{ fontSize: 22, fontWeight: 900, color: "#064e3b", marginBottom: 8 }}>{t.tyTitle}</div>
            <div style={{ fontSize: 14, color: "#065f46", marginBottom: 16, lineHeight: 1.6 }}>{t.tySub}</div>
            {selectedPlanId && results && (() => {
              const plan = results.plans.find((p: any) => p.id === selectedPlanId);
              if (!plan) return null;
              return (
                <div style={{ background: "#fff", borderRadius: 10, padding: 16, marginBottom: 16, textAlign: "left", border: "1px solid #d1fae5" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t.tySelected}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><Badge metal={plan.metal} t={t} /><div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>{plan.name}</div></div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#059669" }}>${plan.afterSubsidy}<span style={{ fontSize: 12, fontWeight: 600 }}>{t.mo}</span></div>
                  </div>
                </div>
              );
            })()}
            <div style={{ fontSize: 13, color: "#065f46", lineHeight: 1.6 }}>{t.tyDetail}</div>
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
