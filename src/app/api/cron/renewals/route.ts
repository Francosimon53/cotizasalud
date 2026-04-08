import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow if no CRON_SECRET is set (dev mode)
    if (process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const results = { reminders_60: 0, reminders_30: 0, reminders_15: 0 };

  // Helper: date N days from now
  const futureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const date60 = futureDate(60);
  const date30 = futureDate(30);
  const date15 = futureDate(15);

  // 60-day reminders
  const { data: rem60 } = await supabase
    .from("renewal_reminders")
    .select("id, lead_id, renewal_date")
    .eq("renewal_date", date60)
    .eq("reminder_60_sent", false);

  for (const r of rem60 || []) {
    const { data: lead } = await supabase.from("leads").select("contact_name, contact_phone, agent_slug, selected_plan_name").eq("id", r.lead_id).single();
    if (!lead) continue;

    const { data: agent } = await supabase.from("agents").select("name, phone").eq("slug", lead.agent_slug).single();

    // Log activity
    await supabase.from("lead_activity").insert({
      lead_id: r.lead_id,
      action: "renewal_reminder",
      note: `Recordatorio 60 días: renovación el ${r.renewal_date}`,
    });

    await supabase.from("renewal_reminders").update({ reminder_60_sent: true }).eq("id", r.id);
    results.reminders_60++;

    // Send WhatsApp if Twilio configured
    if (process.env.TWILIO_ACCOUNT_SID) {
      try {
        const origin = request.nextUrl.origin;
        await fetch(`${origin}/api/notifications/whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lead.contact_phone,
            clientName: lead.contact_name,
            agentName: agent?.name || "Tu agente",
            agentPhone: agent?.phone || "",
            planName: lead.selected_plan_name || "tu plan actual",
            leadId: r.lead_id,
          }),
        });
      } catch {}
    }
  }

  // 30-day reminders
  const { data: rem30 } = await supabase
    .from("renewal_reminders")
    .select("id, lead_id, renewal_date")
    .eq("renewal_date", date30)
    .eq("reminder_30_sent", false);

  for (const r of rem30 || []) {
    await supabase.from("lead_activity").insert({
      lead_id: r.lead_id,
      action: "renewal_reminder",
      note: `Recordatorio 30 días: renovación el ${r.renewal_date}`,
    });
    await supabase.from("renewal_reminders").update({ reminder_30_sent: true }).eq("id", r.id);
    results.reminders_30++;
  }

  // 15-day reminders
  const { data: rem15 } = await supabase
    .from("renewal_reminders")
    .select("id, lead_id, renewal_date")
    .eq("renewal_date", date15)
    .eq("reminder_15_sent", false);

  for (const r of rem15 || []) {
    await supabase.from("lead_activity").insert({
      lead_id: r.lead_id,
      action: "renewal_reminder",
      note: `⚠️ Recordatorio 15 días: renovación el ${r.renewal_date}`,
    });
    await supabase.from("renewal_reminders").update({ reminder_15_sent: true }).eq("id", r.id);
    results.reminders_15++;
  }

  return NextResponse.json({ success: true, today, ...results });
}
