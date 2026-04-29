import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveAgentFromSlug } from "@/lib/resolve-agent";
import { normalizeAgentSlug } from "@/lib/normalize-slug";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = createServiceClient();
    const slugResult = normalizeAgentSlug(body.agentSlug);
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
      return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    }

    // Track page view
    await supabase.from("page_views").insert({
      agent_slug,
      page: "/cotizar",
      ip_address: request.headers.get("x-forwarded-for") || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error("Browse API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { leadId, selectedPlan, selectedPlanId } = await request.json();
    if (!leadId) return NextResponse.json({ error: "Missing leadId" }, { status: 400 });

    const supabase = createServiceClient();
    const update: Record<string, unknown> = {};
    if (selectedPlan) update.selected_plan = selectedPlan;
    if (selectedPlanId) update.selected_plan_name = selectedPlan;

    if (Object.keys(update).length > 0) {
      await supabase.from("leads").update(update).eq("id", leadId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Browse PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
