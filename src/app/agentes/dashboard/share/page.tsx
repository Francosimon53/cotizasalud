import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase-auth";
import { createServiceClient } from "@/lib/supabase";
import DashboardHeader from "../DashboardHeader";
import ShareClient from "./ShareClient";
import "../../agentes.css";

export default async function SharePage() {
  const cookieStore = await cookies();
  const supabase = createServerAuthClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/agentes/login");

  const db = createServiceClient();
  const { data: agent } = await db.from("agents").select("slug, name, agency_name").eq("auth_user_id", user.id).single();
  if (!agent) redirect("/agentes/login");

  return (
    <div style={{
      fontFamily: "'Satoshi', -apple-system, sans-serif",
      minHeight: "100vh", background: "#08090d", color: "#f0f1f5",
    }}>
      <DashboardHeader agentName={agent.name} agencyName={agent.agency_name} />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px 60px" }}>
        <ShareClient slug={agent.slug} agentName={agent.name} />
      </div>
    </div>
  );
}
