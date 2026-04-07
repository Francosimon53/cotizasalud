import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

const CMS_BASE = "https://marketplace.api.healthcare.gov/api/v1";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(ip, { max: 30, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2 || q.length > 200) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const apiKey = process.env.CMS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "CMS API key not configured" }, { status: 500 });
  }

  try {
    const url = `${CMS_BASE}/drugs/autocomplete?q=${encodeURIComponent(q)}&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error("CMS drugs/autocomplete error:", res.status, text);
      return NextResponse.json({ error: "CMS API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Drug search error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
