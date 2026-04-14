"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { saveLead, saveConsent, savePlanSelection } from "@/lib/save-lead";
import { i18n, type Lang } from "@/lib/i18n";
import { lookupCounties, getFPL, getFPLpct } from "@/lib/data";
import { generateQuote } from "@/lib/plans";
import type { County, HouseholdMember, Plan, QuoteResults, AgentBrand } from "@/lib/types";
import CMSConsentForm, { type ConsentRecord } from "./CMSConsentForm";
import SignaturePad from "./SignaturePad";

const AIPlanAdvisor = dynamic(() => import("./AIPlanAdvisor"), {
  loading: () => <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#94A3B8" }}>Loading advisor...</div>,
});

// ==================== URL PARSER ====================
function parseSmartLink() {
  if (typeof window === "undefined") return { name: "", zip: "", phone: "", email: "", agentSlug: "", lang: "", utm_source: "", utm_medium: "", utm_campaign: "" };
  const p = new URLSearchParams(window.location.search);
  const path = window.location.pathname;
  const slugMatch = path.match(/\/q\/([a-zA-Z0-9_-]+)/);
  return {
    name: p.get("n") || p.get("name") || "",
    zip: p.get("z") || p.get("zip") || "",
    phone: p.get("p") || p.get("phone") || "",
    email: p.get("e") || p.get("email") || "",
    agentSlug: slugMatch?.[1] || p.get("agent") || "",
    lang: p.get("lang") || "",
    utm_source: p.get("utm_source") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_campaign: p.get("utm_campaign") || "",
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

const METAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  catastrophic: { bg: "#374151", text: "#d1d5db", border: "rgba(107,114,128,0.4)" },
  bronze: { bg: "#78350f", text: "#fde68a", border: "rgba(146,64,14,0.6)" },
  silver: { bg: "#374151", text: "#e5e7eb", border: "rgba(156,163,175,0.5)" },
  gold: { bg: "#78350f", text: "#fcd34d", border: "rgba(180,83,9,0.6)" },
  platinum: { bg: "#312e81", text: "#c4b5fd", border: "rgba(67,56,202,0.5)" },
};

function Badge({ metal, t }: { metal: string; t: Record<string, string> }) {
  const mc = METAL_COLORS[metal] || METAL_COLORS.catastrophic;
  return (
    <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 6, fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8, color: mc.text, backgroundColor: mc.bg, border: `1px solid ${mc.border}` }}>
      {t[metal] || metal}
    </span>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < step ? "#10b981" : "#1a1c26", transition: "all .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textAlign: "center" }}>
        Paso {step} de {total}
      </div>
    </div>
  );
}

function StepLabel({ num, label }: { num: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
      <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#0D9488", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{num}</div>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#0D9488" }}>{label}</span>
    </div>
  );
}

