import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { normalizeAgentSlug } from "@/lib/normalize-slug";
import { captureInvalidAgentSlug } from "@/lib/slug-logging";

export async function GET(req: NextRequest) {
  const rawSlug = req.nextUrl.searchParams.get("slug");
  if (!rawSlug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  const slugResult = normalizeAgentSlug(rawSlug);
  captureInvalidAgentSlug(slugResult, "app/api/agents/route.ts", {
    url: req.url,
    referer: req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
  });
  const requested = slugResult.ok
    ? slugResult.slug
    : (process.env.DEFAULT_AGENT_SLUG?.trim() || "delbert");
  // "default" is a magic value that maps to the env-configured default agent.
  const slug = requested === "default"
    ? (process.env.DEFAULT_AGENT_SLUG?.trim() || "delbert")
    : requested;

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
