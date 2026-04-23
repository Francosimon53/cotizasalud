import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();
    const agentSlug = body.agentSlug || process.env.DEFAULT_AGENT_SLUG || null;

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        agent_slug: agentSlug,
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
      agent_slug: agentSlug,
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

export async function PATCH(request: NextRequest) {
  try {
    const { leadId, selectedPlan, selectedPlanId } = await request.json();
    if (!leadId) return NextResponse.json(
      { error: "Missing leadId" },
      { status: 400, headers: NO_STORE_HEADERS }
    );

    const supabase = createServiceClient();
    const update: Record<string, unknown> = {};
    if (selectedPlan) update.selected_plan = selectedPlan;
    if (selectedPlanId) update.selected_plan_name = selectedPlan;

    if (Object.keys(update).length > 0) {
      await supabase.from("leads").update(update).eq("id", leadId);
    }

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("Browse PATCH error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
