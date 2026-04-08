import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!sid || !token || !from) {
    console.warn("Twilio not configured — skipping WhatsApp send");
    return NextResponse.json({ sent: false, reason: "twilio_not_configured" });
  }

  try {
    const { to, clientName, agentName, agentPhone, planName, premium, leadId } = await request.json();

    const cleanPhone = String(to).replace(/\D/g, "");
    const whatsappTo = `whatsapp:+${cleanPhone.length === 10 ? "1" : ""}${cleanPhone}`;
    const whatsappFrom = `whatsapp:${from}`;

    const message = `Hola ${clientName}, soy ${agentName}, tu agente de seguros de salud en EnrollSalud. Vi que te interesa el plan ${planName || "del Marketplace"} por $${premium || "?"}/mes. ¿Tienes unos minutos para que hablemos sobre tu cobertura? Puedes llamarme al ${agentPhone || ""} o responder este mensaje.`;

    const twilio = (await import("twilio")).default;
    const client = twilio(sid, token);

    await client.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo,
    });

    // Log in lead activity
    if (leadId) {
      const supabase = createServiceClient();
      await supabase.from("lead_activity").insert({
        lead_id: leadId,
        action: "whatsapp_sent",
        note: `WhatsApp automático enviado: "${message.slice(0, 100)}..."`,
      });
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error("Twilio WhatsApp error:", err.message);
    return NextResponse.json({ sent: false, reason: err.message }, { status: 500 });
  }
}
