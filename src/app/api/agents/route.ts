import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("agents")
      .select("slug, name, npn, agency_name, brand_color, logo_url, email, phone")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({
      slug: data.slug,
      name: data.name,
      npn: data.npn || "",
      brand_name: data.agency_name || "",
      brand_color: data.brand_color || "#10b981",
      logo_url: data.logo_url || "",
      email: data.email || "",
      phone: data.phone || "",
    });
  } catch (err) {
    console.error("Agent lookup error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
