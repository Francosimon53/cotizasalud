import { NextRequest, NextResponse } from "next/server";
import { getFPLpct } from "@/lib/data";

const CMS_URL = "https://marketplace.api.healthcare.gov/api/v1/plans/search";

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

function parseDollar(s: string | number | undefined | null): number {
  if (s == null) return 0;
  if (typeof s === "number") return Math.round(s);
  return Math.round(parseFloat(s.replace(/[$,]/g, "")) || 0);
}

function mapCMSPlan(p: any, aptc: number): any {
  const metal = (p.metal_level || "").toLowerCase().replace("expanded ", "");
  const premium = Math.round(p.premium || 0);
  const afterSubsidy = Math.max(0, Math.round(p.premium_w_credit ?? premium));

  // Deductible: individual in-network medical EHB
  const dedEntry = (p.deductibles || []).find(
    (d: any) =>
      d.type === "Medical EHB Deductible" &&
      d.network_tier?.toLowerCase().includes("in-network") &&
      d.family_cost === "Individual"
  );
  const deductible = parseDollar(dedEntry?.amount);

  // OOP Max: individual in-network
  const oopEntry = (p.moops || []).find(
    (m: any) =>
      m.network_tier?.toLowerCase().includes("in-network") &&
      m.family_cost === "Individual"
  );
  const oopMax = parseDollar(oopEntry?.amount);

  // Benefits: extract copay amounts by name
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

  // Yearly cost estimates (same formula as generateQuote)
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { zipcode, countyfips, state, income, household } = body;

    if (!zipcode || !countyfips || !state || !income || !household?.length) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const apiKey = process.env.CMS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "CMS API key not configured" }, { status: 500 });
    }

    const cmsBody: CMSRequest = {
      household: {
        income: Number(income),
        people: household.map((m: any) => ({
          age: Number(m.age),
          gender: m.gender || "Female",
          uses_tobacco: !!m.tobacco,
          aptc_eligible: true,
        })),
      },
      market: "Individual",
      place: { countyfips, state, zipcode },
      year: new Date().getFullYear(),
      limit: 50,
      offset: 0,
    };

    // Paginate through plans (capped at 200)
    let allPlans: any[] = [];
    let offset = 0;
    const maxPlans = 200;
    let total = 0;

    do {
      const res = await fetch(`${CMS_URL}?apikey=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cmsBody, offset }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("CMS API error:", res.status, text);
        return NextResponse.json({ error: "CMS API error", status: res.status }, { status: 502 });
      }

      const data = await res.json();
      total = data.total || 0;
      const pagePlans = data.plans || [];
      allPlans = [...allPlans, ...pagePlans];
      offset += pagePlans.length;
      console.log(`CMS API page: offset=${offset}, got=${pagePlans.length}, total=${total}`);
    } while (offset < total && allPlans.length < maxPlans);

    console.log(`CMS API DONE: total=${total}, fetched=${allPlans.length}`);
    const cmsPlans = allPlans;

    const fplPct = getFPLpct(Number(income), household.length);

    // APTC from the first plan's premium_w_credit difference, or 0
    const samplePlan = cmsPlans[0];
    const aptc = samplePlan
      ? Math.max(0, Math.round((samplePlan.premium || 0) - (samplePlan.premium_w_credit || samplePlan.premium || 0)))
      : 0;

    const plans = cmsPlans.map((p: any) => mapCMSPlan(p, aptc));

    return NextResponse.json({ plans, aptc, fplPct });
  } catch (err: any) {
    console.error("Plans API error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
