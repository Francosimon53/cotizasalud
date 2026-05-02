import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedAgent } from "@/lib/auth/require-agent";

export async function POST(request: NextRequest) {
  // Auth: derive identity from the session cookie via the canonical helper.
  // The body's agent_slug, if present, is intentionally ignored — accepting
  // it would let any authenticated agent inject leads under another agent's
  // identity.
  const auth = await requireAuthenticatedAgent();
  if (auth instanceof NextResponse) return auth;
  const { agent, user } = auth;

  // Rate limit by authenticated user, not IP — multiple agents may share an IP.
  if (
    rateLimit(`import:${user.id}`, { max: 10, windowMs: 60 * 60_000 }).limited
  ) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const db = createServiceClient();

  try {
    // agent_slug from body is intentionally ignored; identity is derived from auth
    const { name, phone, email, planName, premium, effectiveDate, status, zipcode } =
      await request.json();

    if (!name || !phone) {
      return NextResponse.json(
        { error: "Name and phone required" },
        { status: 400 }
      );
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    // Dedupe by phone + authenticated agent_slug
    const { data: existing } = await db
      .from("leads")
      .select("id")
      .eq("contact_phone", cleanPhone)
      .eq("agent_slug", agent.slug)
      .limit(1)
      .single();

    if (existing) {
      return NextResponse.json({ skipped: true, reason: "duplicate" });
    }

    const enrollDate = effectiveDate
      ? new Date(effectiveDate).toISOString().split("T")[0]
      : null;
    const renewDate = enrollDate
      ? new Date(new Date(enrollDate).getTime() + 365 * 86400000)
          .toISOString()
          .split("T")[0]
      : null;

    const leadStatus =
      status?.toLowerCase().includes("active") ||
      status?.toLowerCase().includes("enrolled")
        ? "enrolled"
        : "new";

    const { data: lead, error } = await db
      .from("leads")
      .insert({
        agent_id: agent.id,
        agent_slug: agent.slug,
        contact_name: name,
        contact_phone: cleanPhone,
        contact_email: email || null,
        selected_plan_name: planName || null,
        selected_premium: premium
          ? parseFloat(String(premium).replace(/[$,]/g, ""))
          : null,
        enrollment_date: enrollDate,
        renewal_date: renewDate,
        status: leadStatus,
        enrolled_at:
          leadStatus === "enrolled" ? new Date().toISOString() : null,
        first_name: String(name).split(" ")[0] || name,
        last_name: String(name).split(" ").slice(1).join(" ") || "",
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

    if (renewDate && lead) {
      await db.from("renewal_reminders").insert({
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
