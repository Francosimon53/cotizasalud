import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { resolveAgentFromSlug } from "@/lib/resolve-agent";
import { normalizeAgentSlug } from "@/lib/normalize-slug";
import { captureInvalidAgentSlug } from "@/lib/slug-logging";

export async function POST(request: NextRequest) {
  try {
    const { name, phone, email, planName, premium, effectiveDate, status, agentSlug, zipcode } = await request.json();

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const cleanPhone = phone.replace(/\D/g, "");
    const slugResult = normalizeAgentSlug(agentSlug);
    captureInvalidAgentSlug(slugResult, "app/api/leads/import/route.ts", {
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
      { zipcode, source: "api/leads/import POST" }
    );

    // Check for duplicate by phone + agent (use the trimmed slug for an accurate match)
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("contact_phone", cleanPhone)
      .eq("agent_slug", agent_slug)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ skipped: true, reason: "duplicate" });
    }

    // Parse dates
    const enrollDate = effectiveDate ? new Date(effectiveDate).toISOString().split("T")[0] : null;
    const renewDate = enrollDate ? new Date(new Date(enrollDate).getTime() + 365 * 86400000).toISOString().split("T")[0] : null;

    // Derive status
    const leadStatus = (status?.toLowerCase().includes("active") || status?.toLowerCase().includes("enrolled")) ? "enrolled" : "new";

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        agent_id,
        agent_slug,
        contact_name: name,
        contact_phone: cleanPhone,
        contact_email: email || null,
        selected_plan_name: planName || null,
        selected_premium: premium ? parseFloat(premium.replace(/[$,]/g, "")) : null,
        enrollment_date: enrollDate,
        renewal_date: renewDate,
        status: leadStatus,
        enrolled_at: leadStatus === "enrolled" ? new Date().toISOString() : null,
        first_name: name.split(" ")[0] || name,
        last_name: name.split(" ").slice(1).join(" ") || "",
        zipcode: zipcode || "",
        county: "",
        state: "FL",
        household_size: 1,
        annual_income: 0,
        fpl_percentage: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Import error:", error);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    // Create renewal reminder if we have a renewal date
    if (renewDate && lead) {
      await supabase.from("renewal_reminders").insert({
        lead_id: lead.id,
        renewal_date: renewDate,
      });
    }

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (err) {
    console.error("Import API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