// ==================== FPL INDICATOR BAR ====================
function FPLIndicator({ fplPct, income, houseSize, lang, maxAge }: {
  fplPct: number; income: number; houseSize: number; lang: string; maxAge: number;
}) {
  const [techOpen, setTechOpen] = useState(false);
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
  const meterMax = 520;
  const pctPos = Math.min(Math.max((fplPct - 100) / (meterMax - 100) * 100, 0), 100);
  const zP = (v: number) => ((v - 100) / (meterMax - 100)) * 100;

  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${zoneBorder}`, borderRadius: 12, marginBottom: 18, overflow: "hidden", padding: 18 }}>
      {/* FPL METER BAR */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ position: "relative", height: 14, borderRadius: 7, background: "#F1F5F9", overflow: "visible" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${zP(250)}%`, borderRadius: "7px 0 0 7px", background: "rgba(16,185,129,0.35)" }} />
          <div style={{ position: "absolute", left: `${zP(250)}%`, top: 0, bottom: 0, width: `${zP(300) - zP(250)}%`, background: "rgba(16,185,129,0.2)" }} />
          <div style={{ position: "absolute", left: `${zP(300)}%`, top: 0, bottom: 0, width: `${zP(350) - zP(300)}%`, background: "rgba(251,191,36,0.25)" }} />
          <div style={{ position: "absolute", left: `${zP(350)}%`, top: 0, bottom: 0, width: `${zP(400) - zP(350)}%`, background: "rgba(249,115,22,0.35)" }} />
          <div style={{ position: "absolute", left: `${zP(400)}%`, top: 0, bottom: 0, right: 0, borderRadius: "0 7px 7px 0", background: "rgba(239,68,68,0.35)" }} />
          <div style={{ position: "absolute", left: `${zP(400)}%`, top: -6, bottom: -6, width: 2, background: "#ef4444", zIndex: 2 }} />
          <div style={{ position: "absolute", left: `${pctPos}%`, top: "50%", transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: 9, background: "#fff", border: `3px solid ${zoneColor}`, zIndex: 3, boxShadow: `0 0 10px ${zoneColor}60` }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 9, color: "#94A3B8", fontWeight: 600 }}>
          <span style={{ color: "#0D9488" }}>138%</span>
          <span>250%</span>
          <span>300%</span>
          <span>350%</span>
          <span style={{ color: "#ef4444", fontWeight: 800 }}>400%</span>
          <span>500%+</span>
        </div>
        <div style={{ textAlign: "center", marginTop: 10, padding: "10px 16px", borderRadius: 10, background: `${zoneColor}15`, border: `1px solid ${zoneColor}30` }}>
          <div style={{ fontSize: 14, color: "#334155", fontWeight: 600 }}>
            {isEs ? "Tu posición" : "Your position"}: <strong style={{ color: zoneColor, fontSize: 20 }}>{fplPct}% FPL</strong>
          </div>
          <div style={{ fontSize: 15, color: zoneColor, fontWeight: 800, marginTop: 4 }}>{zoneName}</div>
        </div>
      </div>

      {/* Technical details toggle */}
      <div style={{ marginTop: 12, borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <button
          onClick={() => setTechOpen(!techOpen)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "#F8FAFC", border: "none",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
            📊 {isEs ? "Ver datos técnicos detallados" : "View detailed technical data"}
          </span>
          <span style={{ fontSize: 10, color: "#94A3B8", transition: "transform .2s", transform: techOpen ? "rotate(180deg)" : "none" }}>▼</span>
        </button>
        <div style={{ maxHeight: techOpen ? 2000 : 0, overflow: "hidden", transition: "max-height .4s ease" }}>
          <div style={{ padding: "12px 14px", fontSize: 12, lineHeight: 1.7, color: "#6b7280" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div><div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>FPL%</div><div style={{ fontSize: 18, fontWeight: 800, color: zoneColor, marginTop: 2 }}>{fplPct}%</div></div>
              <div><div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{isEs ? "Límite 400%" : "400% Limit"}</div><div style={{ fontSize: 18, fontWeight: 800, color: "#ef4444", marginTop: 2 }}>${threshold400.toLocaleString()}</div></div>
              <div><div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{zone === "red" ? (isEs ? "Exceso" : "Excess") : (isEs ? "Margen" : "Buffer")}</div><div style={{ fontSize: 18, fontWeight: 800, color: zone === "red" ? "#ef4444" : "#fbbf24", marginTop: 2 }}>${(zone === "red" ? excess : buffer).toLocaleString()}</div></div>
            </div>
            <div style={{ marginBottom: 8, fontSize: 11 }}>
              <strong style={{ color: "#64748B" }}>MAGI {isEs ? "reducción opciones" : "reduction options"}:</strong>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
              • HSA ({isFamily ? (isEs ? "familia" : "family") : "individual"}): ${hsaLimit.toLocaleString()}/{isEs ? "año" : "yr"}<br />
              • IRA: ${(maxAge >= 50 ? 8000 : 7000).toLocaleString()}/{isEs ? "año" : "yr"}<br />
              • 401(k): $23,500/{isEs ? "año" : "yr"}<br />
              • {isEs ? "Prima completa est." : "Est. full premium"}: ~${fullPremium}/{isEs ? "mes" : "mo"}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: "#CBD5E1" }}>
              {isEs ? "Fuente" : "Source"}: IRS.gov, Healthcare.gov, KFF.org
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== STYLES (light professional theme) ====================
const S = {
  app: { fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", minHeight: "100vh", background: "#FFFFFF", color: "#1E293B" } as React.CSSProperties,
  hdr: { background: "#FFFFFF", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0" } as React.CSSProperties,
  logo: { color: "#1E3A5F", fontSize: 18, fontWeight: 800, letterSpacing: -0.5, display: "flex", alignItems: "center", gap: 8 } as React.CSSProperties,
  logoIcon: { width: 30, height: 30, borderRadius: 7, background: "rgba(13,148,136,.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 } as React.CSSProperties,
  langBtn: { padding: "5px 12px", borderRadius: 5, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#1E3A5F", fontSize: 12, fontWeight: 700, cursor: "pointer" } as React.CSSProperties,
  hero: { background: "#1E3A5F", padding: "12px 20px 44px", textAlign: "center" as const } as React.CSSProperties,
  wrap: { maxWidth: 640, margin: "-24px auto 0", padding: "0 14px 40px", position: "relative" as const } as React.CSSProperties,
  card: { background: "#FFFFFF", borderRadius: 14, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,.06), 0 4px 12px rgba(0,0,0,.04)", border: "1px solid #E2E8F0" } as React.CSSProperties,
  label: { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#1E293B", textTransform: "uppercase" as const, letterSpacing: 0.5 } as React.CSSProperties,
  input: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 15, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit", background: "#FFFFFF", color: "#1E293B" } as React.CSSProperties,
  select: { width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #E2E8F0", fontSize: 15, outline: "none", boxSizing: "border-box" as const, background: "#FFFFFF", fontFamily: "inherit", color: "#1E293B" } as React.CSSProperties,
  btn: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "15px 28px", borderRadius: 10, border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 48 } as React.CSSProperties,
  pri: { background: "#0D9488", color: "#fff" },
  sec: { background: "#FFFFFF", color: "#1E3A5F", border: "1px solid #CBD5E1" },
  dis: { background: "#F1F5F9", color: "#94A3B8", cursor: "not-allowed" },
  row: { display: "flex", gap: 10 } as React.CSSProperties,
  g2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 } as React.CSSProperties,
  g3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } as React.CSSProperties,
  g4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 } as React.CSSProperties,
  memberCard: { background: "#F8FAFC", borderRadius: 10, padding: 16, marginBottom: 12, border: "1px solid #E2E8F0" } as React.CSSProperties,
  stat: { background: "#F8FAFC", borderRadius: 8, padding: "9px 10px", textAlign: "center" as const } as React.CSSProperties,
  statL: { fontSize: 10, color: "#64748B", textTransform: "uppercase" as const, fontWeight: 700, letterSpacing: 0.3 } as React.CSSProperties,
  statV: { fontSize: 17, fontWeight: 900, color: "#1E293B", marginTop: 2 } as React.CSSProperties,
  planCard: { background: "#FFFFFF", borderRadius: 14, padding: 20, marginBottom: 14, border: "2px solid #E2E8F0", cursor: "pointer", transition: "all .2s" } as React.CSSProperties,
  planExp: { background: "#FFFFFF", borderRadius: 14, padding: 20, marginBottom: 14, border: "2px solid #0D9488", boxShadow: "0 4px 20px rgba(13,148,136,.1)" } as React.CSSProperties,
  alert: { background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 8, padding: 14, marginBottom: 18, fontSize: 13, color: "#D97706", lineHeight: 1.5 } as React.CSSProperties,
  subBanner: { background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 10, padding: 18, marginBottom: 18, textAlign: "center" as const } as React.CSSProperties,
  tyCard: { background: "rgba(5,150,105,0.04)", borderRadius: 14, padding: 32, textAlign: "center" as const, border: "1px solid rgba(5,150,105,0.2)" } as React.CSSProperties,
  footer: { textAlign: "center" as const, padding: "24px 14px", fontSize: 10, color: "#94A3B8", lineHeight: 1.6, maxWidth: 640, margin: "0 auto" } as React.CSSProperties,
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: "7px 16px", borderRadius: 20, border: `1.5px solid ${active ? "#0D9488" : "#CBD5E1"}`,
  fontSize: 13, fontWeight: 700, cursor: "pointer", background: active ? "rgba(13,148,136,0.08)" : "#FFFFFF",
  color: active ? "#0D9488" : "#64748B", minHeight: 36,
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadLang, setLeadLang] = useState("es");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateForm, setStateForm] = useState("FL");
  const [aptNumber, setAptNumber] = useState("");
  const [currentInsurance, setCurrentInsurance] = useState("");
  const [currentInsuranceName, setCurrentInsuranceName] = useState("");
  const [contactPreference, setContactPreference] = useState<string[]>([]);
  const [bestCallTime, setBestCallTime] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [results, setResults] = useState<QuoteResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMockData, setIsMockData] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [drugSearchError, setDrugSearchError] = useState(false);
  const [doctorSearchError, setDoctorSearchError] = useState(false);
  const [sortKey, setSortKey] = useState("afterSubsidy");
  const [metalFilter, setMetalFilter] = useState("all");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [urlParams, setUrlParams] = useState<ReturnType<typeof parseSmartLink>>({ name: "", zip: "", phone: "", email: "", agentSlug: "", lang: "", utm_source: "", utm_medium: "", utm_campaign: "" });
  const [agentBrand, setAgentBrand] = useState<AgentBrand | null>(null);

  // Drug & doctor search
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<{ rxcui: string; name: string; strength: string; route: string }[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<{ rxcui: string; name: string } | null>(null);
  const [drugOpen, setDrugOpen] = useState(false);
  const [doctorQuery, setDoctorQuery] = useState("");
  const [doctorResults, setDoctorResults] = useState<{ npi: string; name: string; specialty: string; address: string }[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<{ npi: string; name: string; specialty: string } | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [drugCoverage, setDrugCoverage] = useState<Record<string, "covered" | "not_covered" | "checking" | "unknown">>({});
  const [doctorNetwork, setDoctorNetwork] = useState<Record<string, "in_network" | "not_found" | "checking">>({});
  const drugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doctorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t: Record<string, string> = i18n[lang];

  // Smart link init + agent profile fetch
  useEffect(() => {
    const params = parseSmartLink();
    setUrlParams(params);
    if (params.lang === "en" || params.lang === "es") setLang(params.lang);
    if (params.name) {
      const parts = decodeURIComponent(params.name).split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
    if (params.phone) setLeadPhone(params.phone);
    if (params.email) setLeadEmail(decodeURIComponent(params.email));
    if (params.zip && /^\d{5}$/.test(params.zip)) setZip(params.zip);
    // Fetch agent profile — from URL slug or default agent
    const slugToFetch = params.agentSlug || "";
    if (slugToFetch) {
      setAgentBrand({ slug: slugToFetch, name: slugToFetch, npn: "" });
    }
    // Always try to fetch agent (URL slug or default via API)
    const fetchSlug = slugToFetch || "default";
    fetch(`/api/agents?slug=${encodeURIComponent(fetchSlug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((agent) => {
        if (agent) {
          setAgentBrand({
            slug: agent.slug,
            name: agent.name,
            npn: agent.npn || "",
            brand_name: agent.brand_name || "",
            brand_color: agent.brand_color || "#10b981",
            email: agent.email || "",
            phone: agent.phone || "",
            logo_url: agent.logo_url || "",
          });
        }
      })
      .catch(() => {});
  }, []);

  // ZIP lookup — CMS API with client-side cache
  const countyCache = useRef<Map<string, County[]>>(new Map());
  useEffect(() => {
    if (zip.length !== 5) { setCounties([]); setCounty(null); setZipLoading(false); return; }
    const cached = countyCache.current.get(zip);
    if (cached) {
      setCounties(cached);
      if (cached.length === 1) setCounty(cached[0]);
      return;
    }
    let cancelled = false;
    setZipLoading(true);
    (async () => {
      let result: County[] = [];
      try {
        const res = await fetch(`/api/cms/counties?zip=${zip}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        if (data.counties?.length > 0) result = data.counties;
      } catch (err) {
        console.error("CMS county lookup failed, using fallback:", err);
      }
      if (result.length === 0) result = lookupCounties(zip);
      countyCache.current.set(zip, result);
      if (!cancelled) {
        setCounties(result);
        if (result.length === 1) setCounty(result[0]);
        setZipLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [zip]);

  // Auto-skip location if ZIP pre-filled
  useEffect(() => {
    if (urlParams.zip && county && step === 1) setStep(2);
  }, [county, urlParams.zip, step]);

  const addPerson = () => house.length < 8 && setHouse([...house, { age: 25, gender: "Female", tobacco: false }]);
  const removePerson = (i: number) => house.length > 1 && setHouse(house.filter((_, j) => j !== i));
  const updatePerson = (i: number, k: keyof HouseholdMember, v: any) => {
    const h = [...house];
    if (k === "dob") {
      h[i] = { ...h[i], dob: v };
      if (v) {
        const birth = new Date(v + "T00:00:00");
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        h[i].age = Math.max(0, Math.min(120, age));
      }
    } else if (k === "age") {
      const num = typeof v === "string" ? (v === "" ? 0 : parseInt(v) || 0) : v;
      h[i] = { ...h[i], age: Math.max(0, Math.min(120, num)) };
    } else {
      h[i] = { ...h[i], [k]: v };
    }
    setHouse(h);
  };
  const leadName = `${firstName} ${lastName}`.trim();
  const householdValid = house.every((m) => m.dob && m.age >= 0 && m.age <= 120);
  const phoneDigits = leadPhone.replace(/\D/g, "");
  const phoneValid = phoneDigits.length === 10;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail);
  const firstNameValid = firstName.trim().length >= 2;
  const lastNameValid = lastName.trim().length >= 2;
  const addressValid = streetAddress.trim().length >= 3 && city.trim().length >= 2;
  const contactFormValid = firstNameValid && lastNameValid && phoneValid && emailValid && addressValid && !!signatureData;

  const browseLeadCreated = useRef(false);

  const doSearch = async () => {
    if (!county) return;
    setLoading(true);
    setIsMockData(false);

    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipcode: zip,
          countyfips: county.fips,
          state: county.state,
          income: Number(income),
          household: house,
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      if (data.plans?.length > 0) {
        setResults({ plans: data.plans, aptc: data.aptc, fplPct: data.fplPct });
      } else {
        setIsMockData(true);
        setResults(generateQuote(county, house, Number(income)));
      }
    } catch (err) {
      console.error("CMS API failed, using fallback:", err);
      setIsMockData(true);
      setResults(generateQuote(county, house, Number(income)));
    }
    // Create browsing lead BEFORE showing plans
    if (!browseLeadCreated.current) {
      browseLeadCreated.current = true;
      try {
        const browseRes = await fetch("/api/leads/browse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentSlug: urlParams.agentSlug || "delbert",
            zipcode: zip,
            county: county?.name || "",
            state: county?.state || "FL",
            householdSize: house.length,
            annualIncome: Number(income),
            fplPercentage: getFPLpct(Number(income), house.length),
            ages: house.map((h) => h.age).join(","),
            householdDobs: house.map((h) => h.dob || "").join(","),
            usesTobacco: house.some((h) => h.tobacco),
            language: lang,
            utmSource: urlParams.utm_source || undefined,
            utmMedium: urlParams.utm_medium || undefined,
            utmCampaign: urlParams.utm_campaign || undefined,
          }),
        });
        const browseData = await browseRes.json();
        if (browseData.leadId) setLeadId(browseData.leadId);
      } catch (e) {
        console.error("Browse lead error:", e);
      }
    }

    setLoading(false);
    setStep(5);
  };

  const submitLead = async () => {
    setLoading(true);
    try {
      if (leadId) {
        // UPDATE existing browsing lead with contact info
        await fetch("/api/leads", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            status: "new",
            note: "Cliente proporcionó datos de contacto",
            contactName: leadName,
            contactPhone: leadPhone,
            contactEmail: leadEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dob: house[0]?.dob || "",
            streetAddress: streetAddress.trim(),
            city: city.trim(),
            stateForm,
            aptNumber: aptNumber.trim(),
            currentInsurance,
            currentInsuranceName: currentInsuranceName.trim(),
            contactPreference: contactPreference.join(","),
            bestCallTime,
            householdDobs: house.map((h) => h.dob || "").join(","),
            signatureData,
            consentTimestamp: new Date().toISOString(),
          }),
        });
        // Send notification email
        const origin = window.location.origin;
        fetch(`${origin}/api/notify-lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            agentSlug: urlParams.agentSlug || undefined,
            contactName: leadName,
            contactPhone: leadPhone,
            contactEmail: leadEmail || undefined,
            zipcode: zip,
            county: county?.name || "",
            state: county?.state || "FL",
            householdSize: house.length,
            annualIncome: Number(income),
            fplPercentage: getFPLpct(Number(income), house.length),
          }),
        }).catch(() => {});
      } else {
        // Fallback: create new lead if no browsing lead exists
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
          dob: house[0]?.dob || "",
          streetAddress: streetAddress.trim(),
          city: city.trim(),
          stateForm,
          aptNumber: aptNumber.trim(),
          currentInsurance,
          currentInsuranceName: currentInsuranceName.trim(),
          contactPreference: contactPreference.join(","),
          bestCallTime,
          householdDobs: house.map((h) => h.dob || "").join(","),
          signatureData,
          consentTimestamp: new Date().toISOString(),
          utmSource: urlParams.utm_source || undefined,
          utmMedium: urlParams.utm_medium || undefined,
          utmCampaign: urlParams.utm_campaign || undefined,
        });
        if (result.leadId) setLeadId(result.leadId);
      }
    } catch (err) {
      console.error('Failed to save lead:', err);
    }
    setLoading(false);
    setConsent(true);
    setStep(45); // Go to CMS consent form
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
        agentName: record.agentName || 'EnrollSalud',
        agentNpn: record.agentNPN || undefined,
      });
    } catch (err) {
      console.error('Failed to save consent:', err);
    }
    setStep(6); // Go to confirm after consent
  };

  const selectPlan = async (plan: Plan) => {
    setSelectedPlanId(plan.id);
    // Track plan view on browsing lead
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
    // If no contact info yet, go to lead capture form first
    if (!contactFormValid) {
      setTimeout(() => setStep(4), 300);
    } else {
      setTimeout(() => setStep(45), 300);
    }
  };

  const confirmPlan = () => {
    // Production: PATCH /api/leads/{id} with confirmed plan
    // Trigger URGENT notification to agent
    setStep(7); // Step 7 = thank you
  };

  const resetAll = () => {
    setStep(1); setResults(null); setSelectedPlanId(null); setIsMockData(false);
    setConsent(false); setConsentRecord(null); setFirstName(""); setLastName(""); setLeadPhone(""); setLeadEmail("");
    setStreetAddress(""); setCity(""); setStateForm("FL"); setAptNumber("");
    setCurrentInsurance(""); setCurrentInsuranceName(""); setContactPreference([]); setBestCallTime(""); setSignatureData("");
    setZip(""); setCounty(null); setIncome("");
    setHouse([{ age: 30, gender: "Female", tobacco: false }]);
    setSelectedDrug(null); setSelectedDoctor(null); setDrugQuery(""); setDoctorQuery("");
    setDrugCoverage({}); setDoctorNetwork({});
    setDrugSearchError(false); setDoctorSearchError(false);
  };

  // Debounced drug search
  const searchDrugs = useCallback((q: string) => {
    setDrugQuery(q);
    if (drugTimer.current) clearTimeout(drugTimer.current);
    if (q.length < 2) { setDrugResults([]); setDrugOpen(false); return; }
    drugTimer.current = setTimeout(async () => {
      setDrugSearchError(false);
      try {
        const res = await fetch(`/api/drugs/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDrugResults((data || []).slice(0, 8).map((d: any) => ({
          rxcui: d.rxcui, name: d.name, strength: d.strength || "", route: d.route || "",
        })));
        setDrugOpen(true);
      } catch { setDrugResults([]); setDrugSearchError(true); }
    }, 300);
  }, []);

  // Debounced doctor search
  const searchDoctors = useCallback((q: string) => {
    setDoctorQuery(q);
    if (doctorTimer.current) clearTimeout(doctorTimer.current);
    if (q.length < 2 || !zip) { setDoctorResults([]); setDoctorOpen(false); return; }
    doctorTimer.current = setTimeout(async () => {
      setDoctorSearchError(false);
      try {
        const res = await fetch(`/api/providers/search?q=${encodeURIComponent(q)}&zipcode=${zip}&type=Individual`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDoctorResults((data.providers || []).slice(0, 8).map((p: any) => ({
          npi: p.provider?.npi || "", name: p.provider?.name || "",
          specialty: (p.provider?.specialties || [])[0] || "",
          address: p.address ? `${p.address.city}, ${p.address.state}` : "",
        })));
        setDoctorOpen(true);
      } catch { setDoctorResults([]); setDoctorSearchError(true); }
    }, 300);
  }, [zip]);

  // Fetch drug coverage when results load
  const drugRxcui = selectedDrug?.rxcui;
  const planIdsKey = results?.plans?.map((p) => p.id).join(",") || "";
  useEffect(() => {
    if (!drugRxcui || !planIdsKey) return;
    const planIds = planIdsKey.split(",");
    // Set all to "checking" in one batch
    const init: Record<string, "checking"> = {};
    planIds.forEach((id) => { init[id] = "checking"; });
    setDrugCoverage(init);
    // CMS API can handle ~10 plan IDs per request; batch if needed
    const batchSize = 10;
    const batches: string[][] = [];
    for (let i = 0; i < planIds.length; i += batchSize) batches.push(planIds.slice(i, i + batchSize));
    Promise.all(
      batches.map((batch) =>
        fetch(`/api/drugs/coverage?drugs=${drugRxcui}&planids=${batch.join(",")}&year=2026`)
          .then((r) => r.ok ? r.json() : { coverage: [] })
          .catch(() => ({ coverage: [] }))
      )
    ).then((results) => {
      const map: Record<string, "covered" | "not_covered" | "unknown"> = {};
      for (const data of results) {
        for (const c of data.coverage || []) {
          map[c.plan_id] = c.coverage === "Covered" ? "covered" : c.coverage === "Not Covered" ? "not_covered" : "unknown";
        }
      }
      // Fill in any plans not in the response
      planIds.forEach((id) => { if (!map[id]) map[id] = "unknown"; });
      setDrugCoverage(map);
    });
  }, [drugRxcui, planIdsKey]);

  // Check doctor network per plan when results load (batch via /providers/covered)
  const doctorNpi = selectedDoctor?.npi;
  useEffect(() => {
    if (!doctorNpi || !planIdsKey) return;
    const planIds = planIdsKey.split(",");
    const init: Record<string, "checking"> = {};
    planIds.forEach((id) => { init[id] = "checking"; });
    setDoctorNetwork(init);
    // Batch in groups of 10 plan IDs
    const batchSize = 10;
    const batches: string[][] = [];
    for (let i = 0; i < planIds.length; i += batchSize) batches.push(planIds.slice(i, i + batchSize));
    Promise.all(
      batches.map((batch) =>
        fetch(`/api/providers/coverage?providerids=${doctorNpi}&planids=${batch.join(",")}&year=2026`)
          .then((r) => r.ok ? r.json() : { coverage: [] })
          .catch(() => ({ coverage: [] }))
      )
    ).then((results) => {
      const map: Record<string, "in_network" | "not_found"> = {};
      for (const data of results) {
        for (const c of data.coverage || []) {
          map[c.plan_id] = c.coverage === "Covered" ? "in_network" : "not_found";
        }
      }
      planIds.forEach((id) => { if (!map[id]) map[id] = "not_found"; });
      setDoctorNetwork(map);
    });
  }, [doctorNpi, planIdsKey]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href={urlParams.agentSlug ? "/agentes" : "/"} style={{ color: "#64748B", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>← {lang === "es" ? "Volver" : "Back"}</a>
          <div style={S.logo}>
            <div style={S.logoIcon}>🏥</div>
            <span>{t.title}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {agentBrand && agentBrand.name !== t.title && (
            <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{lang === "es" ? "Agente" : "Agent"}: {agentBrand.name}</span>
          )}
          <button style={S.langBtn} onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label={lang === "en" ? "Switch to Spanish" : "Cambiar a inglés"}>{t.langSwitch}</button>
        </div>
      </div>

      {/* Hero */}
      {step <= 4 && (
        <div style={S.hero}>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1.2 }}>{t.hero}</div>
          <div style={{ color: "#5EEAD4", fontSize: 22, fontWeight: 700 }}>{t.heroAccent}</div>
          <div style={{ color: "rgba(255,255,255,.8)", fontSize: 14, marginTop: 8 }}>{t.heroSub}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "4px 12px", borderRadius: 20, background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.7)", fontSize: 11, fontWeight: 600 }}>🛡️ {t.trustBadge}</div>
        </div>
      )}
      {step === 45 && !consentRecord && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{lang === "es" ? "📋 Autorización CMS" : "📋 CMS Authorization"}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{lang === "es" ? "Firma digital requerida para continuar" : "Digital signature required to continue"}</div>
        </div>
      )}
      {step === 5 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{t.s4}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>
            {county?.name}, {county?.state} · {house.length}p · ${Number(income).toLocaleString()}{lang === "es" ? "/año" : "/yr"} ({fpl}% FPL)
          </div>
        </div>
      )}
      {step === 6 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{t.confirmTitle || "Confirma tu plan"}</div>
          <div style={{ color: "rgba(255,255,255,.6)", fontSize: 13, marginTop: 4 }}>{t.confirmSub || "Review the details before confirming"}</div>
        </div>
      )}
      {step === 7 && (
        <div style={{ ...S.hero, paddingBottom: 44 }}>
          <div style={{ color: "#fff", fontSize: 20, fontWeight: 700 }}>{t.tyTitle}</div>
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
              <label htmlFor="zip-input" style={S.label}>{t.zip}</label>
              <input id="zip-input" style={S.input} type="text" maxLength={5} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))} placeholder={t.zipPh} aria-required="true" autoFocus />
              {zipLoading && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>{lang === "es" ? "Buscando condado..." : "Looking up county..."}</div>}
              {zip.length === 5 && !zipLoading && counties.length === 0 && <div role="alert" style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{lang === "es" ? "No se encontraron condados para este ZIP" : "No counties found for this ZIP code"}</div>}
            </div>
            {counties.length > 1 && (
              <div style={{ marginBottom: 18 }}>
                <label htmlFor="county-select" style={S.label}>{t.county}</label>
                <select id="county-select" style={S.select} value={county?.fips || ""} onChange={(e) => setCounty(counties.find((c) => c.fips === e.target.value) || null)} aria-required="true">
                  <option value="">{t.pickCounty}</option>
                  {counties.map((c) => <option key={c.fips} value={c.fips}>{c.name}, {c.state}</option>)}
                </select>
              </div>
            )}
            {county && <div style={{ fontSize: 13, color: "#0D9488", marginBottom: 18, fontWeight: 600 }}>📍 {county.name}, {county.state}</div>}
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
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#0D9488" }}>{t.person} {i + 1}</span>
                  {i > 0 && <button style={{ ...S.btn, padding: "3px 10px", fontSize: 11, color: "#ef4444", background: "transparent" }} onClick={() => removePerson(i)} aria-label={`${t.removePerson} ${i + 1}`}>{t.removePerson}</button>}
                </div>
                <div style={S.g3}>
                  <div>
                    <label htmlFor={`dob-${i}`} style={S.label}>{t.dob}</label>
                    <input id={`dob-${i}`} style={S.input} type="date" value={m.dob || ""} max={new Date().toISOString().split("T")[0]} onChange={(e) => updatePerson(i, "dob", e.target.value)} aria-required="true" />
                    {m.dob && <div style={{ fontSize: 12, color: "#0D9488", marginTop: 4, fontWeight: 600 }}>{m.age} {t.yearsOld}</div>}
                    {!m.dob && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Requerido" : "Required"}</div>}
                  </div>
                  <div><label htmlFor={`gender-${i}`} style={S.label}>{t.gender}</label><select id={`gender-${i}`} style={S.select} value={m.gender} onChange={(e) => updatePerson(i, "gender", e.target.value)}><option value="Female">{t.female}</option><option value="Male">{t.male}</option></select></div>
                  <div><label htmlFor={`tobacco-${i}`} style={S.label}>{t.tobacco}</label><select id={`tobacco-${i}`} style={S.select} value={m.tobacco ? "y" : "n"} onChange={(e) => updatePerson(i, "tobacco", e.target.value === "y")}><option value="n">{t.no}</option><option value="y">{t.yes}</option></select></div>
                </div>
              </div>
            ))}
            <button style={{ ...S.btn, ...S.sec, width: "100%", marginBottom: 14, fontSize: 13 }} onClick={addPerson}>{t.addPerson}</button>
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(1)}>{t.back}</button>
              <button style={{ ...S.btn, ...(householdValid ? S.pri : S.dis), flex: 2 }} disabled={!householdValid} onClick={() => setStep(3)}>{t.next}</button>
            </div>
          </div>
        )}

        {/* Step 3: Income */}
        {step === 3 && (
          <div style={S.card}>
            <StepLabel num={3} label={t.s3} />
            <Progress step={3} total={4} />
            <div style={{ marginBottom: 18 }}>
              <label htmlFor="income-input" style={S.label}>{t.income}</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontWeight: 700 }} aria-hidden="true">$</span>
                <input id="income-input" style={{ ...S.input, paddingLeft: 26 }} type="text" value={income ? Number(income).toLocaleString() : ""} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} placeholder={t.incomePh} aria-required="true" />
              </div>
            </div>
            {income && (
              <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: 12, marginBottom: 18, fontSize: 13, color: "#0D9488" }}>
                <strong>{t.fplLabel}:</strong> {fpl}% FPL
                <span style={{ color: "#94A3B8", marginLeft: 6 }}>(${getFPL(house.length).toLocaleString()} / {house.length}p)</span>
              </div>
            )}
            {isMedicaid && <div role="alert" style={S.alert}>⚠️ {t.medicaidMsg}</div>}
            {income && +income > 500000 && (
              <div style={{ ...S.alert, background: "rgba(59,130,246,0.08)", borderColor: "rgba(59,130,246,0.3)", color: "#60a5fa" }}>
                {lang === "es" ? "Nota: Ingreso alto. Verifica que este es tu ingreso MAGI anual correcto." : "Note: High income entered. Please verify this is your correct annual MAGI income."}
              </div>
            )}
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(2)}>{t.back}</button>
              <button style={{ ...S.btn, ...(income && +income > 0 ? S.pri : S.dis), flex: 2 }} disabled={!income || +income <= 0 || loading} onClick={doSearch}>
                {loading ? (lang === "es" ? "Buscando planes..." : "Finding plans...") : (lang === "es" ? "Ver Mis Planes →" : "See My Plans →")}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Lead Gate */}
        {step === 4 && (
          <div style={S.card}>
            <StepLabel num={4} label={t.sL} />
            <Progress step={4} total={4} />
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0D9488", marginBottom: 4 }}>{t.leadTitle}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20, lineHeight: 1.5 }}>{t.leadSub}</div>
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div>
                <label htmlFor="lead-first" style={S.label}>{lang === "es" ? "Nombre" : "First Name"} <span style={{ color: "#DC2626" }}>*</span></label>
                <input id="lead-first" style={{ ...S.input, borderColor: firstName && !firstNameValid ? "#DC2626" : firstName && firstNameValid ? "#059669" : undefined }} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={lang === "es" ? "María" : "Maria"} aria-required="true" autoFocus={!firstName} />
                {firstName && !firstNameValid && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Mínimo 2 caracteres" : "Minimum 2 characters"}</div>}
                {!firstName && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
              </div>
              <div>
                <label htmlFor="lead-last" style={S.label}>{lang === "es" ? "Apellido" : "Last Name"} <span style={{ color: "#DC2626" }}>*</span></label>
                <input id="lead-last" style={{ ...S.input, borderColor: lastName && !lastNameValid ? "#DC2626" : lastName && lastNameValid ? "#059669" : undefined }} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={lang === "es" ? "García" : "Garcia"} aria-required="true" />
                {lastName && !lastNameValid && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Mínimo 2 caracteres" : "Minimum 2 characters"}</div>}
                {!lastName && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
              </div>
            </div>
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div>
                <label htmlFor="lead-phone" style={S.label}>{t.phone} <span style={{ color: "#DC2626" }}>*</span></label>
                <input id="lead-phone" style={{ ...S.input, borderColor: leadPhone && !phoneValid ? "#DC2626" : leadPhone && phoneValid ? "#059669" : undefined }} type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder={t.phonePh} maxLength={10} aria-required="true" />
                {leadPhone && !phoneValid && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Debe ser exactamente 10 dígitos" : "Must be exactly 10 digits"}</div>}
                {!leadPhone && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
              </div>
              <div>
                <label htmlFor="lead-email" style={S.label}>{t.email} <span style={{ color: "#DC2626" }}>*</span></label>
                <input id="lead-email" style={{ ...S.input, borderColor: leadEmail && !emailValid ? "#DC2626" : leadEmail && emailValid ? "#059669" : undefined }} type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder={t.emailPh} aria-required="true" />
                {leadEmail && !emailValid && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Formato inválido" : "Invalid format"}</div>}
                {!leadEmail && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
              </div>
            </div>
            {/* Address fields */}
            <div style={{ marginBottom: 14 }}>
              <label htmlFor="lead-street" style={S.label}>{t.streetAddress} <span style={{ color: "#DC2626" }}>*</span></label>
              <input id="lead-street" style={{ ...S.input, borderColor: streetAddress && streetAddress.trim().length < 3 ? "#DC2626" : streetAddress && streetAddress.trim().length >= 3 ? "#059669" : undefined }} value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder={t.streetPh} aria-required="true" />
              {!streetAddress && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
            </div>
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div>
                <label htmlFor="lead-apt" style={S.label}>{t.aptNumber}</label>
                <input id="lead-apt" style={S.input} value={aptNumber} onChange={(e) => setAptNumber(e.target.value)} placeholder={t.aptPh} />
              </div>
              <div>
                <label htmlFor="lead-city" style={S.label}>{t.cityLabel} <span style={{ color: "#DC2626" }}>*</span></label>
                <input id="lead-city" style={{ ...S.input, borderColor: city && city.trim().length < 2 ? "#DC2626" : city && city.trim().length >= 2 ? "#059669" : undefined }} value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.cityPh} aria-required="true" />
                {!city && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Este campo es obligatorio" : "Required"}</div>}
              </div>
            </div>
            <div style={{ ...S.g2, marginBottom: 14 }}>
              <div>
                <label htmlFor="lead-state-form" style={S.label}>{t.stateLabel} <span style={{ color: "#DC2626" }}>*</span></label>
                <select id="lead-state-form" style={S.select} value={stateForm} onChange={(e) => setStateForm(e.target.value)}>
                  <option value="FL">Florida</option><option value="GA">Georgia</option><option value="TX">Texas</option><option value="CA">California</option><option value="NY">New York</option><option value="NJ">New Jersey</option><option value="PA">Pennsylvania</option><option value="IL">Illinois</option><option value="OH">Ohio</option><option value="NC">North Carolina</option>
                </select>
              </div>
              <div>
                <label htmlFor="lead-zip2" style={S.label}>{t.zip}</label>
                <input id="lead-zip2" style={S.input} value={zip} readOnly disabled />
              </div>
            </div>
            {/* DOB display from step 2 */}
            {house[0]?.dob && (
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, color: "#334155" }}>
                {t.dob}: <strong>{house[0].dob}</strong> ({house[0].age} {t.yearsOld})
              </div>
            )}
            {/* Optional: current insurance */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t.currentIns}</label>
              <div style={{ ...S.row, gap: 8 }}>
                {[{ v: "yes", l: t.yes }, { v: "no", l: t.no }, { v: "unknown", l: t.dontKnow }].map((o) => (
                  <button key={o.v} type="button" style={chip(currentInsurance === o.v)} onClick={() => setCurrentInsurance(currentInsurance === o.v ? "" : o.v)}>{o.l}</button>
                ))}
              </div>
              {currentInsurance === "yes" && (
                <div style={{ marginTop: 8 }}>
                  <input style={S.input} value={currentInsuranceName} onChange={(e) => setCurrentInsuranceName(e.target.value)} placeholder={t.currentInsName} />
                </div>
              )}
            </div>
            {/* Contact preference */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t.contactPref}</label>
              <div style={{ ...S.row, gap: 8, flexWrap: "wrap" }}>
                {[{ v: "whatsapp", l: t.whatsappLabel }, { v: "call", l: t.callLabel }, { v: "text", l: t.textLabel }, { v: "email", l: t.email }].map((o) => (
                  <button key={o.v} type="button" style={chip(contactPreference.includes(o.v))} onClick={() => setContactPreference((prev) => prev.includes(o.v) ? prev.filter((x) => x !== o.v) : [...prev, o.v])}>{o.l}</button>
                ))}
              </div>
            </div>
            {/* Best call time */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>{t.bestCallTime}</label>
              <div style={{ ...S.row, gap: 8, flexWrap: "wrap" }}>
                {[{ v: "morning", l: t.morning }, { v: "afternoon", l: t.afternoon }, { v: "evening", l: t.evening }, { v: "anytime", l: t.anytime }].map((o) => (
                  <button key={o.v} type="button" style={chip(bestCallTime === o.v)} onClick={() => setBestCallTime(bestCallTime === o.v ? "" : o.v)}>{o.l}</button>
                ))}
              </div>
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
            {/* Optional: Drug search */}
            <div style={{ marginBottom: 14, position: "relative" }}>
              <label htmlFor="drug-search" style={S.label}>{t.drugLabel}</label>
              {selectedDrug ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: "#0D9488", fontWeight: 600, flex: 1 }}>💊 {selectedDrug.name}</span>
                  <button style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 16, padding: "0 4px" }} onClick={() => { setSelectedDrug(null); setDrugQuery(""); setDrugCoverage({}); }} aria-label={lang === "es" ? "Quitar medicamento" : "Remove medication"}>✕</button>
                </div>
              ) : (
                <>
                  <input id="drug-search" style={S.input} value={drugQuery} onChange={(e) => searchDrugs(e.target.value)} placeholder={t.drugPh} onFocus={() => drugResults.length > 0 && setDrugOpen(true)} onBlur={() => setTimeout(() => setDrugOpen(false), 200)} />
                  {drugSearchError && <div role="alert" style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{lang === "es" ? "Error en la busqueda" : "Search failed"}</div>}
                  {drugOpen && drugResults.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
                      {drugResults.map((d) => (
                        <div key={d.rxcui} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "#1E293B" }} onMouseDown={() => { setSelectedDrug({ rxcui: d.rxcui, name: d.name }); setDrugQuery(""); setDrugOpen(false); setDrugResults([]); }}>
                          <div style={{ fontWeight: 600 }}>{d.name}</div>
                          {d.strength && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{d.strength} · {d.route}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {drugQuery.length >= 2 && drugOpen && drugResults.length === 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", marginTop: 4, fontSize: 12, color: "#94A3B8" }}>{t.noResults}</div>
                  )}
                </>
              )}
            </div>

            {/* Optional: Doctor search */}
            <div style={{ marginBottom: 18, position: "relative" }}>
              <label htmlFor="doctor-search" style={S.label}>{t.doctorLabel}</label>
              {selectedDoctor ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: "#0D9488", fontWeight: 600 }}>🩺 {selectedDoctor.name}</span>
                    {selectedDoctor.specialty && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{selectedDoctor.specialty}</div>}
                  </div>
                  <button style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 16, padding: "0 4px" }} onClick={() => { setSelectedDoctor(null); setDoctorQuery(""); }} aria-label={lang === "es" ? "Quitar doctor" : "Remove doctor"}>✕</button>
                </div>
              ) : (
                <>
                  <input id="doctor-search" style={S.input} value={doctorQuery} onChange={(e) => searchDoctors(e.target.value)} placeholder={t.doctorPh} onFocus={() => doctorResults.length > 0 && setDoctorOpen(true)} onBlur={() => setTimeout(() => setDoctorOpen(false), 200)} />
                  {doctorSearchError && <div role="alert" style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{lang === "es" ? "Error en la busqueda" : "Search failed"}</div>}
                  {doctorOpen && doctorResults.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
                      {doctorResults.map((d) => (
                        <div key={d.npi} style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13, color: "#1E293B" }} onMouseDown={() => { setSelectedDoctor({ npi: d.npi, name: d.name, specialty: d.specialty }); setDoctorQuery(""); setDoctorOpen(false); setDoctorResults([]); }}>
                          <div style={{ fontWeight: 600 }}>{d.name}</div>
                          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{d.specialty}{d.address ? ` · ${d.address}` : ""}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {doctorQuery.length >= 2 && doctorOpen && doctorResults.length === 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", marginTop: 4, fontSize: 12, color: "#94A3B8" }}>{t.noResults}</div>
                  )}
                </>
              )}
            </div>

            {/* Signature pad */}
            <div style={{ marginBottom: 18 }}>
              <SignaturePad
                label={lang === "es" ? "Firma / Signature" : "Signature"}
                hint={lang === "es" ? "Firme con su dedo o ratón" : "Sign with your finger or mouse"}
                clearLabel={lang === "es" ? "Limpiar" : "Clear"}
                onSignature={(data) => setSignatureData(data)}
                onClear={() => setSignatureData("")}
              />
              {!signatureData && <div style={{ fontSize: 11, color: "#DC2626", marginTop: 4 }}>{lang === "es" ? "Firma requerida" : "Signature required"}</div>}
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#0D9488", cursor: "pointer" }} />
              {t.consent}
            </label>
            <div style={S.row}>
              <button style={{ ...S.btn, ...S.sec, flex: 1 }} onClick={() => setStep(results ? 5 : 3)}>{t.back}</button>
              <button style={{ ...S.btn, ...(contactFormValid && consent ? S.pri : S.dis), flex: 2 }} disabled={!contactFormValid || !consent || loading} onClick={submitLead}>
                {loading ? t.saving : (lang === "es" ? "Continuar →" : "Continue →")}
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
            {isMockData && (
              <div role="alert" style={{ background: "rgba(239,68,68,0.1)", border: "1.5px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: 16, marginBottom: 18, fontSize: 13, color: "#ef4444", lineHeight: 1.5, textAlign: "center" }}>
                <strong>{lang === "es" ? "⚠️ Planes Estimados" : "⚠️ Estimated Plans"}</strong>
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {lang === "es"
                    ? "No se pudieron cargar los planes reales del Marketplace. Los datos mostrados son aproximados y solo para referencia."
                    : "Real Marketplace plans could not be loaded. The data shown is approximate and for reference only."}
                </div>
              </div>
            )}
            {/* FPL Indicator Bar */}
            <FPLIndicator fplPct={fpl} income={Number(income)} houseSize={house.length} lang={lang} maxAge={Math.max(...house.map(h => h.age))} />

            {results.aptc > 0 && (
              <div style={S.subBanner}>
                <div style={{ fontSize: 12, color: "#0D9488", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{t.subsidyLabel}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#0D9488", letterSpacing: -1 }}>${results.aptc}<span style={{ fontSize: 16, fontWeight: 600 }}>{t.mo}</span></div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {["all", "bronze", "silver", "gold", "platinum"].map((m) => (
                <button key={m} style={chip(metalFilter === m)} onClick={() => setMetalFilter(m)}>{t[m] || m}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: "#64748B", fontWeight: 700 }}>{t.sort}:</span>
              <select style={{ ...S.select, width: "auto", padding: "5px 10px", fontSize: 12 }} value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                <option value="afterSubsidy">{t.sortPremium}</option>
                <option value="deductible">{t.sortDeduct}</option>
                <option value="oopMax">{t.sortOop}</option>
                <option value="rating">{t.sortRate}</option>
              </select>
              <span style={{ fontSize: 13, color: "#64748B", marginLeft: "auto", fontWeight: 600 }}>{filtered?.length} {t.planCount}</span>
            </div>
            {filtered?.map((plan) => {
              const exp = expandedPlan === plan.id;
              return (
                <div key={plan.id} role="button" tabIndex={0} aria-expanded={exp} style={exp ? S.planExp : S.planCard} onClick={() => setExpandedPlan(exp ? null : plan.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedPlan(exp ? null : plan.id); } }}>
                  {/* Best value badge */}
                  {filtered && filtered.indexOf(plan) === 0 && sortKey === "afterSubsidy" && (
                    <div style={{ background: "linear-gradient(135deg, #10b981, #06b6d4)", color: "#000", fontSize: 11, fontWeight: 900, padding: "4px 14px", borderRadius: "8px 8px 0 0", margin: "-20px -20px 12px", textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {lang === "es" ? "⭐ Mejor Precio" : "⭐ Best Price"}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <Badge metal={plan.metal} t={t} />
                      {plan.hsa && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: "#0D9488", background: "rgba(16,185,129,0.12)", padding: "2px 8px", borderRadius: 4 }}>HSA</span>}
                      <div style={{ fontSize: 17, fontWeight: 900, marginTop: 8, color: "#1E293B", lineHeight: 1.3 }}>{plan.name}</div>
                      <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{plan.issuer}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      {plan.aptc > 0 && <div style={{ fontSize: 12, color: "#64748B", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                      <div style={{ fontSize: plan.afterSubsidy === 0 ? 32 : 28, fontWeight: 900, color: plan.afterSubsidy === 0 ? "#10b981" : "#10b981", letterSpacing: -1 }}>
                        {plan.afterSubsidy === 0 ? "$0" : `$${plan.afterSubsidy}`}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{t.mo}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={S.stat}><div style={S.statL}>{t.deductible}</div><div style={{ ...S.statV, fontSize: 15 }}>${plan.deductible.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.oopMax}</div><div style={{ ...S.statV, fontSize: 15 }}>${plan.oopMax.toLocaleString()}</div></div>
                    <div style={S.stat}><div style={S.statL}>{t.quality}</div><Stars n={plan.rating} /></div>
                  </div>
                  {/* Ver Detalles button */}
                  {!exp && (
                    <div style={{ marginTop: 12, textAlign: "center" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#0D9488", fontSize: 13, fontWeight: 700 }}>
                        {lang === "es" ? "Ver Detalles ↓" : "View Details ↓"}
                      </span>
                    </div>
                  )}
                  {/* Drug & Doctor badges */}
                  {(selectedDrug || selectedDoctor) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {selectedDrug && (() => {
                        const status = drugCoverage[plan.id];
                        const isCovered = status === "covered";
                        const isChecking = status === "checking";
                        const isNotCovered = status === "not_covered";
                        const color = isCovered ? "#10b981" : isNotCovered ? "#ef4444" : "#5a5e72";
                        const bg = isCovered ? "rgba(16,185,129,0.1)" : isNotCovered ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)";
                        const border = isCovered ? "rgba(16,185,129,0.25)" : isNotCovered ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.1)";
                        const label = isChecking ? t.drugChecking : isCovered ? t.drugCovers : isNotCovered ? t.drugNoCovers : t.drugCovers;
                        const icon = isChecking ? "⏳" : isCovered ? "✅" : isNotCovered ? "❌" : "❓";
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
                            {icon} {label}
                          </span>
                        );
                      })()}
                      {selectedDoctor && (() => {
                        const status = doctorNetwork[plan.id];
                        const isIn = status === "in_network";
                        const isChecking = status === "checking";
                        const isNotFound = status === "not_found";
                        const color = isIn ? "#10b981" : isChecking ? "#5a5e72" : "#f59e0b";
                        const bg = isIn ? "rgba(16,185,129,0.1)" : isChecking ? "rgba(255,255,255,0.05)" : "rgba(245,158,11,0.1)";
                        const bdColor = isIn ? "rgba(16,185,129,0.25)" : isChecking ? "rgba(255,255,255,0.1)" : "rgba(245,158,11,0.25)";
                        const icon = isChecking ? "⏳" : isIn ? "✅" : "⚠️";
                        const label = isChecking ? t.doctorChecking : isIn ? t.doctorAccepts : t.doctorVerify;
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, background: bg, border: `1px solid ${bdColor}` }}>
                            {icon} {label}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  {exp && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>{lang === "es" ? "Copagos" : "Copays"}</div>
                      <div style={S.g4}>
                        <div style={S.stat}><div style={S.statL}>🩺 {t.pcp}</div><div style={{ ...S.statV, fontSize: 14 }}>{plan.pcp ? `$${plan.pcp}` : (lang === "es" ? "Incluido" : "Included")}</div></div>
                        <div style={S.stat}><div style={S.statL}>👨‍⚕️ {t.specialist}</div><div style={{ ...S.statV, fontSize: 14 }}>{plan.specialist ? `$${plan.specialist}` : (lang === "es" ? "Incluido" : "Included")}</div></div>
                        <div style={S.stat}><div style={S.statL}>💊 {t.rx}</div><div style={{ ...S.statV, fontSize: 14 }}>{plan.genericRx ? `$${plan.genericRx}` : (lang === "es" ? "Incluido" : "Included")}</div></div>
                        <div style={S.stat}><div style={S.statL}>🚑 {t.er}</div><div style={{ ...S.statV, fontSize: 14 }}>{plan.er ? `$${plan.er}` : (lang === "es" ? "Consultar" : "Check plan")}</div></div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 16, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
                      <div style={S.g3}>
                        <div style={{ ...S.stat, background: "rgba(16,185,129,0.08)" }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yLow.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "rgba(251,191,36,0.08)" }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yMed.toLocaleString()}</div></div>
                        <div style={{ ...S.stat, background: "rgba(239,68,68,0.08)" }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 13 }}>${plan.yHigh.toLocaleString()}</div></div>
                      </div>

                      {/* AI Health Advisor */}
                      <AIPlanAdvisor
                        plan={plan}
                        household={house}
                        income={Number(income)}
                        fplPct={results?.fplPct || 0}
                        aptc={results?.aptc || 0}
                        lang={lang}
                        t={t}
                        householdSize={house.length}
                        fplThreshold400={(15650 + (house.length - 1) * 5500) * 4}
                        isOverCliff={fpl > 400}
                        isNearCliff={fpl >= 350 && fpl <= 400}
                        excessOverCliff={fpl > 400 ? Number(income) - (15650 + (house.length - 1) * 5500) * 4 : 0}
                        selectedDrug={selectedDrug}
                        drugCoverageStatus={selectedDrug ? (drugCoverage[plan.id] || null) : null}
                        selectedDoctor={selectedDoctor}
                        doctorNetworkStatus={selectedDoctor ? (doctorNetwork[plan.id] || null) : null}
                        agentSlug={urlParams.agentSlug || undefined}
                        onReadyToEnroll={(convId, summary) => {
                          // Pre-select the plan and go to lead capture
                          setSelectedPlanId(plan.id);
                          setStep(4);
                        }}
                      />
                      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                        <button style={{ ...S.btn, ...S.pri, flex: 2, fontSize: 15, padding: "15px 28px" }} onClick={(e) => { e.stopPropagation(); selectPlan(plan); }}>
                          {t.wantPlan}
                        </button>
                      </div>
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
                  <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8, color: "#1E293B", lineHeight: 1.2 }}>{plan.name}</div>
                  <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>{plan.issuer}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {plan.aptc > 0 && <div style={{ fontSize: 12, color: "#94A3B8", textDecoration: "line-through" }}>${plan.premium}{t.mo}</div>}
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#0D9488", letterSpacing: -1 }}>${plan.afterSubsidy}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{t.mo}</div>
                </div>
              </div>

              {/* Subsidy Banner */}
              {plan.aptc > 0 && (
                <div style={{ background: "linear-gradient(135deg, #ecfdf5, #d1fae5)", borderRadius: 10, padding: 14, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0D9488", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.subsidyLabel}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{t.subsidyApplied || "Applied to your premium"}</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#0D9488" }}>-${plan.aptc}{t.mo}</div>
                </div>
              )}

              {/* Key Numbers */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.planDetails || "Plan Details"}</div>
              <div style={S.g2}>
                <div style={{ ...S.stat, padding: 14 }}>
                  <div style={S.statL}>{t.premium}</div>
                  <div style={{ ...S.statV, fontSize: 20 }}>${plan.afterSubsidy}<span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>{t.mo}</span></div>
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
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Copays</div>
              <div style={S.g4}>
                <div style={S.stat}><div style={S.statL}>{t.pcp}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.pcp ? `$${plan.pcp}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.specialist}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.specialist ? `$${plan.specialist}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.rx}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.genericRx ? `$${plan.genericRx}` : "—"}</div></div>
                <div style={S.stat}><div style={S.statL}>{t.er}</div><div style={{ ...S.statV, fontSize: 15 }}>{plan.er ? `$${plan.er}` : "—"}</div></div>
              </div>

              {/* Annual Cost Estimates */}
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, marginTop: 20, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>{t.yearCost}</div>
              <div style={S.g3}>
                <div style={{ ...S.stat, background: "rgba(16,185,129,0.08)", padding: 14 }}><div style={S.statL}>{t.low}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yLow.toLocaleString()}</div><div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "rgba(251,191,36,0.08)", padding: 14 }}><div style={S.statL}>{t.med}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yMed.toLocaleString()}</div><div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
                <div style={{ ...S.stat, background: "rgba(239,68,68,0.08)", padding: 14 }}><div style={S.statL}>{t.high}</div><div style={{ ...S.statV, fontSize: 16 }}>${plan.yHigh.toLocaleString()}</div><div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{t.yearLabel || "/yr"}</div></div>
              </div>

              {/* HSA Simple Badge */}
              {plan.hsa && (
                <div style={{
                  marginTop: 16, background: "rgba(16,185,129,0.08)", borderRadius: 10,
                  padding: "12px 16px", border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0D9488", lineHeight: 1.5 }}>
                    {fpl >= 350
                      ? (lang === "es" ? "🏦 HSA Elegible — Haz clic en el plan en la lista para ver cómo ahorrar dinero" : "🏦 HSA Eligible — Click the plan in the list to see how to save money")
                      : (lang === "es" ? "🏦 HSA Elegible" : "🏦 HSA Eligible")}
                  </span>
                </div>
              )}

              {/* Summary for lead */}
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, marginTop: 20, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{t.yourInfo || "Your Information"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: "#64748B" }}>
                  <div>👤 {leadName}</div>
                  <div>📞 {leadPhone}</div>
                  <div>📍 {county?.name}, {county?.state} {zip}</div>
                  <div>👨‍👩‍👧‍👦 {house.length} {t.person?.toLowerCase() || "person"}{house.length > 1 ? "s" : ""}</div>
                </div>
              </div>

              {/* Agent info */}
              {agentBrand && (
                <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: 14, marginTop: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B" }}>{agentBrand.name}</div>
                  {agentBrand.npn && <div style={{ fontSize: 12, color: "#0D9488", marginTop: 2 }}>{lang === "es" ? "Agente Licenciado" : "Licensed Agent"} · NPN {agentBrand.npn}</div>}
                </div>
              )}

              {/* Action Buttons */}
              <button
                style={{ ...S.btn, ...S.pri, width: "100%", marginTop: 14, fontSize: 16, padding: "16px 28px" }}
                onClick={confirmPlan}
              >
                {agentBrand?.name
                  ? `✅ ${lang === "es" ? "Confirmar — Contactar a" : "Confirm — Contact"} ${agentBrand.name}`
                  : (t.confirmBtn || "✅ Confirmar — Contactar Agente")}
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
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0D9488", marginBottom: 8 }}>{t.tyTitle}</div>
            <div style={{ fontSize: 14, color: "#0D9488", marginBottom: 16, lineHeight: 1.6 }}>{t.tySub}</div>
            {selectedPlanId && results && (() => {
              const plan = results.plans.find((p: any) => p.id === selectedPlanId);
              if (!plan) return null;
              return (
                <div style={{ background: "#F8FAFC", borderRadius: 10, padding: 16, marginBottom: 16, textAlign: "left", border: "1px solid #d1fae5" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{t.tySelected}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div><Badge metal={plan.metal} t={t} /><div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>{plan.name}</div></div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0D9488" }}>${plan.afterSubsidy}<span style={{ fontSize: 12, fontWeight: 600 }}>{t.mo}</span></div>
                  </div>
                </div>
              );
            })()}
            <div style={{ fontSize: 13, color: "#0D9488", lineHeight: 1.6 }}>{t.tyDetail}</div>
            <button style={{ ...S.btn, ...S.sec, marginTop: 20 }} onClick={resetAll}>{t.newQuote}</button>
          </div>
        )}
      </div>

      {/* CMS Disclaimer */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 14px" }}>
        <div style={{ borderTop: "1px solid #E2E8F0", padding: "16px 0", textAlign: "center", fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
          {t.cmsDisclaimer}
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <div style={{ marginBottom: 4 }}>{t.poweredBy}</div>
        <div>{t.disclaimer}</div>
        {agentBrand && <div style={{ marginTop: 4 }}>{agentBrand.name}{agentBrand.npn ? ` · NPN ${agentBrand.npn}` : ""}</div>}
        <div style={{ marginTop: 8, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/privacy" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Privacidad" : "Privacy"}</a>
          <a href="/terms" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Términos" : "Terms"}</a>
          <a href="/compliance" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Cumplimiento" : "Compliance"}</a>
          <a href="/ai-disclaimer" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Aviso IA" : "AI Disclaimer"}</a>
          <a href="/agentes/login" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Portal Agentes" : "Agent Portal"}</a>
          <a href="mailto:info@enrollsalud.com" style={{ color: "#94A3B8", textDecoration: "none", fontSize: 10 }}>{lang === "es" ? "Contacto" : "Contact"}</a>
        </div>
      </div>

      {/* Sticky help button */}
      {step >= 5 && (
        <a
          href="https://wa.me/12399861143"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 100,
            display: "flex", alignItems: "center", gap: 8,
            padding: "12px 20px", borderRadius: 50,
            background: "#25D366", color: "#fff",
            fontSize: 14, fontWeight: 800, textDecoration: "none",
            boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
          }}
        >
          💬 {lang === "es" ? "Ayuda" : "Help"}
        </a>
      )}
    </div>
  );
}
