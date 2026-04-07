import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const CMS_BASE = "https://marketplace.api.healthcare.gov/api/v1";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(ip, { max: 30, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q");
  const zipcode = req.nextUrl.searchParams.get("zipcode");
  const type = req.nextUrl.searchParams.get("type") || "Individual";
  const year = req.nextUrl.searchParams.get("year") || "2026";
  const specialty = req.nextUrl.searchParams.get("specialty");

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }
  if (!zipcode) {
    return NextResponse.json({ error: "Missing zipcode parameter" }, { status: 400 });
  }

  const apiKey = process.env.CMS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CMS API key not configured" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      q,
      zipcode,
      type,
      year,
      apikey: apiKey,
    });
    if (specialty) params.set("specialty", specialty);

    const url = `${CMS_BASE}/providers/search?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error("CMS providers/search error:", res.status, text);
      return NextResponse.json({ error: "CMS API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Provider search error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
