import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveAgentFromSlug } from "@/lib/resolve-agent";
import { normalizeAgentSlug } from "@/lib/normalize-slug";
import { captureInvalidAgentSlug } from "@/lib/slug-logging";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(`leads-browse:${ip}`, { max: 5, windowMs: 60_000 }).limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const body = await request.json();
    const supabase = createServiceClient();
    const slugResult = normalizeAgentSlug(body.agentSlug);
    captureInvalidAgentSlug(slugResult, "app/api/leads/browse/route.ts", {
      url: request.url,
      referer: request.headers.get("referer"),
      userAgent: request.headers.get("user-agent"),
    });
    const slug = slugResult.ok
      ? slugResult.slug
      : (process.env.DEFAULT_AGENT_SLUG?.trim() || "delbert");
    const { agent_id, agent_slug } = await resolveAgentFromSlug(
      supabase,
      slug,
      { zipcode: body.zipcode, source: "api/leads/browse POST" }
    );

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        agent_id,
        agent_slug,
        zipcode: body.zipcode || "",
        county: body.county || "",
        state: body.state || "FL",
        household_size: body.householdSize || 1,
        annual_income: body.annualIncome || 0,
        fpl_percentage: body.fplPercentage || 0,
        ages: body.ages || "",
        uses_tobacco: body.usesTobacco || false,
        household_dobs: body.householdDobs || "",
        household_members: body.householdMembers || null,
        genders: body.genders || "",
        language: body.language || "es",
        contact_name: "",
        contact_phone: "",
        status: "browsing",
        utm_source: body.utmSource || null,
        utm_medium: body.utmMedium || null,
        utm_campaign: body.utmCampaign || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Browse lead error:", error);
      return NextResponse.json(
        { error: "Failed to create" },
        { status: 500, headers: NO_STORE_HEADERS }
      );
    }

    // Track page view
    await supabase.from("page_views").insert({
      agent_slug,
      page: "/cotizar",
      ip_address: request.headers.get("x-forwarded-for") || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, leadId: lead.id }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("Browse API error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

