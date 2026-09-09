import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { isAdminSlug } from "@/lib/admin-slugs";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/security/escape-html";

const EXCLUDED_SLUGS = new Set(["simon-dev", "test-agent", "pppppppppppp"]);
const BASE = "https://www.enrollsalud.com";

function announcementHtml(agentName: string, slug: string): string {
  const name = escapeHtml(agentName);
  const carta = `${BASE}/q/${encodeURIComponent(slug)}?utm_source=email&utm_medium=internal&utm_campaign=historia-carta-mesa-v1`;
  const cita = `${BASE}/q/${encodeURIComponent(slug)}?utm_source=email&utm_medium=internal&utm_campaign=historia-cita-pospuesta-v1`;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#172033;line-height:1.55">
    <div style="background:#0f766e;padding:24px;border-radius:14px 14px 0 0;color:#fff">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">EnrollSalud</div>
      <h1 style="margin:8px 0 0;font-size:24px">Una nueva forma de iniciar conversaciones</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 14px 14px;background:#fff">
      <p>Hola ${name},</p>
      <p>Tu enlace personalizado ahora puede comenzar con una historia antes de pedir datos. La idea es abrir una conversación humana y ayudar a la persona a entender su situación con calma.</p>
      <p><strong>Prueba estas dos historias:</strong></p>
      <p><a href="${carta}" style="color:#0f766e;font-weight:700">La carta sobre la mesa</a><br><span style="color:#526070">Para conversaciones sobre presupuesto familiar o incertidumbre.</span></p>
      <p><a href="${cita}" style="color:#0f766e;font-weight:700">La cita pospuesta</a><br><span style="color:#526070">Para personas que han ido aplazando una consulta o una decisión de salud.</span></p>
      <p>Entra a <strong>Dashboard → Compartir</strong> para ver las historias, copiar mensajes y elegir el canal. Durante la primera semana, usa al menos una historia y actualiza el estado de cada contacto en tu CRM.</p>
      <p style="background:#f0fdfa;padding:14px;border-radius:10px;color:#115e59"><strong>Importante:</strong> no prometas aprobación, ahorros ni elegibilidad. La historia abre la conversación; la confirmación la haces tú como agente licenciado.</p>
      <p>Gracias,<br>Equipo EnrollSalud</p>
    </div>
  </div>`;
}

export async function POST() {
  const cookieStore = await cookies();
  const auth = createServerAuthClient(cookieStore);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createServiceClient();
  const { data: admin } = await db.from("agents").select("slug").eq("auth_user_id", user.id).single();
  if (!admin || !isAdminSlug(admin.slug)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { data: agents, error } = await db
    .from("agents")
    .select("slug, name, email, is_active")
    .eq("is_active", true);
  if (error) return NextResponse.json({ error: "Could not load agents" }, { status: 500 });

  const recipients = (agents || []).filter((agent) =>
    typeof agent.email === "string" && agent.email.includes("@") && !EXCLUDED_SLUGS.has(agent.slug)
  );
  const results = [];
  for (const agent of recipients) {
    const result = await sendEmail({
      to: agent.email,
      subject: "EnrollSalud: empieza tus conversaciones con una historia",
      html: announcementHtml(agent.name || "agente", agent.slug),
    });
    results.push({ slug: agent.slug, sent: result.sent, reason: "reason" in result ? result.reason : undefined });
  }

  const sent = results.filter((result) => result.sent).length;
  return NextResponse.json({ sent, attempted: results.length, results });
}
