import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase";
import { ACA_STATS } from "@/lib/aca-stats";
import { ventanaEnero } from "@/lib/renewal-reminder";

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
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const results = { reminders_60: 0, reminders_30: 0, reminders_15: 0, pasado_limite: 0 };

  // EnrollSalud no escribe al cliente final (Términos de Servicio, terms L167
  // y L350): este cron solo deja notas internas. El agente manda el mensaje
  // desde su propio WhatsApp (botón en la ficha del cliente).

  // ── Renovaciones que NO son del 1 de enero: lógica original ─────────────
  // Avisos exactos a 60, 30 y 15 días de renewal_date. Las del 1 de enero se
  // excluyen aquí y se manejan abajo, ancladas al 15 de diciembre.
  const futureDate = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };
  const esUnoDeEnero = (fecha: string) => typeof fecha === "string" && fecha.slice(5, 10) === "01-01";

  const windows = [
    { days: 60, flag: "reminder_60_sent", counter: "reminders_60", prefix: "" },
    { days: 30, flag: "reminder_30_sent", counter: "reminders_30", prefix: "" },
    { days: 15, flag: "reminder_15_sent", counter: "reminders_15", prefix: "⚠️ " },
  ] as const;

  for (const w of windows) {
    const { data: rows } = await supabase
      .from("renewal_reminders")
      .select("id, lead_id, renewal_date")
      .eq("renewal_date", futureDate(w.days))
      .eq(w.flag, false);

    for (const r of (rows || []).filter((r: any) => !esUnoDeEnero(r.renewal_date))) {
      await supabase.from("lead_activity").insert({
        lead_id: r.lead_id,
        action: "renewal_reminder",
        note: `${w.prefix}Recordatorio ${w.days} días: renovación el ${r.renewal_date}`,
      });
      await supabase.from("renewal_reminders").update({ [w.flag]: true }).eq("id", r.id);
      results[w.counter]++;
    }
  }

  // ── Renovaciones del 1 de enero del año Y ───────────────────────────────
  // El límite para que el plan empiece el 1 de enero es el 15 de diciembre de
  // Y-1 (ACA_STATS.oepLimiteEneroFecha). Sin migración, las banderas cambian
  // de significado SOLO para estas filas:
  //   reminder_60_sent = primer recordatorio, desde el 1-nov
  //   reminder_30_sent = segundo, desde el 1-dic
  //   reminder_15_sent = tercero, desde el 10-dic
  // "Desde" (>=): si un día no corre el cron, el aviso sale al siguiente. Un
  // aviso por fila y por corrida, siempre el primero antes que los demás: una
  // cartera importada tarde recibe el primero y luego, en corridas
  // siguientes, los que le toquen. Pasado el 15-dic ya no sale el primero (su
  // mensaje habla del 15): se marcan las tres banderas y queda una nota. La
  // ventana cierra el 15 de enero de Y, fin real del período.
  const v = ventanaEnero(now);

  if (v) {
    const { data: remEnero } = await supabase
      .from("renewal_reminders")
      .select("id, lead_id, renewal_date, reminder_60_sent, reminder_30_sent, reminder_15_sent")
      .eq("renewal_date", `${v.anioRenovacion}-01-01`);

    for (const r of remEnero || []) {
      if (v.antesDelLimite) {
        if (!r.reminder_60_sent) {
          await supabase.from("lead_activity").insert({
            lead_id: r.lead_id,
            action: "renewal_reminder",
            note: `Recordatorio: ya abrió la inscripción para ${v.anioRenovacion}. Mándale el mensaje de renovación por WhatsApp desde su ficha. El límite es el ${ACA_STATS.oepLimiteEnero}.`,
          });
          await supabase.from("renewal_reminders").update({ reminder_60_sent: true }).eq("id", r.id);
          results.reminders_60++;
        } else if (v.desdeSegundo && !r.reminder_30_sent) {
          await supabase.from("lead_activity").insert({
            lead_id: r.lead_id,
            action: "renewal_reminder",
            note: `Recordatorio: faltan ${v.diasAlLimite} días para el ${ACA_STATS.oepLimiteEnero}`,
          });
          await supabase.from("renewal_reminders").update({ reminder_30_sent: true }).eq("id", r.id);
          results.reminders_30++;
        } else if (v.desdeTercero && !r.reminder_15_sent) {
          await supabase.from("lead_activity").insert({
            lead_id: r.lead_id,
            action: "renewal_reminder",
            note: `⚠️ Recordatorio: faltan ${v.diasAlLimite} días para el ${ACA_STATS.oepLimiteEnero}`,
          });
          await supabase.from("renewal_reminders").update({ reminder_15_sent: true }).eq("id", r.id);
          results.reminders_15++;
        }
      } else if (!(r.reminder_60_sent && r.reminder_30_sent && r.reminder_15_sent)) {
        await supabase.from("lead_activity").insert({
          lead_id: r.lead_id,
          action: "renewal_reminder",
          note: "Pasó el 15 de diciembre: si se inscribe antes del 15 de enero, la cobertura empieza el 1 de febrero.",
        });
        await supabase
          .from("renewal_reminders")
          .update({ reminder_60_sent: true, reminder_30_sent: true, reminder_15_sent: true })
          .eq("id", r.id);
        results.pasado_limite++;
      }
    }
  }

  return NextResponse.json({ success: true, today, ...results });
}
