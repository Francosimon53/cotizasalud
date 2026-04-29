import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { normalizeAgentSlug, normalizeAgentSlugFromRequest } from "@/lib/normalize-slug";

export async function GET(req: NextRequest) {
  const rawSlug = req.nextUrl.searchParams.get("slug");
  if (!rawSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  let slug: string;
  if (rawSlug.trim().toLowerCase() === "default") {
    const envSlug = normalizeAgentSlug(process.env.DEFAULT_AGENT_SLUG);
    if (!envSlug.ok) {
      return NextResponse.json({ error: "No default agent configured" }, { status: 404 });
    }
    slug = envSlug.slug;
  } else {
    const normalized = normalizeAgentSlugFromRequest(rawSlug, req);
    if (!normalized.ok) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    slug = normalized.slug;
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
