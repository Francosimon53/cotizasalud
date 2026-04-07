import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import LeadDetailClient from "./LeadDetailClient";
import "../../agentes.css";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug").eq("auth_user_id", user.id).single();
  if (!agent) redirect("/agentes/login");

  const { data: lead } = await db.from("leads").select("*").eq("id", id).eq("agent_slug", agent.slug).single();
  if (!lead) redirect("/agentes/dashboard");

  const { data: activity } = await db
    .from("lead_activity")
    .select("*")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  return <LeadDetailClient lead={lead} activity={activity || []} />;
}
