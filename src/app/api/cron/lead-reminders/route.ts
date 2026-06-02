import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase";
import { sendDay3ReminderEmail, sendDay7ReminderEmail } from "@/lib/email";

// Statuses that mean "the lead has not responded / not progressed yet".
// A lead that engaged would have moved to quoted/enrolled; 'lost' is dead and
// 'browsing' is still inside the quiz (not a real contact yet).
const NO_RESPONSE_STATUSES = ["new", "contacted"];
const PLATFORM_FALLBACK_EMAIL = "leads@enrollsalud.com";
const DAY_MS = 24 * 60 * 60 * 1000;

type LeadRow = {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  agent_slug: string | null;
  created_at: string;
};

/**
 * Validate the `Authorization: Bearer <CRON_SECRET>` header in constant time.
 * Fails closed: if CRON_SECRET is unset we refuse rather than expose an open
 * endpoint that writes to the DB and sends email.
 */
function authorize(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("CRON_SECRET not configured — refusing to run cron");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const headerBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(`Bearer ${expectedSecret}`);
  if (
    headerBuf.length !== expectedBuf.length ||
    !timingSafeEqual(headerBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function runLeadReminders(request: NextRequest): Promise<NextResponse> {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;

  const supabase = createServiceClient();
  const now = Date.now();
  const threeDaysAgo = new Date(now - 3 * DAY_MS).toISOString();
  const sevenDaysAgo = new Date(now - 7 * DAY_MS).toISOString();
  const sentAt = new Date(now).toISOString();

  const results = { reminders_3: 0, reminders_7: 0, errors: 0 };

  // Cache agent lookups by slug so a busy agent isn't queried once per lead.
  const agentCache = new Map<string, { email: string; name: string }>();
  async function resolveAgent(slug: string | null): Promise<{ email: string; name: string }> {
    const key = slug ?? "";
    const cached = agentCache.get(key);
    if (cached) return cached;
    let resolved = { email: PLATFORM_FALLBACK_EMAIL, name: "EnrollSalud" };
    if (slug) {
      const { data } = await supabase
        .from("agents")
        .select("email, name")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();
      if (data?.email) resolved = { email: data.email, name: data.name || "Agente" };
    }
    agentCache.set(key, resolved);
    return resolved;
  }

  // Day 7 is processed first. A lead at/over 7 days qualifies here; the day-3
  // window below deliberately excludes anything older than 7 days, so no lead
  // can receive two emails in a single run.
  const { data: day7Leads } = await supabase
    .from("leads")
    .select("id, contact_name, contact_phone, agent_slug, created_at")
    .lte("created_at", sevenDaysAgo)
    .in("status", NO_RESPONSE_STATUSES)
    .is("reminder_7_sent_at", null);

  for (const lead of (day7Leads ?? []) as LeadRow[]) {
    const agent = await resolveAgent(lead.agent_slug);
    const res = await sendDay7ReminderEmail({
      to: agent.email,
      agentName: agent.name,
      leadName: lead.contact_name || "Contacto",
      leadPhone: lead.contact_phone,
      firstContactAt: lead.created_at,
    });
    if (!res.sent) {
      results.errors++;
      continue;
    }
    // Only stamp the guard column AFTER a confirmed send, so a transient email
    // failure leaves the lead eligible for the next daily run.
    await supabase.from("leads").update({ reminder_7_sent_at: sentAt }).eq("id", lead.id);
    await supabase.from("lead_activity").insert({
      lead_id: lead.id,
      action: "reminder_email",
      note: "⚠️ Recordatorio día 7 enviado al agente (lead sin respuesta)",
    });
    results.reminders_7++;
  }

  // Day 3: leads aged between 3 and 7 days, not yet reminded.
  const { data: day3Leads } = await supabase
    .from("leads")
    .select("id, contact_name, contact_phone, agent_slug, created_at")
    .lte("created_at", threeDaysAgo)
    .gt("created_at", sevenDaysAgo)
    .in("status", NO_RESPONSE_STATUSES)
    .is("reminder_3_sent_at", null);

  for (const lead of (day3Leads ?? []) as LeadRow[]) {
    const agent = await resolveAgent(lead.agent_slug);
    const res = await sendDay3ReminderEmail({
      to: agent.email,
      agentName: agent.name,
      leadName: lead.contact_name || "Contacto",
      leadPhone: lead.contact_phone,
      firstContactAt: lead.created_at,
    });
    if (!res.sent) {
      results.errors++;
      continue;
    }
    await supabase.from("leads").update({ reminder_3_sent_at: sentAt }).eq("id", lead.id);
    await supabase.from("lead_activity").insert({
      lead_id: lead.id,
      action: "reminder_email",
      note: "Recordatorio día 3 enviado al agente (lead sin respuesta)",
    });
    results.reminders_3++;
  }

  return NextResponse.json({ success: true, ...results });
}

// Vercel Cron invokes the endpoint with GET; POST is also accepted so the job
// can be triggered manually. Both paths run identical, header-authorized logic.
export async function GET(request: NextRequest) {
  return runLeadReminders(request);
}

export async function POST(request: NextRequest) {
  return runLeadReminders(request);
}
