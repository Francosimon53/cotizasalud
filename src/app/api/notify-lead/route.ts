import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — skipping lead notification");
    return NextResponse.json({ sent: false, reason: "email not configured" });
  }

  try {
    const body = await req.json();
    const { leadId, agentSlug, contactName, contactPhone, contactEmail, zipcode, county, state, householdSize, annualIncome, fplPercentage, conversationSummary, planName, isReadyToEnroll } = body;

    // Look up agent email
    let agentEmail = "";
    let agentName = "Agent";
    if (agentSlug) {
      const supabase = createServiceClient();
      const { data } = await supabase
        .from("agents")
        .select("email, name")
        .eq("slug", agentSlug)
        .eq("is_active", true)
        .single();
      if (data?.email) {
        agentEmail = data.email;
        agentName = data.name;
      }
    }

    if (!agentEmail) {
      // No agent or no email — send to platform default
      agentEmail = "leads@enrollsalud.com";
      agentName = "EnrollSalud";
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "EnrollSalud <notifications@enrollsalud.com>",
      to: agentEmail,
      subject: isReadyToEnroll
        ? `🔥 Cliente LISTO para enrollment — ${contactName} quiere ${planName || "plan del Marketplace"}`
        : `New Lead: ${contactName} — ${county}, ${state}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; padding: 20px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">New Lead Received</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">EnrollSalud Marketplace</p>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px; color: #374151;">Hi ${agentName},</p>
            <p style="margin: 0 0 16px; color: #374151;">A new lead has been submitted through your EnrollSalud quoter:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Name</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${contactName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Phone</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="tel:${contactPhone}" style="color: #10b981;">${contactPhone}</a></td></tr>
              ${contactEmail ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Email</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="mailto:${contactEmail}" style="color: #10b981;">${contactEmail}</a></td></tr>` : ""}
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Location</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${county}, ${state} ${zipcode}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Household</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${householdSize} member${householdSize > 1 ? "s" : ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Income</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">$${Number(annualIncome).toLocaleString()}/yr (${fplPercentage}% FPL)</td></tr>
            </table>
            ${conversationSummary ? `
            <div style="margin: 16px 0; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">Resumen de la Conversación con IA</p>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${conversationSummary}</p>
            </div>` : ""}
            ${(() => {
              const cleanPhone = String(contactPhone).replace(/\D/g, "");
              const waPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
              const waMsg = encodeURIComponent(`Hola ${contactName}, soy ${agentName} tu agente de seguros de salud. Recibí tu interés en un plan del Marketplace. ¿Tienes unos minutos para hablar sobre tu cobertura?`);
              return `
            <div style="margin: 20px 0 0; text-align: center;">
              <a href="https://wa.me/${waPhone}?text=${waMsg}" style="display: inline-block; padding: 14px 28px; background: #25D366; color: #fff; font-size: 16px; font-weight: 800; border-radius: 10px; text-decoration: none;">
                💬 Enviar WhatsApp al Cliente
              </a>
              <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">Toca el botón para abrir WhatsApp con mensaje pre-escrito</p>
            </div>`;
            })()}
            ${leadId ? `<p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">Lead ID: ${leadId}</p>` : ""}
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ sent: false, reason: error.message }, { status: 500 });
    }

    return NextResponse.json({ sent: true });
  } catch (err: any) {
    console.error("Notify-lead error:", err);
    return NextResponse.json({ sent: false, reason: err.message }, { status: 500 });
  }
}
