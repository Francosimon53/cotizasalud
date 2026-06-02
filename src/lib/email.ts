// Centralized email sending via Resend. Before this module, email was sent
// inline inside individual API routes (see app/api/notify-lead/route.ts).
// New senders (e.g. the lead-reminders cron) should import from here so the
// provider, the "from" identity, and the user-input escaping rules live in
// one place.
import { Resend } from "resend";
import { escapeHtml } from "@/lib/security/escape-html";
import { sanitizePlainText } from "@/lib/security/sanitize-plain-text";

const FROM = "EnrollSalud <notifications@enrollsalud.com>";

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: string };

/**
 * Thin wrapper over Resend. Returns a discriminated result instead of throwing
 * so cron/batch callers can keep processing the rest of their queue when a
 * single send fails. If RESEND_API_KEY is not configured the send is skipped
 * (not an error) — mirrors the existing notify-lead behavior.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — skipping email send");
    return { sent: false, reason: "email not configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      // Subject is a plain-text context: strip control chars + cap length.
      subject: sanitizePlainText(params.subject, { maxLength: 200 }),
      html: params.html,
    });
    if (error) {
      console.error("Resend error:", error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error("sendEmail error:", reason);
    return { sent: false, reason };
  }
}

export interface LeadReminderInput {
  /** Recipient: the assigned agent's email (never the lead's). */
  to: string;
  /** Agent display name for the greeting. */
  agentName: string;
  /** Lead full name. */
  leadName: string;
  /** Lead phone, if known. */
  leadPhone?: string | null;
  /** When the lead first made contact (leads.created_at, ISO string). */
  firstContactAt: string;
}

const dateFmt = new Intl.DateTimeFormat("es-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/New_York",
});

function formatFirstContact(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/**
 * Day-3 reminder: gentle nudge that a lead has gone 3 days without response.
 * All lead/agent values are HTML-escaped — they originate from public forms.
 */
export function sendDay3ReminderEmail(input: LeadReminderInput): Promise<SendEmailResult> {
  const name = escapeHtml(input.leadName);
  const agent = escapeHtml(input.agentName);
  const phone = input.leadPhone ? escapeHtml(input.leadPhone) : "";
  const phoneClean = input.leadPhone ? String(input.leadPhone).replace(/\D/g, "") : "";
  const firstContact = escapeHtml(formatFirstContact(input.firstContactAt));

  const subject = `Seguimiento pendiente: ${input.leadName}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f59e0b; padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">Seguimiento pendiente</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">EnrollSalud · Recordatorio día 3</p>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hola ${agent},</p>
        <p style="margin: 0 0 16px; color: #374151;">Han pasado <strong>3 días</strong> sin respuesta de este contacto. Te recomendamos volver a comunicarte para no perder la oportunidad:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Nombre</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${name}</td></tr>
          ${phone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Teléfono</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="tel:${phone}" style="color: #f59e0b;">${phone}</a></td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Primer contacto</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${firstContact}</td></tr>
        </table>
        ${phoneClean ? `
        <div style="margin: 20px 0 0; text-align: center;">
          <a href="https://wa.me/${escapeHtml(phoneClean.length === 10 ? `1${phoneClean}` : phoneClean)}" style="display: inline-block; padding: 14px 28px; background: #25D366; color: #fff; font-size: 16px; font-weight: 800; border-radius: 10px; text-decoration: none;">💬 Contactar por WhatsApp</a>
        </div>` : ""}
      </div>
    </div>
  `;
  return sendEmail({ to: input.to, subject, html });
}

/**
 * Day-7 reminder: higher-urgency alert that a lead has gone 7 days unanswered.
 */
export function sendDay7ReminderEmail(input: LeadReminderInput): Promise<SendEmailResult> {
  const name = escapeHtml(input.leadName);
  const agent = escapeHtml(input.agentName);
  const phone = input.leadPhone ? escapeHtml(input.leadPhone) : "";
  const phoneClean = input.leadPhone ? String(input.leadPhone).replace(/\D/g, "") : "";
  const firstContact = escapeHtml(formatFirstContact(input.firstContactAt));

  const subject = `Alerta: lead sin respuesta por 7 días — ${input.leadName}`;
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; padding: 20px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">⚠️ Lead sin respuesta por 7 días</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 14px;">EnrollSalud · Alerta día 7</p>
      </div>
      <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 16px; color: #374151;">Hola ${agent},</p>
        <p style="margin: 0 0 16px; color: #b91c1c; font-weight: 600;">Este contacto lleva 7 días sin responder. Es muy probable que lo pierdas si no actúas hoy. Hacé un último intento de contacto:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Nombre</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${name}</td></tr>
          ${phone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Teléfono</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;"><a href="tel:${phone}" style="color: #dc2626;">${phone}</a></td></tr>` : ""}
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 13px; border-bottom: 1px solid #f3f4f6;">Primer contacto</td><td style="padding: 8px 0; font-weight: 600; color: #111827; border-bottom: 1px solid #f3f4f6;">${firstContact}</td></tr>
        </table>
        ${phoneClean ? `
        <div style="margin: 20px 0 0; text-align: center;">
          <a href="https://wa.me/${escapeHtml(phoneClean.length === 10 ? `1${phoneClean}` : phoneClean)}" style="display: inline-block; padding: 14px 28px; background: #25D366; color: #fff; font-size: 16px; font-weight: 800; border-radius: 10px; text-decoration: none;">💬 Último intento por WhatsApp</a>
        </div>` : ""}
      </div>
    </div>
  `;
  return sendEmail({ to: input.to, subject, html });
}
