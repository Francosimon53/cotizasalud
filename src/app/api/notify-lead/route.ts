import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase";
import { normalizeAgentSlug } from "@/lib/normalize-slug";
import { captureInvalidAgentSlug } from "@/lib/slug-logging";
import { rateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/security/escape-html";
import { sanitizePlainText } from "@/lib/security/sanitize-plain-text";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAD_RECENCY_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Rate limit by IP first — abuse should be rejected before any I/O.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimit(`notify-lead:${ip}`, { max: 5, windowMs: 60_000 }).limited) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Parse and validate body before doing any DB work.
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId : null;
  if (!leadId) {
    return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  }
  if (!UUID_RE.test(leadId)) {
    return NextResponse.json({ error: "Invalid leadId format" }, { status: 400 });
  }

  // Verify the lead exists AND was created recently. The cotizar flow
  // POSTs here within seconds of creating the lead; older leads being
  // notified-about are almost certainly an attacker spoofing a known UUID.
  // Use a vague 400 for both not-found and stale, to avoid existence leaks.
  const supabase = createServiceClient();
  const { data: leadRow, error: leadErr } = await supabase
    .from("leads")
    .select("id, created_at")
    .eq("id", leadId)
    .single();

  if (leadErr || !leadRow) {
    return NextResponse.json({ error: "Invalid lead reference" }, { status: 400 });
  }

  const createdAtMs = new Date(leadRow.created_at).getTime();
  if (!Number.isFinite(createdAtMs) || Date.now() - createdAtMs > LEAD_RECENCY_MS) {
    return NextResponse.json({ error: "Invalid lead reference" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — skipping lead notification");
    return NextResponse.json({ sent: false, reason: "email not configured" });
  }

  try {
    const { agentSlug, contactName, contactPhone, contactEmail, zipcode, county, state, householdSize, annualIncome, fplPercentage, conversationSummary, planName, isReadyToEnroll } = body as Record<string, any>;
    const slugResult = normalizeAgentSlug(agentSlug);
    captureInvalidAgentSlug(slugResult, "app/api/notify-lead/route.ts", {
      url: req.url,
      referer: req.headers.get("referer"),
      userAgent: req.headers.get("user-agent"),
    });
    const slug = slugResult.ok
      ? slugResult.slug
      : (process.env.DEFAULT_AGENT_SLUG?.trim() || "delbert");

    // Look up agent email
    let agentEmail = "";
    let agentName = "Agent";
    {
      const { data } = await supabase
        .from("agents")
        .select("email, name")
        .eq("slug", slug)
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

    // All user-controlled / agent-controlled values are interpolated through
    // escapeHtml() in the body, sanitizePlainText() in the subject, and
    // encodeURIComponent() inside URL params. See PR description for the
    // field-by-field cobertura matrix.
    const safeAgentName = escapeHtml(agentName);
    const safeContactName = escapeHtml(contactName);
    const safeContactPhone = escapeHtml(contactPhone);
    const safeContactEmail = escapeHtml(contactEmail);
    const safeCounty = escapeHtml(county);
    const safeState = escapeHtml(state);
    const safeZipcode = escapeHtml(zipcode);
    const safeHouseholdSize = escapeHtml(householdSize);
    const safeIncomeDisplay = escapeHtml(Number(annualIncome).toLocaleString());
    const safeFplPercentage = escapeHtml(fplPercentage);
    const safeConversationSummary = escapeHtml(conversationSummary);
    const safeLeadId = escapeHtml(leadId);

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "EnrollSalud <notifications@enrollsalud.com>",
      to: agentEmail,
      subject: isReadyToEnroll
        ? sanitizePlainText(
            `🔥 Cliente LISTO para enrollment — ${contactName} quiere ${planName || "plan del Marketplace"}`,
            { maxLength: 200 }
          )
        : sanitizePlainText(
            `Nuevo Contacto: ${contactName} — ${county}, ${state}`,
            { maxLength: 200 }
          ),
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #10b981; padding: 20px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 20px;">Nuevo Contacto Recibido</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 4px 0 0; font-size: 14px;">EnrollSalud Marketplace</p>
          </div>
          <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px; color: #374151;">Hola ${safeAgentName},</p>
            <p style="margin: 0 0 16px; color: #374151;">Acabás de recibir un nuevo contacto a través de tu cotizador EnrollSalud:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Nombre</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${safeContactName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Teléfono</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="tel:${safeContactPhone}" style="color: #10b981;">${safeContactPhone}</a></td></tr>
              ${contactEmail ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Email</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="mailto:${safeContactEmail}" style="color: #10b981;">${safeContactEmail}</a></td></tr>` : ""}
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Ubicación</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${safeCounty}, ${safeState} ${safeZipcode}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Hogar</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${safeHouseholdSize} miembro${householdSize > 1 ? "s" : ""}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Ingreso</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">$${safeIncomeDisplay}/año (${safeFplPercentage}% FPL)</td></tr>
            </table>
            ${conversationSummary ? `
            <div style="margin: 16px 0; padding: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px;">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">Resumen de la Conversación con IA</p>
              <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">${safeConversationSummary}</p>
            </div>` : ""}
            ${(() => {
              const cleanPhone = String(contactPhone).replace(/\D/g, "");
              const waPhone = cleanPhone.length === 10 ? `1${cleanPhone}` : cleanPhone;
              // contactName/agentName feed into encodeURIComponent so HTML
              // escaping is unnecessary here — but we sanitize control chars
              // first to keep the URL well-formed.
              const waMsg = encodeURIComponent(
                `Hola ${sanitizePlainText(contactName, { maxLength: 100 })}, soy ${sanitizePlainText(agentName, { maxLength: 100 })} tu agente de seguros de salud. Recibí tu interés en un plan del Marketplace. ¿Tienes unos minutos para hablar sobre tu cobertura?`
              );
              return `
            <div style="margin: 20px 0 0; text-align: center;">
              <a href="https://wa.me/${escapeHtml(waPhone)}?text=${escapeHtml(waMsg)}" style="display: inline-block; padding: 14px 28px; background: #25D366; color: #fff; font-size: 16px; font-weight: 800; border-radius: 10px; text-decoration: none;">
                💬 Enviar WhatsApp al Cliente
              </a>
              <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">Toca el botón para abrir WhatsApp con mensaje pre-escrito</p>
            </div>`;
            })()}
            ${leadId ? `<p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">Contacto ID: ${safeLeadId}</p>` : ""}
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
