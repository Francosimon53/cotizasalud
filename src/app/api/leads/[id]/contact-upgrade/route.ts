import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAD_RECENCY_MS = 10 * 60 * 1000;
const ELIGIBLE_PRIOR_STATUSES = ["browsing", "quoted"] as const;

// Public endpoint for the anonymous cotizar flow: upgrades a freshly-created
// browse-stage lead to "new" with the consumer's contact info. Defense in
// layers — IP rate limit, UUID validation, lead existence + recency window,
// status whitelist (lead must still be in the public funnel), and an atomic
// UPDATE WHERE clause to defeat the race between status-check and write.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(`contact-upgrade:${ip}`, { max: 5, windowMs: 60_000 }).limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: NO_STORE_HEADERS }
    );
  }

  const { id } = await params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Invalid lead reference" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const supabase = createServiceClient();
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, created_at, status")
    .eq("id", id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json(
      { error: "Invalid lead reference" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const createdAtMs = new Date(lead.created_at).getTime();
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > LEAD_RECENCY_MS) {
    return NextResponse.json(
      { error: "Invalid lead reference" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!ELIGIBLE_PRIOR_STATUSES.includes(lead.status)) {
    return NextResponse.json(
      { error: "Invalid lead reference" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // Build update payload — same field allow-list as the legacy PATCH /api/leads
  // contact-upgrade path used to accept. Status forced to "new"; consent fields
  // captured from headers.
  const b = body as Record<string, any>;
  const update: Record<string, unknown> = { status: "new" };
  if (b.contactName) update.contact_name = b.contactName;
  if (b.contactPhone) update.contact_phone = b.contactPhone;
  if (b.contactEmail) update.contact_email = b.contactEmail;
  if (b.firstName) update.first_name = b.firstName;
  if (b.lastName) update.last_name = b.lastName;
  if (b.dob) update.dob = b.dob;
  if (b.streetAddress) update.street_address = b.streetAddress;
  if (b.city) update.city = b.city;
  if (b.stateForm) update.state_form = b.stateForm;
  if (b.aptNumber !== undefined) update.apt_number = b.aptNumber;
  if (b.currentInsurance) update.current_insurance = b.currentInsurance;
  if (b.currentInsuranceName !== undefined) update.current_insurance_name = b.currentInsuranceName;
  if (b.contactPreference) update.contact_preference = b.contactPreference;
  if (b.bestCallTime) update.best_call_time = b.bestCallTime;
  if (b.householdDobs) update.household_dobs = b.householdDobs;
  if (b.householdMembers) update.household_members = b.householdMembers;
  if (b.genders) update.genders = b.genders;
  if (b.signatureData) {
    update.signature_data = b.signatureData;
    update.consent_ip = request.headers.get("x-forwarded-for") || "";
  }
  if (b.consentTimestamp) update.consent_timestamp = b.consentTimestamp;

  // Atomic guard: if the row's status changed between our check and this
  // write (race), in() filters it out and returns zero affected rows.
  const { data: updatedRows, error: updateErr } = await supabase
    .from("leads")
    .update(update)
    .eq("id", id)
    .in("status", ELIGIBLE_PRIOR_STATUSES as unknown as string[])
    .select("id");

  if (updateErr) {
    console.error("contact-upgrade update error:", updateErr);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: "Invalid lead reference" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  // Log activity (mirrors the legacy PATCH path)
  const note = typeof b.note === "string" && b.note.trim()
    ? b.note.trim()
    : `Contacto: ${b.contactName ?? ""} — ${b.contactPhone ?? ""}`;
  await supabase.from("lead_activity").insert({
    lead_id: id,
    action: "status_change",
    from_status: lead.status,
    to_status: "new",
    note,
    lost_reason: null,
  });

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
