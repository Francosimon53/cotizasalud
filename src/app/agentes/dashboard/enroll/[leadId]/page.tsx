import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import EnrollClient from "./EnrollClient";
import "../../../agentes.css";

export default async function EnrollPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug, name, phone, npn, healthsherpa_agent_id").eq("auth_user_id", user.id).single();
  if (!agent) redirect("/agentes/dashboard");

  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).eq("agent_slug", agent.slug).single();
  if (!lead) redirect("/agentes/dashboard");

  // Get conversation if exists
  const { data: conversation } = await db
    .from("ai_conversations")
    .select("conversation_summary, messages, selected_plan_name, selected_plan_hios_id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return <EnrollClient lead={lead} agent={agent} conversation={conversation} />;
}
