import { NextRequest, NextResponse } from "next/server";

const CMS_URL = "https://marketplace.api.healthcare.gov/api/v1/counties/by/zip";

export async function GET(req: NextRequest) {
  try {
    const zip = req.nextUrl.searchParams.get("zip");
    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json({ error: "Invalid zip code" }, { status: 400 });
    }

    const apiKey = process.env.CMS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "CMS API key not configured" }, { status: 500 });
    }

    const res = await fetch(`${CMS_URL}/${zip}?apikey=${apiKey}`);

    if (!res.ok) {
      const text = await res.text();
      console.error("CMS counties error:", res.status, text);
      return NextResponse.json({ error: "CMS API error", status: res.status }, { status: 502 });
    }

    const data = await res.json();
    const counties = (data.counties || []).map((c: any) => ({
      fips: c.fips || "",
      name: c.name || "",
      state: c.state || "",
    }));

    return NextResponse.json({ counties });
  } catch (err: any) {
    console.error("Counties API error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
