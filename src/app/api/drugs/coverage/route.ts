import { NextRequest, NextResponse } from "next/server";

const CMS_BASE = "https://marketplace.api.healthcare.gov/api/v1";

export async function GET(req: NextRequest) {
  const drugs = req.nextUrl.searchParams.get("drugs");
  const planids = req.nextUrl.searchParams.get("planids");
  const year = req.nextUrl.searchParams.get("year") || "2026";

  if (!drugs) {
    return NextResponse.json({ error: "Missing drugs parameter (RxCUI)" }, { status: 400 });
  }
  if (!planids) {
    return NextResponse.json({ error: "Missing planids parameter (HIOS IDs)" }, { status: 400 });
  }

  const apiKey = process.env.CMS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CMS API key not configured" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      drugs,
      planids,
      year,
      apikey: apiKey,
    });
    const url = `${CMS_BASE}/drugs/covered?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error("CMS drugs/covered error:", res.status, text);
      return NextResponse.json({ error: "CMS API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Drug coverage error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
