import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import { buscarEvidencia } from "@/lib/consent-evidence";
import { ventanaEnero } from "@/lib/renewal-reminder";
import LeadDetailClient from "./LeadDetailClient";
import "../../agentes.css";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug, name, npn, agency_name, healthsherpa_agent_id, phone").eq("auth_user_id", user.id).single();
  if (!agent) redirect("/agentes/dashboard");

  const { data: lead } = await db.from("leads").select("*").eq("id", id).eq("agent_slug", agent.slug).single();
  if (!lead) redirect("/agentes/dashboard");

  const { data: activity } = await db
    .from("lead_activity")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  let conversation = null;
  try {
    const { data } = await db
      .from("ai_conversations")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    conversation = data;
  } catch {}

  const tieneConsentimiento = (await buscarEvidencia(db, lead)) !== null;

  // Botón del mensaje de renovación: solo del 1-nov al 15-dic y si el cliente
  // tiene una renovación del 1 de enero de ese año.
  let renovacionAnio: number | null = null;
  const ventana = ventanaEnero(new Date());
  if (ventana?.antesDelLimite) {
    const { data: renewal } = await db
      .from("renewal_reminders")
      .select("id")
      .eq("lead_id", id)
      .eq("renewal_date", `${ventana.anioRenovacion}-01-01`)
      .limit(1)
      .maybeSingle();
    if (renewal) renovacionAnio = ventana.anioRenovacion;
  }

  return <LeadDetailClient lead={lead} activity={activity || []} conversation={conversation} agent={agent} tieneConsentimiento={tieneConsentimiento} renovacionAnio={renovacionAnio} />;
}
