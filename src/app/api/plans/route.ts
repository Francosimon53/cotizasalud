import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getFPLpct } from "@/lib/data";

// Freshness is non-negotiable for the cotizador — every response must match CMS live data.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

const CMS_URL = "https://marketplace.api.healthcare.gov/api/v1/plans/search";

// Pagination tuning — see usage block in POST handler for rationale.
const PAGE_SIZE = 10;
const PARALLEL_BATCH = 10;
const maxPlans = 200;

async function fetchPage(
  apiKey: string,
  body: CMSRequest,
  off: number
): Promise<{ plans: any[]; total: number }> {
  const res = await fetch(`${CMS_URL}?apikey=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, offset: off }),
  });
  if (!res.ok) {
    const text = await res.text();
    const err: any = new Error(`CMS API ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return { plans: data.plans || [], total: data.total || 0 };
}

interface CMSPerson {
  age: number;
  gender: string;
  uses_tobacco: boolean;
  aptc_eligible: boolean;
}

interface CMSRequest {
  household: { income: number; people: CMSPerson[] };
  market: string;
  place: { countyfips: string; state: string; zipcode: string };
  year: number;
  limit?: number;
  offset?: number;
}

// ────────────────────────────────────────────────────────────────
// FIX #1: APTC eligibility — reemplaza el hardcoded `true`.
// ────────────────────────────────────────────────────────────────
// Lee hasEmployerCoverage (bundled: job/Medicare/Medicaid/CHIP).
// Si ese flag es true, la persona NO califica para APTC y el CMS API
// devolverá premium_w_credit === premium para ella (coincide con
// cuidadodesalud.gov). Default conservador: aptc_eligible=true si
// el flag está ausente o false.
//
// Otros disqualifiers (dependiente en otra declaración, TRICARE,
// incarceración, immigration status) NO son capturados hoy por la UI.
// Si la UI los agrega en el futuro, extender esta función.
function determineAptcEligible(m: any): boolean {
  if (m?.hasEmployerCoverage === true) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────
// FIX #2: Year derivation — maneja el boundary de OEP (Nov 1 – Jan 15).
// ────────────────────────────────────────────────────────────────
// `new Date().getFullYear()` devuelve el año actual; durante OEP los
// usuarios compran planes del AÑO SIGUIENTE. Soporta PLAN_YEAR env
// var como override manual para testing o emergencias.
function derivePlanYear(now: Date = new Date()): number {
  const envOverride = process.env.PLAN_YEAR;
  if (envOverride && /^\d{4}$/.test(envOverride)) {
    return Number(envOverride);
  }
  const month = now.getMonth(); // 0-indexed: Nov = 10, Dec = 11
  const year = now.getFullYear();
  if (month >= 10) return year + 1; // Nov/Dec → shop next year
  return year;
}

function parseDollar(s: string | number | undefined | null): number {
  if (s == null) return 0;
  if (typeof s === "number") return Math.round(s);
  return Math.round(parseFloat(s.replace(/[$,]/g, "")) || 0);
}

function mapCMSPlan(p: any, householdSize: number): any {
  const metal = (p.metal_level || "").toLowerCase().replace("expanded ", "");
  const premium = Math.round(p.premium || 0);
  const afterSubsidy = Math.max(0, Math.round(p.premium_w_credit ?? premium));

  // Deductible / OOP extraction cascades on two axes:
  //
  // 1. household size: >1 person → prefer "Family" (total family deductible,
  //    eg $18000), fall back to "Individual" if the plan only reports that
  //    variant. Single-person households only look at "Individual".
  // 2. type (deductible only): prefer "Medical EHB Deductible", fall back to
  //    "Combined Medical and Drug EHB Deductible" (Kaiser, Bright, and some
  //    Bronze plans only ship the combined variant).
  //
  // For deductible, cost tier is outer priority (matching the user's
  // household is more important than the type label), type is inner.
  const inNetwork = (d: any) => d.network_tier?.toLowerCase().includes("in-network");
  const COSTS: string[] = householdSize > 1 ? ["Family", "Individual"] : ["Individual"];

  const deductibles: any[] = p.deductibles || [];
  const DED_TYPES = ["Medical EHB Deductible", "Combined Medical and Drug EHB Deductible"];
  let dedEntry: any;
  outer: for (const cost of COSTS) {
    for (const type of DED_TYPES) {
      const m = deductibles.find(
        (d: any) => d.type === type && inNetwork(d) && d.family_cost === cost
      );
      if (m) { dedEntry = m; break outer; }
    }
  }
  const deductible = parseDollar(dedEntry?.amount);

  const moops: any[] = p.moops || [];
  let oopEntry: any;
  for (const cost of COSTS) {
    const m = moops.find((mo: any) => inNetwork(mo) && mo.family_cost === cost);
    if (m) { oopEntry = m; break; }
  }
  const oopMax = parseDollar(oopEntry?.amount);

  const copay = (name: string): number => {
    const b = (p.benefits || []).find((x: any) =>
      (x.name || "").toLowerCase().includes(name.toLowerCase())
    );
    if (!b) return 0;
    const cs = (b.cost_sharings || []).find(
      (c: any) => c.network_tier?.toLowerCase().includes("in-network")
    );
    return parseDollar(cs?.copay_amount);
  };

  const pcp = copay("Primary Care Visit");
  const specialist = copay("Specialist Visit");
  const genericRx = copay("Generic Drugs");
  const er = copay("Emergency Room");

  const rating = p.quality_rating?.global_rating || 0;
  const hsa = !!p.hsa_eligible;

  const yLow = afterSubsidy * 12 + Math.round(deductible * 0.05);
  const yMed = afterSubsidy * 12 + Math.round(deductible * 0.4);
  const yHigh = afterSubsidy * 12 + Math.min(oopMax, deductible + 3000);

  return {
    id: p.id || "",
    name: p.name || "",
    issuer: p.issuer?.name || "",
    metal,
    premium,
    aptc: premium - afterSubsidy,
    afterSubsidy,
    deductible,
    oopMax,
    pcp,
    specialist,
    genericRx,
    er,
    rating,
    hsa,
    yLow,
    yMed,
    yHigh,
  };
}

// ────────────────────────────────────────────────────────────────
// FIX #3: Global APTC — derivado de todos los planes elegibles,
// no de cmsPlans[0]. Antes si el primer plan era Catastrophic
// (que nunca acepta APTC), el valor global volvía $0.
// ────────────────────────────────────────────────────────────────
function computeGlobalAPTC(plans: Array<{ premium: number; aptc: number }>): number {
  const withAptc = plans.filter((p) => p.aptc > 0);
  if (withAptc.length === 0) return 0;
  return Math.max(...withAptc.map((p) => p.aptc));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zipcode, countyfips, state, income, household } = body;

    if (!zipcode || !countyfips || !state || !income || !household?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const apiKey = process.env.CMS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "CMS API key not configured" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    const cmsBody: CMSRequest = {
      household: {
        income: Number(income),
        people: household.map((m: any) => ({
          age: Number(m.age),
          gender: m.gender || "Female",
          uses_tobacco: !!m.tobacco,
          aptc_eligible: determineAptcEligible(m),
        })),
      },
      market: "Individual",
      place: { countyfips, state, zipcode },
      year: derivePlanYear(),
      // NOTE: CMS Marketplace API silently caps server-side to 10/page regardless
      // of the limit requested. Setting limit=10 explicitly to match server
      // behavior, reduce confusion, and allow accurate roundtrip accounting.
      // If CMS ever starts honoring higher limits, revisit this.
      limit: PAGE_SIZE,
      offset: 0,
    };

    let allPlans: any[] = [];
    let total = 0;

    try {
      // First page serially to learn `total`, then parallelize the rest.
      // Broward family-of-4 has ~196 plans → 20 pages. Serial cost was
      // ~5s (20 × ~250ms RTT). Parallel batches drop this to ~750ms
      // while staying polite to the gov API (capped at PARALLEL_BATCH
      // concurrent requests per round).
      const first = await fetchPage(apiKey, cmsBody, 0);
      total = first.total;
      allPlans = [...first.plans];

      const offsets: number[] = [];
      for (let off = allPlans.length; off < total && off < maxPlans; off += PAGE_SIZE) {
        offsets.push(off);
      }

      for (let i = 0; i < offsets.length; i += PARALLEL_BATCH) {
        const batch = offsets.slice(i, i + PARALLEL_BATCH);
        const results = await Promise.all(
          batch.map((off) => fetchPage(apiKey, cmsBody, off))
        );
        for (const r of results) allPlans = [...allPlans, ...r.plans];
        if (allPlans.length >= maxPlans) break;
      }
    } catch (err: any) {
      console.error("CMS API error:", err?.message || err);
      return NextResponse.json(
        { error: "CMS API error", status: err?.status || 502 },
        { status: 502, headers: NO_STORE_HEADERS }
      );
    }

    console.log(`CMS API DONE: total=${total}, fetched=${allPlans.length}, year=${cmsBody.year}`);

    const plans = allPlans.map((p: any) => mapCMSPlan(p, household.length));
    const aptc = computeGlobalAPTC(plans);
    const fplPct = getFPLpct(Number(income), household.length);

    // TEMP: aptc-forensics logging — quitar después del 2026-04-28
    // Purpose: validar en producción que computeGlobalAPTC matchea el endpoint canónico del CMS
    // PR de remoción: TBD
    if (Math.random() < 0.05) {
      try {
        const topPlansByPremium = [...plans]
          .sort((a, b) => b.premium - a.premium)
          .slice(0, 3)
          .map((p) => ({
            issuer_name: p.issuer,
            premium: p.premium,
            premium_w_credit: p.afterSubsidy,
            aptc_derived: p.aptc,
            metal_tier: p.metal,
          }));
        Sentry.captureMessage("aptc-forensics", {
          level: "info",
          tags: { purpose: "aptc-forensics" },
          extra: {
            state: cmsBody.place.state,
            countyfips: cmsBody.place.countyfips,
            zip_prefix: String(cmsBody.place.zipcode || "").slice(0, 3),
            income_decile: Math.round(Number(income) / 10000) * 10000,
            household_size: cmsBody.household.people.length,
            household_ages: cmsBody.household.people.map((p) => p.age),
            employer_coverage_flags: household.map((m: any) => !!m?.hasEmployerCoverage),
            year: cmsBody.year,
            total,
            plans_fetched: allPlans.length,
            globalAPTC: aptc,
            fplPct,
            topPlansByPremium,
          },
        });
      } catch (err) {
        // Telemetry must never break the request path.
        console.warn("aptc-forensics capture failed", err);
      }
    }

    return NextResponse.json({ plans, aptc, fplPct }, { headers: NO_STORE_HEADERS });
  } catch (err: any) {
    console.error("Plans API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
