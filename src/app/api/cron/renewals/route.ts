import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  // Fail closed: if CRON_SECRET is not configured, refuse to run rather
  // than fall through to an open endpoint that triggers Twilio/DB writes.
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("CRON_SECRET not configured — refusing to run cron");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expectedSecret}`;
  // Constant-time comparison; pre-check length to avoid throwing on
  // mismatched buffer sizes and to keep the comparison time-independent.
  const headerBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expectedHeader);
  if (
    headerBuf.length !== expectedBuf.length ||
    !timingSafeEqual(headerBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Send WhatsApp if Twilio configured. Inlined from the former
    // /api/notifications/whatsapp route (deleted) so the Twilio send is
    // not exposed as a public-callable endpoint.
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    if (sid && token && fromNumber) {
      try {
        const cleanPhone = String(lead.contact_phone).replace(/\D/g, "");
        const whatsappTo = `whatsapp:+${cleanPhone.length === 10 ? "1" : ""}${cleanPhone}`;
        const whatsappFrom = `whatsapp:${fromNumber}`;
        const clientName = lead.contact_name;
        const agentName = agent?.name || "Tu agente";
        const agentPhone = agent?.phone || "";
        const planName = lead.selected_plan_name || "tu plan actual";
        const message = `Hola ${clientName}, soy ${agentName}, tu agente de seguros de salud en EnrollSalud. Vi que te interesa el plan ${planName} por $?/mes. ¿Tienes unos minutos para que hablemos sobre tu cobertura? Puedes llamarme al ${agentPhone} o responder este mensaje.`;

        const twilio = (await import("twilio")).default;
        const client = twilio(sid, token);
        await client.messages.create({
          body: message,
          from: whatsappFrom,
          to: whatsappTo,
        });

        await supabase.from("lead_activity").insert({
          lead_id: r.lead_id,
          action: "whatsapp_sent",
          note: `WhatsApp automático enviado: "${message.slice(0, 100)}..."`,
        });
      } catch (err) {
        console.error("Twilio WhatsApp error in cron:", err);
      }
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
